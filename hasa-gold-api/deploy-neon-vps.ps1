$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ── SAFETY GUARD ────────────────────────────────────────────────────────────
# This script re-syncs the frozen legacy Firestore catalog into Neon. The live
# store is Neon-only, so running this against production OVERWRITES current
# store_settings (payment methods, eZ Cash details, FAQs) with stale data.
# It is kept only for reference and must not run against the live database.
throw @'
STOPPED: deploy-neon-vps.ps1 re-syncs the frozen legacy Firestore catalog into
Neon and will overwrite live store settings (payment methods, eZ Cash details,
FAQs). The live API is Neon-only and does not need this script.

To deploy backend code, copy the changed files in hasa-gold-api/src to
/var/www/hasa-gold-api/src and run: pm2 restart hasa-gold-api --update-env
To apply a schema change, run the SQL in hasa-gold-api/sql/migrations via psql.
'@

$VpsHost = '137.23.42.221'
$VpsUser = 'ubuntu'
$AppDirectory = '/var/www/hasa-gold-api'
$SshKey = Join-Path $env:USERPROFILE '.ssh\pathum-topup-vps'
$RunId = [Guid]::NewGuid().ToString('N')
$RemoteStage = "/var/www/.hasa-gold-api-neon-$RunId"
$RemoteArchive = "/home/ubuntu/.hasa-gold-api-neon-$RunId.tar.gz"
$LocalArchive = Join-Path ([IO.Path]::GetTempPath()) "hasa-gold-api-neon-$RunId.tar.gz"
$ApiFiles = @(
    'package.json',
    'package-lock.json',
    'src',
    'sql',
    'ecosystem.config.cjs'
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
            if ($slashes -gt 0) { [void]$builder.Append(('\' * (2 * $slashes))) }
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
    if ($slashes -gt 0) { [void]$builder.Append(('\' * (2 * $slashes))) }
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
        throw "Remote script has an unresolved token: $($matches[0])"
    }
    return $expanded
}

function Invoke-RemoteScript {
    param([Parameter(Mandatory = $true)][string]$Script)

    $normalized = $Script.Replace("`r`n", "`n").Replace("`r", "`n")
    if (-not $normalized.EndsWith("`n")) { $normalized += "`n" }
    $sshCommand = 'bash -c ''set -euo pipefail; tmp=$(mktemp); trap "rm -f -- \"$tmp\"" EXIT; cat > "$tmp"; bash -n "$tmp"; bash "$tmp"'''
    $arguments = @(
        '-i', $SshKey,
        '-o', 'IdentitiesOnly=yes',
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=15',
        "$VpsUser@$VpsHost",
        $sshCommand
    )
    $quoted = @($arguments | ForEach-Object {
        ConvertTo-WindowsCommandLineArgument -Value ([string]$_)
    })
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Get-Command ssh -ErrorAction Stop).Source
    $startInfo.Arguments = $quoted -join ' '
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) { throw 'Could not start the SSH client.' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write($normalized)
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(600000)) {
            $process.Kill()
            throw 'The remote operation exceeded the 10-minute limit.'
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        if ($stdout) { Write-Host $stdout.TrimEnd() }
        if ($process.ExitCode -ne 0) {
            if ($stderr) { Write-Host $stderr.TrimEnd() }
            throw "Remote VPS operation failed with exit code $($process.ExitCode)."
        }
        if ($stderr) { Write-Host $stderr.TrimEnd() }
    }
    finally {
        $process.Dispose()
    }
}

foreach ($tool in @('ssh', 'scp', 'tar.exe', 'node', 'npm')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required local tool '$tool' was not found."
    }
}
if (-not (Test-Path -LiteralPath $SshKey -PathType Leaf)) {
    throw "SSH key not found at $SshKey."
}
foreach ($file in $ApiFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $file))) {
        throw "Required deployment file is missing: $file"
    }
}

Write-Host 'Running local API tests and syntax checks.'
Push-Location $PSScriptRoot
try {
    & npm test
    Assert-NativeSuccess 'Local API tests'
    $sourceFiles = Get-ChildItem (Join-Path $PSScriptRoot 'src') -Filter '*.js' -File -Recurse
    foreach ($sourceFile in $sourceFiles) {
        & node --check $sourceFile.FullName
        Assert-NativeSuccess "Syntax check for $($sourceFile.Name)"
    }
    & node --check (Join-Path $PSScriptRoot 'scripts\migrate-firestore-to-neon.js')
    Assert-NativeSuccess 'Migration script syntax check'
}
finally {
    Pop-Location
}

