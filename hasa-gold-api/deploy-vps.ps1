$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$VpsHost = '137.23.42.221'
$VpsUser = 'ubuntu'
$AppDirectory = '/home/ubuntu/hasa-gold-api'
$Domain = 'api.hasagold.store'
$HealthUrl = "https://$Domain/health"
$SshKey = Join-Path $env:USERPROFILE '.ssh\pathum-topup-vps'
$ApiFiles = @(
    'package.json',
    'package-lock.json',
    'src',
    'test',
    'ecosystem.config.cjs',
    'nginx-api.hasagold.store.conf'
)

function Assert-NativeSuccess {
    param([Parameter(Mandatory = $true)][string]$Operation)
    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with exit code $LASTEXITCODE."
    }
}

function ConvertTo-WindowsCommandLineArgument {
    param([Parameter(Mandatory = $true)][string]$Value)

    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $slashes++
            continue
        }
        if ($character -eq '"') {
            if ($slashes -gt 0) {
                [void]$builder.Append(('\' * (2 * $slashes)))
            }
            [void]$builder.Append('\"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) {
            [void]$builder.Append(('\' * $slashes))
            $slashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) {
        [void]$builder.Append(('\' * (2 * $slashes)))
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Expand-RemoteScript {
    param(
        [Parameter(Mandatory = $true)][string]$Template,
        [Parameter(Mandatory = $true)][hashtable]$Values
    )

    $expanded = $Template
    foreach ($name in $Values.Keys) {
        $expanded = $expanded.Replace("@@$name@@", [string]$Values[$name])
    }
    if ($expanded -match '@@[A-Z0-9_]+@@') {
        throw "Remote script has an unresolved deployment token: $($matches[0])"
    }
    return $expanded
}

function Invoke-RemoteScript {
    param([Parameter(Mandatory = $true)][string]$Script)

    $normalizedScript = $Script.Replace("`r`n", "`n").Replace("`r", "`n")
    if (-not $normalizedScript.EndsWith("`n")) {
        $normalizedScript += "`n"
    }

    $sshCommand = 'bash -c ''set -euo pipefail; tmp=$(mktemp); trap "rm -f -- \"$tmp\"" EXIT; cat > "$tmp"; bash -n "$tmp"; bash "$tmp"'''
    $sshArguments = @(
        '-i', $SshKey,
        '-o', 'IdentitiesOnly=yes',
        '-o', 'BatchMode=no',
        "$VpsUser@$VpsHost",
        $sshCommand
    )
    $quotedArguments = @(
        $sshArguments | ForEach-Object { ConvertTo-WindowsCommandLineArgument -Value ([string]$_) }
    )

    $sshPath = (Get-Command ssh -ErrorAction Stop).Source
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $sshPath
    $startInfo.Arguments = $quotedArguments -join ' '
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $false
    $startInfo.RedirectStandardInput = $true

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) {
            throw 'Could not start the SSH client.'
        }
        $process.StandardInput.Write($normalizedScript)
        $process.StandardInput.Close()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) {
            throw "Remote VPS operation failed with exit code $($process.ExitCode)."
        }
    }
    catch {
        if (-not $process.HasExited) {
            try {
                $process.Kill()
                $process.WaitForExit()
            }
            catch {
                Write-Warning 'The SSH process could not be stopped after a failed remote operation.'
            }
        }
        throw
    }
    finally {
        $process.Dispose()
    }
}

function Read-RequiredValue {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $value = (Read-Host $Prompt).Trim()
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^(your[-_]|placeholder|example)' -or $value -match '[\r\n]') {
        throw "$Name is required and must be an actual configured value."
    }
    return $value
}

function Confirm-RemoteSudo {
    $sudoProbe = 'sudo -n true'
    Invoke-RemoteScript $sudoProbe
}

Write-Host 'HASA GOLD STORE API deployment preflight'
Write-Host 'This deploys only the standalone API. It does not change the frontend, Vercel, Firestore rules, or DNS.'

if ($PSVersionTable.PSVersion.Major -lt 5) {
    throw 'Windows PowerShell 5.1 or newer is required.'
}
foreach ($tool in @('ssh', 'scp', 'tar.exe', 'node', 'npm')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required local tool '$tool' was not found. Install/enable Windows OpenSSH Client and tar."
    }
}
if (-not (Test-Path -LiteralPath $SshKey -PathType Leaf)) {
    throw "SSH key not found at $SshKey. The private key remains on this PC and must not be uploaded."
}

$ApiDirectory = $PSScriptRoot
foreach ($file in $ApiFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $ApiDirectory $file))) {
        throw "Required deployment file is missing: $file"
    }
}
Push-Location $ApiDirectory
try {
    Write-Host 'Installing the exact locked local dependencies...'
    & npm ci
    Assert-NativeSuccess 'Local npm ci'

    Write-Host 'Running local API tests...'
    & npm test
    Assert-NativeSuccess 'Local API tests'

    Write-Host 'Auditing production dependencies...'
    & npm audit --omit=dev --audit-level=moderate
    Assert-NativeSuccess 'Production dependency audit'

    Write-Host 'Checking JavaScript and PM2 configuration syntax...'
    $sourceFiles = Get-ChildItem -LiteralPath (Join-Path $ApiDirectory 'src') -Filter '*.js' -File -Recurse
    foreach ($sourceFile in $sourceFiles) {
        & node --check $sourceFile.FullName
        Assert-NativeSuccess "Syntax check for $($sourceFile.Name)"
    }
    & node --check (Join-Path $ApiDirectory 'ecosystem.config.cjs')
    Assert-NativeSuccess 'PM2 configuration syntax check'
}
finally {
    Pop-Location
}

