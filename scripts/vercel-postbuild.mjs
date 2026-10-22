// Post-build step for Vercel deployments.
//
// The externalized Firebase Admin / Google Cloud packages must exist as real
// CommonJS packages inside the deployed function, but Nitro's dependency
// tracer copies only the files it deems reachable, leaving the function
// incomplete (missing entries such as protobufjs/minimal or whole packages
// like google-gax), which only surfaces as MODULE_NOT_FOUND on Vercel.
//
// This script runs after `vite build` and replaces the traced copies with
// full package trees plus their dependency closure from the project's
// node_modules. It must NOT be registered as a Nitro `compiled` hook: a
// user-defined hook shadows the Vercel preset's own compiled hook, which is
// what writes config.json and .vc-config.json into the Build Output API.
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
const destNm = path.join(functionDir, "node_modules");
const queue = [...seeds];
const visited = new Set();

while (queue.length > 0) {
  const name = queue.shift();
  if (visited.has(name)) continue;
  visited.add(name);
  const source = path.join(rootNm, name);
  const destination = path.join(destNm, name);
  const sourcePkg = path.join(source, "package.json");
  if (!fs.existsSync(sourcePkg)) continue;
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(sourcePkg, "utf8"));
  queue.push(...Object.keys(manifest.dependencies ?? {}));
}

console.log(`[vercel-postbuild] Copied ${visited.size} packages into the server function.`);