Write-Host 'Checking VPS access and required server-side configuration (values remain hidden).'
$preflight = @'
set -euo pipefail
app='/var/www/hasa-gold-api'
test "$(id -un)" = ubuntu
test -d "$app"
test -f "$app/.env"
test ! -L "$app/.env"
sudo -n true
node --env-file="$app/.env" --input-type=module - "$app" <<'NODE'
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const app = process.argv[2];
for (const key of ["DATABASE_URL", "FIREBASE_PROJECT_ID", "GOOGLE_APPLICATION_CREDENTIALS", "ADMIN_UIDS", "API_ALLOWED_ORIGINS"]) {
  if (!process.env[key]?.trim()) throw new Error(`Missing required backend setting: ${key}`);
}
if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL)) throw new Error("DATABASE_URL is not a PostgreSQL connection string.");
const credentialPath = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
if (credentialPath !== resolve(app, "firebase-service-account.json")) throw new Error("Firebase credential path does not match the deployed service account location.");
const credential = JSON.parse(await readFile(credentialPath, "utf8"));
if (credential.project_id !== process.env.FIREBASE_PROJECT_ID || !credential.client_email || !credential.private_key) {
  throw new Error("Firebase service-account configuration is invalid.");
}
const allowedOrigins = process.env.API_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
const isAllowedOrigin = (origin) => {
  try {
    const url = new URL(origin);
    const httpsOrigin = url.protocol === "https:" && url.origin === origin;
    const loopbackOrigin = url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.origin === origin;
    return httpsOrigin || loopbackOrigin;
  } catch {
    return false;
  }
};
if (!allowedOrigins.every(isAllowedOrigin)) {
  throw new Error("API origins must use HTTPS, except exact localhost or loopback origins.");
}
console.log("Required Neon and Firebase server configuration is present and valid.");
NODE
if ! pm2 describe hasa-gold-api >/dev/null 2>&1; then
  printf 'The expected PM2 API process was not found.\n' >&2
  exit 1
fi
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="hasa-gold-api");if(!p||p.pm2_env.status!=="online"||p.pm2_env.pm_cwd!=="/var/www/hasa-gold-api"){console.error("The expected API process is not online from /var/www/hasa-gold-api.");process.exit(1)}console.log("Existing production API process is online.")})'
'@
Invoke-RemoteScript $preflight

$remoteStageCreated = $false
$deploymentSucceeded = $false
try {
    Write-Host 'Preparing a private release directory and uploading only API source files.'
    Push-Location $PSScriptRoot
    try {
        & tar.exe -czf $LocalArchive -- @ApiFiles
        Assert-NativeSuccess 'API archive creation'
    }
    finally {
        Pop-Location
    }

    $prepare = Expand-RemoteScript -Template @'
set -euo pipefail
stage='@@STAGE@@'
archive='@@ARCHIVE@@'
sudo -n install -d -o ubuntu -g ubuntu -m 700 "$stage"
mkdir -m 700 "$stage/release"
printf 'Private release directory created.\n'
'@ -Values @{ STAGE = $RemoteStage; ARCHIVE = $RemoteArchive }
    Invoke-RemoteScript $prepare
    $remoteStageCreated = $true

    & scp -i $SshKey -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -- $LocalArchive "${VpsUser}@${VpsHost}:$RemoteArchive"
    Assert-NativeSuccess 'API archive upload'

    Write-Host 'Installing and testing the staged release against the configured Neon and Firebase projects.'
    $stageAndPreflight = Expand-RemoteScript -Template @'
set -euo pipefail
app='/var/www/hasa-gold-api'
stage='@@STAGE@@'
archive='@@ARCHIVE@@'
release="$stage/release"
backup="/var/backups/hasa-gold-api-neon-@@RUN_ID@@"
sudo -n install -d -o ubuntu -g ubuntu -m 700 "$backup"
tar -xzf "$archive" -C "$release"
cd "$release"
npm ci
npm test
npm prune --omit=dev
npm ls --omit=dev --depth=0
cp -a "$app/.env" "$release/.env"
credential_path=$(node --env-file="$release/.env" -p 'process.env.GOOGLE_APPLICATION_CREDENTIALS')
cp -a "$credential_path" "$release/firebase-service-account.json"
chmod 600 "$release/.env" "$release/firebase-service-account.json"
node --env-file="$release/.env" --input-type=module <<'NODE'
import pg from "pg";
import { getAdminAuth } from "./src/firebase.js";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: process.env.DATABASE_SSL_STRICT !== "false" },
  connectionTimeoutMillis: 10000,
});
try {
  const result = await pool.query("SELECT (SELECT count(*) FROM games)::int AS games, (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM orders)::int AS orders");
  if (!result.rows[0].games || !result.rows[0].products || !result.rows[0].users) throw new Error("Neon data preflight found an empty required table.");
  console.log(`Neon reachable; games=${result.rows[0].games}, products=${result.rows[0].products}, users=${result.rows[0].users}, orders=${result.rows[0].orders}.`);
  const auth = getAdminAuth();
  await auth.listUsers(1);
  console.log("Firebase Authentication service-account access passed.");
} finally {
  await pool.end();
}
NODE
node --env-file="$release/.env" scripts/migrate-firestore-to-neon.js --dry-run
printf 'Staged release, Neon data, and Firebase Authentication preflight passed.\n'
'@ -Values @{ STAGE = $RemoteStage; ARCHIVE = $RemoteArchive; RUN_ID = $RunId }
    Invoke-RemoteScript $stageAndPreflight

    Write-Host 'Freezing API writes, reconciling the latest Firestore snapshot, then switching the API to Neon.'
    $cutover = Expand-RemoteScript -Template @'