$FirebaseProjectId = Read-RequiredValue -Prompt 'Firebase project ID (must match the service account)' -Name 'Firebase project ID'
if ($FirebaseProjectId -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') {
    throw 'Firebase project ID format is invalid.'
}

$AdminUids = Read-RequiredValue -Prompt 'Existing Firebase administrator UID(s), comma-separated' -Name 'ADMIN_UIDS'
$adminUidList = @($AdminUids.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($adminUidList.Count -eq 0 -or @($adminUidList | Where-Object { $_.Length -gt 128 -or $_ -match '[\x00-\x1f]' }).Count -gt 0) {
    throw 'ADMIN_UIDS must contain valid Firebase UIDs (up to 128 characters) separated by commas.'
}
$AdminUids = $adminUidList -join ','

$AllowedOriginsInput = Read-RequiredValue -Prompt 'Allowed frontend origins, comma-separated (include scheme, e.g. https://hasagold.store)' -Name 'API_ALLOWED_ORIGINS'
$originList = @($AllowedOriginsInput.Split(',') | ForEach-Object { $_.Trim().TrimEnd('/') } | Where-Object { $_ })
if ($originList.Count -eq 0) {
    throw 'Provide at least one production HTTPS origin.'
}
foreach ($origin in $originList) {
    $parsedOrigin = $null
    if (-not [Uri]::TryCreate($origin, [UriKind]::Absolute, [ref]$parsedOrigin) -or
        $parsedOrigin.Scheme -ne 'https' -or
        [string]::IsNullOrWhiteSpace($parsedOrigin.Host) -or
        -not [string]::IsNullOrEmpty($parsedOrigin.UserInfo) -or
        $parsedOrigin.AbsolutePath -ne '/' -or
        $parsedOrigin.Query -or
        $parsedOrigin.Fragment) {
        throw "Invalid allowed origin '$origin'. Use exact HTTPS origins without a path, query, or fragment."
    }
}
$AllowedOrigins = $originList | Select-Object -Unique
$AllowedOrigins = $AllowedOrigins -join ','

$CertificateEmail = Read-RequiredValue -Prompt 'Email address for Let''s Encrypt certificate notices' -Name 'Certificate email'
try {
    $parsedEmail = [System.Net.Mail.MailAddress]::new($CertificateEmail)
    if ($parsedEmail.Address -cne $CertificateEmail) {
        throw 'Use an email address without a display name.'
    }
}
catch {
    throw 'A valid plain email address is required for Let''s Encrypt.'
}

$ServiceAccountPath = Read-RequiredValue -Prompt 'Local path to a current, non-revoked Firebase service-account JSON file' -Name 'Service-account file path'
if (-not (Test-Path -LiteralPath $ServiceAccountPath -PathType Leaf)) {
    throw 'The specified service-account file does not exist.'
}
$ServiceAccountPath = (Resolve-Path -LiteralPath $ServiceAccountPath).Path
try {
    $serviceAccount = Get-Content -LiteralPath $ServiceAccountPath -Raw | ConvertFrom-Json
}
catch {
    throw 'The selected service-account file is not valid JSON.'
}
if ($serviceAccount.project_id -ne $FirebaseProjectId -or
    [string]::IsNullOrWhiteSpace([string]$serviceAccount.client_email) -or
    [string]::IsNullOrWhiteSpace([string]$serviceAccount.private_key)) {
    Remove-Variable serviceAccount -ErrorAction SilentlyContinue
    throw 'The service-account file is incomplete or its project ID does not match.'
}
Remove-Variable serviceAccount -ErrorAction SilentlyContinue

$originBytes = [Text.Encoding]::UTF8.GetBytes($AllowedOrigins)
$originHash = [Convert]::ToBase64String($originBytes)
$adminHash = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($AdminUids))
$certificateEmailHash = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($CertificateEmail))
Write-Host 'Review deployment settings (no credentials are shown):'
Write-Host "  Firebase project: $FirebaseProjectId"
Write-Host "  Administrator UID count: $($adminUidList.Count)"
Write-Host "  Allowed origin count: $($originList.Count)"
Write-Host '  Firebase service-account file: selected (path hidden)'
if ((Read-Host 'Continue with deployment? Type DEPLOY to proceed') -cne 'DEPLOY') {
    throw 'Deployment cancelled.'
}

