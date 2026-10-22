// Post-build step for Vercel deployments.
//
// The externalized Firebase Admin / Google Cloud packages must exist as real
// CommonJS packages inside the deployed function, but Nitro's dependency
// tracer copies only the files it deems reachable, leaving the function
// incomplete (missing entries such as protobufjs/minimal or whole packages
// like google-gax), which only surfaces as MODULE_NOT_FOUND on Vercel.
//
// This script runs after `vite build` and replaces the traced tree with full
// package trees plus their dependency closure from the project's node_modules.
// It must NOT be registered as a Nitro `compiled` hook: a user-defined hook
// shadows the Vercel preset's own compiled hook, which is what writes
// config.json and .vc-config.json into the Build Output API.
import fs from "node:fs";
import path from "node:path";

// --pre runs before `vite build`. Nitro's dependency tracer stages traced
// externals into .nf3 inside the function directory; re-running a build over
// a populated node_modules from the previous build collides with Windows
// file locks (EBUSY), so remove them and start clean. On Vercel the checkout
// is fresh and this is a no-op.
const functionDir = path.resolve(".vercel/output/functions/__server.func");
if (process.argv.includes("--pre")) {
  if (fs.existsSync(functionDir)) {
    fs.rmSync(path.join(functionDir, "node_modules"), { recursive: true, force: true });
    fs.rmSync(path.join(functionDir, ".nf3"), { recursive: true, force: true });
  }
  process.exit(0);
}

if (!fs.existsSync(functionDir)) {
  console.log("[vercel-postbuild] No Vercel function output found; skipping.");
  process.exit(0);
}

const seeds = [
  // firebase-admin itself must be a seed: the tracer leaves a partial copy
  // (CJS lib/ only), while the bundle imports its ESM entry
  // (lib/esm/app/index.js), which the partial copy lacks.
  "firebase-admin",
  "@google-cloud/firestore",
  "@google-cloud/storage",
  "google-gax",
  "@grpc/grpc-js",
  "@grpc/proto-loader",
  "protobufjs",
  "@opentelemetry/api",
  "functional-red-black-tree",
];

const rootNm = path.resolve("node_modules");
const fnNm = path.join(functionDir, "node_modules");

// The tracer's output is a partial, non-hoisted tree (for example
// google-gax/node_modules/@grpc/grpc-js without @js-sdsl/ordered-map). Node
// resolves nested copies first, so those partials shadow complete packages.
// Remove the whole traced tree and rebuild it from the project's real,
// self-consistent node_modules.
fs.rmSync(fnNm, { recursive: true, force: true });

const queue = [...seeds];
const visited = new Set();

// Version-conflict subtrees (e.g. google-gax needing a newer @grpc/grpc-js
// than the hoisted 1.9) travel nested inside their parent package, but their
// hoisted dependencies (like @js-sdsl/ordered-map) only exist at the project
// root and are NOT listed in the parent's manifest. Scan nested
// node_modules directories, read those manifests, and queue their
// dependencies as well, otherwise the nested copies crash on Vercel with
// MODULE_NOT_FOUND.
const collectNestedDeps = (packagesDir) => {
  let entries;
  try {
    entries = fs.readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      const scopeDir = path.join(packagesDir, entry.name);
      let scoped;
      try {
        scoped = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const sub of scoped) {
        if (sub.isDirectory()) queueNestedPackage(path.join(entry.name, sub.name), path.join(scopeDir, sub.name));
      }
      continue;
    }
    queueNestedPackage(entry.name, path.join(packagesDir, entry.name));
  }
};

// Reads the manifest of one nested package, queues its dependencies for the
// top-level copy, and recurses into that package's own nested node_modules.
function queueNestedPackage(name, nestedDir) {
  const nestedPkg = path.join(nestedDir, "package.json");
  if (!fs.existsSync(nestedPkg)) return;
  const manifest = JSON.parse(fs.readFileSync(nestedPkg, "utf8"));
  queue.push(...Object.keys(manifest.dependencies ?? {}));
  collectNestedDeps(path.join(nestedDir, "node_modules"));
}

while (queue.length > 0) {
  const name = queue.shift();
  if (visited.has(name)) continue;
  visited.add(name);
  const source = path.join(rootNm, name);
  const destination = path.join(fnNm, name);
  const sourcePkg = path.join(source, "package.json");
  if (!fs.existsSync(sourcePkg)) continue;
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(sourcePkg, "utf8"));
  queue.push(...Object.keys(manifest.dependencies ?? {}));
  collectNestedDeps(path.join(source, "node_modules"));
}

// Fail the build loudly instead of deploying a function that crashes on the
// first Firestore call. These paths cover every past production failure.
const required = [
  "firebase-admin/package.json",
  "firebase-admin/lib/esm/app/index.js",
  "@google-cloud/firestore/package.json",
  "@google-cloud/storage/package.json",
  "@grpc/grpc-js/package.json",
  "google-gax/package.json",
  "@js-sdsl/ordered-map/package.json",
  "protobufjs/minimal.js",
];
for (const rel of required) {
  if (!fs.existsSync(path.join(fnNm, rel))) {
    console.error(`[vercel-postbuild] Missing after copy: ${rel}`);
    process.exit(1);
  }
}

console.log(`[vercel-postbuild] Copied ${visited.size} packages into the server function.`);