set -euo pipefail
app='/var/www/hasa-gold-api'
stage='@@STAGE@@'
archive='@@ARCHIVE@@'
release="$stage/release"
old_app="$stage/previous-app"
backup="/var/backups/hasa-gold-api-neon-@@RUN_ID@@"
stopped=0
swapping=0
success=0

rollback() {
  rc=$?
  trap - EXIT
  if test "$rc" -ne 0 && test "$success" -ne 1; then
    printf 'Cutover failed; restoring the previous API.\n' >&2
    set +e
    if test "$swapping" -gt 0; then
      pm2 delete hasa-gold-api >/dev/null 2>&1
      if test -d "$app"; then sudo -n mv -- "$app" "$stage/failed-release"; fi
      if test -d "$old_app"; then sudo -n mv -- "$old_app" "$app"; fi
      sudo -n chown -R ubuntu:ubuntu "$app"
      (cd "$app" && pm2 start ecosystem.config.cjs)
      pm2 save
    elif test "$stopped" -eq 1; then
      pm2 restart hasa-gold-api --update-env
    fi
    exit "$rc"
  fi
}
trap rollback EXIT

sudo -n cp -a "$app" "$backup/app"
sudo -n chmod 700 "$backup" "$backup/app"
pm2 stop hasa-gold-api
stopped=1
cd "$release"
node --env-file="$app/.env" scripts/migrate-firestore-to-neon.js --sync
swapping=1
sudo -n mv -- "$app" "$old_app"
sudo -n mv -- "$release" "$app"
sudo -n chown -R ubuntu:ubuntu "$app"
chmod 600 "$app/.env" "$app/firebase-service-account.json"
pm2 delete hasa-gold-api
cd "$app"
pm2 start ecosystem.config.cjs
pm2 save
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/health >/dev/null; then break; fi
  sleep 2
done
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/health
node --input-type=module <<'NODE'
const response = await fetch("http://127.0.0.1:3000/v1/catalog");
if (!response.ok) throw new Error(`Catalog endpoint returned HTTP ${response.status}.`);
const catalog = await response.json();
if (!catalog.games?.length || !catalog.products?.length || !catalog.settings) throw new Error("Neon-backed catalog response is incomplete.");
console.log(`Neon-backed catalog passed: ${catalog.games.length} games, ${catalog.products.length} products, settings loaded.`);
NODE
curl --fail --silent --show-error --max-time 20 https://api.hasagold.store/health
printf '\nPM2 status:\n'
pm2 status
printf '\nNeon API cutover and public HTTPS health check passed.\n'
printf 'Rollback backup: %s\n' "$backup/app"
success=1
trap - EXIT
sudo -n rm -rf -- "$old_app"
sudo -n rm -f -- "$archive"
sudo -n rm -rf -- "$stage"
'@ -Values @{ STAGE = $RemoteStage; ARCHIVE = $RemoteArchive; RUN_ID = $RunId }
    Invoke-RemoteScript $cutover
    $deploymentSucceeded = $true
}
finally {
    if (Test-Path -LiteralPath $LocalArchive) {
        Remove-Item -LiteralPath $LocalArchive -Force
    }
    if ($remoteStageCreated -and $deploymentSucceeded) {
        Write-Host 'The VPS release staging directory and temporary archive were removed.'
    }
    elseif ($remoteStageCreated) {
        Write-Warning "Remote recovery files were retained under $RemoteStage and $RemoteArchive."
    }
}