Write-Host 'Checking public DNS before connecting...'
$resolvedAddresses = @([System.Net.Dns]::GetHostAddresses($Domain) | ForEach-Object { $_.IPAddressToString })
if ($resolvedAddresses -notcontains $VpsHost) {
    throw "DNS for $Domain does not currently resolve to $VpsHost."
}

Write-Host 'Checking SSH authentication and VPS prerequisites...'
$vpsProbe = @'
set -euo pipefail
test "$(id -un)" = ubuntu
test "$(node --version)" = v24.22.2
test "$(npm --version)" = 11.19.1
command -v pm2 >/dev/null
command -v nginx >/dev/null
command -v curl >/dev/null
sudo -n true
if pm2 describe hasa-gold-api >/dev/null 2>&1; then
  pm2 jlist | node -e 'let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{const apps=JSON.parse(s); const app=apps.find(x=>x.name==="hasa-gold-api"); const seen=(v)=>{if(!v||typeof v!=="object") return false; for(const [k,x] of Object.entries(v)){if(k==="NEXAURA_API_KEY" && typeof x==="string" && x.length) return true; if(seen(x)) return true;} return false;}; if(app&&seen(app.pm2_env)){console.error("The existing PM2 API process has a Nexaura key in its environment; refusing deployment."); process.exit(1);}})'
fi
hostname
printf 'VPS preflight passed.\n'
'@
Invoke-RemoteScript $vpsProbe

Confirm-RemoteSudo

$runId = [Guid]::NewGuid().ToString('N')
$remoteStage = "/home/ubuntu/.hasa-gold-api-deploy-$runId"
$remoteArchive = "$remoteStage/api.tar.gz"
$remoteServiceAccount = "$remoteStage/service-account.json"
$localArchive = Join-Path ([IO.Path]::GetTempPath()) "hasa-gold-api-$runId.tar.gz"
$remoteStageCreated = $false
$transactionStarted = $false
$deploymentSucceeded = $false
$rollbackCompleted = $false

try {
    Write-Host 'Creating a clean API archive (excluding .env, credentials, and node_modules)...'
    Push-Location $ApiDirectory
    try {
        & tar.exe -czf $localArchive -- @ApiFiles
        Assert-NativeSuccess 'API archive creation'
    }
    finally {
        Pop-Location
    }

    $prepareStageTemplate = @'
set -euo pipefail
app='@@APP_DIRECTORY@@'
stage='@@REMOTE_STAGE@@'
app_parent=$(dirname "$app")
mkdir -p "$app_parent"
test -w "$app_parent"
if test -e "$app"; then test -w "$app"; fi
mkdir -m 700 "$stage"
printf 'Private deployment staging directory created.\n'
'@
    $prepareStage = Expand-RemoteScript -Template $prepareStageTemplate -Values @{
        APP_DIRECTORY = $AppDirectory
        REMOTE_STAGE = $remoteStage
    }
    $remoteStageCreated = $true
    Invoke-RemoteScript $prepareStage

    Write-Host 'Uploading API archive and Firebase service-account file over SSH...'
    & scp -i $SshKey -o IdentitiesOnly=yes -o BatchMode=no -- $localArchive "${VpsUser}@${VpsHost}:$remoteArchive"
    Assert-NativeSuccess 'API archive upload'
    & scp -i $SshKey -o IdentitiesOnly=yes -o BatchMode=no -- $ServiceAccountPath "${VpsUser}@${VpsHost}:$remoteServiceAccount"
    Assert-NativeSuccess 'Firebase service-account upload'

    Write-Host 'Preparing and testing the release on the VPS...'
    $remoteInstallTemplate = @'
set -euo pipefail
stage='@@RELEASE_STAGE@@'
archive='@@REMOTE_ARCHIVE@@'
credential='@@REMOTE_CREDENTIAL@@'
project_id='@@FIREBASE_PROJECT_ID@@'
admin_uid_b64='@@ADMIN_UID_B64@@'
mkdir -m 700 "$stage"
chmod 600 "$credential" "$archive"
tar -xzf "$archive" -C "$stage"
test -f "$stage/package-lock.json"
node -e 'const p=require(process.argv[1]); if(p.name!=="hasa-gold-api") process.exit(1)' "$stage/package.json"
node -e 'const fs=require("fs"); const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(a.project_id!==process.argv[2] || !a.client_email || !a.private_key) process.exit(1)' "$credential" "$project_id"
cd "$stage"
npm ci --omit=dev
npm test
npm ls --omit=dev --depth=0
admin_uids=$(printf '%s' "$admin_uid_b64" | base64 -d)
FIREBASE_PROJECT_ID="$project_id" GOOGLE_APPLICATION_CREDENTIALS="$credential" node --input-type=module - "$admin_uids" <<'NODE'
import { getAdminAuth } from "./src/firebase.js";
const uids = process.argv[2].split(",");
const auth = getAdminAuth();
for (const uid of uids) {
  const user = await auth.getUser(uid);
  if (user.uid !== uid) process.exit(1);
}
console.log(`Verified ${uids.length} existing Firebase administrator account(s).`);
NODE
printf 'Staged release tests and Firebase credential verification passed.\n'
'@
    $remoteInstall = Expand-RemoteScript -Template $remoteInstallTemplate -Values @{
        RELEASE_STAGE = "$remoteStage/release"
        REMOTE_ARCHIVE = $remoteArchive
        REMOTE_CREDENTIAL = $remoteServiceAccount
        FIREBASE_PROJECT_ID = $FirebaseProjectId
        ADMIN_UID_B64 = $adminHash
    }
    Invoke-RemoteScript $remoteInstall

    Write-Host 'Creating rollback snapshot and preparing the new application directory...'
    $remoteTransactionTemplate = @'
set -euo pipefail
app='@@APP_DIRECTORY@@'
stage='@@REMOTE_STAGE@@'
backup="$stage/backup"
site='/etc/nginx/sites-available/api.hasagold.store'
enabled='/etc/nginx/sites-enabled/api.hasagold.store'
mkdir -m 700 "$backup"
if test -L "$app"; then
  printf 'Application directory is a symlink; refusing deployment.\n' >&2
  exit 1
fi
if test -e "$app" && ! test -d "$app"; then
  printf 'Application path is not a directory; refusing deployment.\n' >&2
  exit 1
fi
if test -L "$app/.env"; then
  printf 'Existing .env is a symlink; refusing to replace it.\n' >&2
  exit 1
fi
if test -f "$app/.env"; then
  node - "$app/.env" <<'NODE'
const fs = require("node:fs");
const allowed = new Set([
  "NODE_ENV",
  "PORT",
  "FIREBASE_PROJECT_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "ADMIN_UIDS",
  "API_ALLOWED_ORIGINS",
]);
for (const line of fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator <= 0 || !allowed.has(line.slice(0, separator).trim())) {
    console.error("Existing .env contains unmanaged settings; deployment will not overwrite it.");
    process.exit(1);
  }
}
NODE
fi
if test -e "$app" || test -L "$app"; then
  touch "$backup/app-original-present"
else
  touch "$backup/app-original-absent"
fi
if sudo -n test -L "$site"; then
  printf 'The Nginx site config is a symlink; refusing deployment.\n' >&2
  exit 1
elif sudo -n test -f "$site"; then
  sudo -n cp -a "$site" "$backup/nginx-site"
  touch "$backup/nginx-site-original"
else
  touch "$backup/nginx-site-absent"
fi
if sudo -n test -e "$enabled" || sudo -n test -L "$enabled"; then
  touch "$backup/nginx-enabled-original"
else
  touch "$backup/nginx-enabled-absent"
fi
if pm2 describe hasa-gold-api >/dev/null 2>&1; then
  touch "$backup/pm2-original-present"
else
  touch "$backup/pm2-original-absent"
fi
touch "$backup/transaction-started"
if test -d "$app"; then
  mv -- "$app" "$backup/app"
fi
if test ! -e "$app"; then
  mkdir -m 700 "$app"
fi
printf 'Rollback snapshot created; previous application files and credentials are preserved.\n'
'@
    $remoteTransaction = Expand-RemoteScript -Template $remoteTransactionTemplate -Values @{
        APP_DIRECTORY = $AppDirectory
        REMOTE_STAGE = $remoteStage
    }
    $transactionStarted = $true
    Invoke-RemoteScript $remoteTransaction

    Write-Host 'Installing the tested release and writing production configuration on the VPS...'
    $remoteConfigureTemplate = @'
set -euo pipefail
app='@@APP_DIRECTORY@@'
stage='@@RELEASE_STAGE@@'
credential='@@REMOTE_CREDENTIAL@@'
run_id='@@RUN_ID@@'
project_id='@@FIREBASE_PROJECT_ID@@'
origin_b64='@@ORIGIN_B64@@'
admin_b64='@@ADMIN_UIDS_B64@@'
printf '%s' "$origin_b64" | base64 -d > "$stage/origins.txt"
origins=$(cat "$stage/origins.txt")
rm "$stage/origins.txt"
admins=$(printf '%s' "$admin_b64" | base64 -d)
tmp_env="$app/.env.deploy-$run_id"
umask 077
trap 'rm -f -- "$tmp_env"' EXIT
printf 'NODE_ENV=production\nPORT=3000\nFIREBASE_PROJECT_ID=%s\nGOOGLE_APPLICATION_CREDENTIALS=%s/firebase-service-account.json\nADMIN_UIDS=%s\nAPI_ALLOWED_ORIGINS=%s\n' "$project_id" "$app" "$admins" "$origins" > "$tmp_env"
chmod 600 "$tmp_env"
if test -L "$app/.env"; then
  printf 'Existing .env is a symlink; refusing to replace it.\n' >&2
  exit 1
fi
cp -a "$stage/." "$app/"
mv -f "$credential" "$app/firebase-service-account.json"
chmod 600 "$app/firebase-service-account.json"
mv -f "$tmp_env" "$app/.env"
trap - EXIT
printf 'Production configuration installed with restricted permissions.\n'
'@
    $remoteConfigure = Expand-RemoteScript -Template $remoteConfigureTemplate -Values @{
        APP_DIRECTORY = $AppDirectory
        RELEASE_STAGE = "$remoteStage/release"
        REMOTE_CREDENTIAL = $remoteServiceAccount
        RUN_ID = $runId
        FIREBASE_PROJECT_ID = $FirebaseProjectId
        ORIGIN_B64 = $originHash
        ADMIN_UIDS_B64 = $adminHash
    }
    Invoke-RemoteScript $remoteConfigure

    Write-Host 'Starting or restarting the API with PM2...'
    $remotePm2 = @'
set -euo pipefail
cd /home/ubuntu/hasa-gold-api
if pm2 describe hasa-gold-api >/dev/null 2>&1; then
  env -u NEXAURA_API_KEY pm2 restart hasa-gold-api --update-env
else
  env -u NEXAURA_API_KEY pm2 start ecosystem.config.cjs
fi
if ! pm2 jlist | node -e 'let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{const apps=JSON.parse(s); const app=apps.find(x=>x.name==="hasa-gold-api"); const seen=(v)=>{if(!v||typeof v!=="object") return false; for(const [k,x] of Object.entries(v)){if(k==="NEXAURA_API_KEY" && typeof x==="string" && x.length) return true; if(seen(x)) return true;} return false;}; if(app&&seen(app.pm2_env)){console.error("Nexaura key detected in API process environment; refusing to serve with fulfillment enabled."); process.exit(1);}})'; then
  pm2 stop hasa-gold-api || true
  pm2 delete hasa-gold-api || true
  printf 'Removed the API process after detecting a Nexaura key.\n' >&2
  exit 1
fi
pm2 save
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3000/health >/dev/null; then
    curl --fail --silent http://127.0.0.1:3000/health
    printf '\nLocal health check passed.\n'
    exit 0
  fi
  sleep 2
done
pm2 logs hasa-gold-api --lines 50 --nostream
exit 1
'@
    Invoke-RemoteScript $remotePm2

    Write-Host 'Enabling PM2 startup at boot...'
    $remoteStartup = @'
set -euo pipefail
sudo -n env PATH="$PATH:/usr/bin" pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
systemctl is-enabled pm2-ubuntu
'@
    Invoke-RemoteScript $remoteStartup

    Write-Host 'Installing Nginx site only if no conflicting site exists...'
    $remoteNginxTemplate = @'
set -euo pipefail
site='/etc/nginx/sites-available/api.hasagold.store'
enabled='/etc/nginx/sites-enabled/api.hasagold.store'
provided='@@APP_DIRECTORY@@/nginx-api.hasagold.store.conf'
matches_file='@@REMOTE_STAGE@@/nginx-matches.txt'
sudo -n sh -c 'grep -R -l -E "server_name[[:space:]].*api\.hasagold\.store" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null || true' > "$matches_file"
conflict=0
while IFS= read -r candidate; do
  test -n "$candidate" || continue
  resolved=$(readlink -f "$candidate" || true)
  if test "$resolved" != "$site"; then conflict=1; fi
done < "$matches_file"
if test "$conflict" -ne 0; then
  printf 'A conflicting Nginx site already claims api.hasagold.store; refusing to overwrite it.\n' >&2
  cat "$matches_file" >&2
  exit 1
fi
if test -f "$site"; then
  if ! grep -Fq '# HASA GOLD STORE API managed site' "$site"; then
    printf 'An existing Nginx config at the API site path is not managed by this deployment; refusing to overwrite it.\n' >&2
    exit 1
  fi
  if ! test -L "$enabled" || test "$(readlink -f "$enabled")" != "$site"; then
    printf 'The managed Nginx config is not enabled as expected; refusing to change it.\n' >&2
    exit 1
  fi
else
  sudo -n install -m 644 "$provided" "$site"
  if ! test -e "$enabled"; then sudo -n ln -s "$site" "$enabled"; fi
fi
sudo -n nginx -t
sudo -n systemctl reload nginx
curl --fail --silent --show-error --max-time 5 -H 'Host: api.hasagold.store' http://127.0.0.1/health
printf '\nHTTP health check passed.\n'
'@
    $remoteNginx = Expand-RemoteScript -Template $remoteNginxTemplate -Values @{
        APP_DIRECTORY = $AppDirectory
        REMOTE_STAGE = $remoteStage
    }
    Invoke-RemoteScript $remoteNginx

    Write-Host 'Installing Certbot, issuing the certificate, and testing renewal...'
    $remoteCertbotTemplate = @'
set -euo pipefail
certificate_email=$(printf '%s' '@@CERTIFICATE_EMAIL_B64@@' | base64 -d)
if ! command -v certbot >/dev/null 2>&1; then
  sudo -n apt-get update
  sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
fi
sudo -n certbot --nginx --non-interactive --agree-tos --email "$certificate_email" -d 'api.hasagold.store'
sudo -n certbot renew --dry-run
sudo -n systemctl is-active certbot.timer
sudo -n certbot certificates
'@
    $remoteCertbot = Expand-RemoteScript -Template $remoteCertbotTemplate -Values @{
        CERTIFICATE_EMAIL_B64 = $certificateEmailHash
    }
    Invoke-RemoteScript $remoteCertbot

    Write-Host 'Checking production HTTPS endpoint...'
    $health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 30
    if ($health.status -ne 'ok' -or $health.service -ne 'hasa-gold-api') {
        throw 'The live HTTPS health endpoint returned an unexpected response.'
    }
    Write-Host "HTTPS health check passed: $HealthUrl"

    Write-Host 'Collecting final VPS status and recent logs...'
    $remoteFinal = @'
set -euo pipefail
printf '\nPM2 STATUS\n'
pm2 status
printf '\nNGINX STATUS\n'
systemctl is-active nginx
sudo -n nginx -t
printf '\nCERTBOT TIMER\n'
systemctl is-active certbot.timer
printf '\nLOCAL HEALTH\n'
curl --fail --silent http://127.0.0.1:3000/health
printf '\n\nHTTPS HEALTH\n'
curl --fail --silent https://api.hasagold.store/health
printf '\n\nRECENT PM2 LOGS\n'
pm2 logs hasa-gold-api --lines 30 --nostream
printf '\nRECENT NGINX ERROR LOGS\n'
sudo -n tail -n 30 /var/log/nginx/error.log
'@
    Invoke-RemoteScript $remoteFinal

    Write-Host ''
    Write-Host 'Deployment complete: the live HTTPS health check succeeded.'
    Write-Host "Public API: https://$Domain"
    Write-Host "Health: $HealthUrl"
    Write-Host 'Nexaura fulfillment was not configured or enabled by this script.'
    $deploymentSucceeded = $true
}
catch {
    if ($transactionStarted) {
        $remoteRollbackTemplate = @'
set -uo pipefail
app='@@APP_DIRECTORY@@'
stage='@@REMOTE_STAGE@@'
backup="$stage/backup"
site='/etc/nginx/sites-available/api.hasagold.store'
enabled='/etc/nginx/sites-enabled/api.hasagold.store'
if ! test -f "$backup/transaction-started"; then
  printf 'No live files were changed; rollback is not required.\n'
  exit 0
fi
failed=0
if test -f "$backup/app-original-present"; then
  if test -d "$backup/app"; then
    rm -rf -- "$app"
    if ! mv -- "$backup/app" "$app"; then
      printf 'Failed to restore the previous application directory.\n' >&2
      failed=1
    fi
  fi
elif test -f "$backup/app-original-absent"; then
  rm -rf -- "$app"
fi
if test -f "$backup/nginx-site-original"; then
  if sudo -n test -f "$site" && sudo -n cmp -s "$backup/nginx-site" "$site"; then
    :
  elif sudo -n test -f "$site" && ! sudo -n grep -Fq '# HASA GOLD STORE API managed site' "$site"; then
    printf 'Refusing to overwrite an unrecognized Nginx config during rollback.\n' >&2
    failed=1
  elif ! sudo -n install -m 644 "$backup/nginx-site" "$site.rollback" ||
       ! sudo -n mv -f -- "$site.rollback" "$site"; then
    printf 'Failed to restore the previous Nginx site config.\n' >&2
    failed=1
  fi
elif test -f "$backup/nginx-site-absent"; then
  if sudo -n test -f "$site" && sudo -n grep -Fq '# HASA GOLD STORE API managed site' "$site"; then
    sudo -n rm -f -- "$site"
  fi
fi
if test -f "$backup/nginx-enabled-absent" && sudo -n test -L "$enabled"; then
  if test "$(readlink -f "$enabled" 2>/dev/null || true)" = "$site"; then
    sudo -n rm -f -- "$enabled"
  fi
fi
if command -v pm2 >/dev/null 2>&1; then
  if test -f "$backup/pm2-original-present" && test -d "$app"; then
    if pm2 describe hasa-gold-api >/dev/null 2>&1; then
      if ! env -u NEXAURA_API_KEY pm2 restart hasa-gold-api --update-env; then
        pm2 delete hasa-gold-api >/dev/null 2>&1 || true
        if ! (cd "$app" && env -u NEXAURA_API_KEY pm2 start ecosystem.config.cjs); then
          printf 'Failed to restart the previous PM2 application after restoring its files.\n' >&2
          failed=1
        fi
      fi
    elif ! (cd "$app" && env -u NEXAURA_API_KEY pm2 start ecosystem.config.cjs); then
      printf 'Failed to start the previous PM2 application after restoring its files.\n' >&2
      failed=1
    fi
  elif pm2 describe hasa-gold-api >/dev/null 2>&1; then
    pm2 stop hasa-gold-api >/dev/null 2>&1 || true
    pm2 delete hasa-gold-api >/dev/null 2>&1 || true
  fi
  pm2 save >/dev/null 2>&1 || failed=1
fi
if sudo -n nginx -t >/dev/null 2>&1; then
  sudo -n systemctl reload nginx || failed=1
else
  printf 'Nginx configuration test failed after rollback.\n' >&2
  failed=1
fi
if test -f "$backup/pm2-original-present" && test -d "$app"; then
  if ! curl --fail --silent http://127.0.0.1:3000/health >/dev/null; then
    printf 'Previous API health check failed after rollback.\n' >&2
    failed=1
  fi
fi
if test "$failed" -ne 0; then
  exit 1
fi
printf 'Rollback completed; previous application files, .env, Firebase credentials, and Nginx config were restored.\n'
'@
        $remoteRollback = Expand-RemoteScript -Template $remoteRollbackTemplate -Values @{
            APP_DIRECTORY = $AppDirectory
            REMOTE_STAGE = $remoteStage
        }
        try {
            Write-Warning 'Deployment failed after the rollback snapshot was created. Restoring the previous application and configuration...'
            Invoke-RemoteScript $remoteRollback
            $rollbackCompleted = $true
        }
        catch {
            Write-Warning 'Automatic rollback did not complete successfully. The private deployment staging directory has been retained for recovery.'
        }
    }
    throw
}
finally {
    if (Test-Path -LiteralPath $localArchive) {
        Remove-Item -LiteralPath $localArchive -Force
    }
    if ($remoteStageCreated -and (-not $transactionStarted -or $deploymentSucceeded -or $rollbackCompleted)) {
        $remoteCleanupTemplate = @'
set -euo pipefail
target='@@REMOTE_STAGE@@'
case "$target" in
  /home/ubuntu/.hasa-gold-api-deploy-@@RUN_ID@@) rm -rf -- "$target" ;;
  *) printf 'Refusing to clean an unexpected deployment path.\n' >&2; exit 1 ;;
esac
'@
        $remoteCleanup = Expand-RemoteScript -Template $remoteCleanupTemplate -Values @{
            REMOTE_STAGE = $remoteStage
            RUN_ID = $runId
        }
        try {
            Invoke-RemoteScript $remoteCleanup
        }
        catch {
            Write-Warning 'Could not remove the private remote staging directory. Remove the named .hasa-gold-api-deploy-* directory on the VPS after confirming the deployed service remains healthy.'
        }
    }
}
