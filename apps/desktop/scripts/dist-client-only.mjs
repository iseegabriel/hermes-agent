#!/usr/bin/env node
// Hermes Remote (client-only) distribution.
//
// Produces a portable Windows build that contains NO Hermes runtime and never
// attempts to install one: the renderer shows only remote-connection flows,
// and the main process is baked with HERMES_DESKTOP_CLIENT_ONLY=1 so every
// local-runtime discovery/adoption/bootstrap path is disabled.
//
// Upstream replaced the NSIS/MSI Windows targets with a prepared-packaging
// flow whose only installer format is msix (requires Nous' Azure signing
// kit), so a classic setup.exe is no longer buildable: this script ships the
// portable zip from electron-builder's `zip` target (plus --dir for an
// unpacked tree).
//
// Usage (run from apps/desktop):
//   node scripts/dist-client-only.mjs          # --win zip (default)
//   node scripts/dist-client-only.mjs --dir    # unpacked win dir
//   node scripts/dist-client-only.mjs --out=<dir>
//
// Steps:
//   1. `npm run build` with HERMES_DESKTOP_CLIENT_ONLY=1 so
//      bundle-electron-main.mjs bakes the client-only flag into the bundle.
//   2. Invoke run-electron-builder.mjs (source mode: stages native deps and
//      packaging tools, then runs electron-builder pinned to --publish never)
//      with the Hermes Remote product identity as CLI config overrides. The
//      runner's prepared-packaging admission list carries a Hermes Remote
//      exception for exactly these branding/artifact overrides.

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const cliArgs = process.argv.slice(2)
if (cliArgs.some(arg => arg === "nsis" || arg === "msi")) {
  console.error("[dist-client-only] nsis/msi targets were removed upstream (Windows is msix/zip/dir only); use the default zip target")
  process.exit(1)
}
const outputDirArg = cliArgs.find(arg => arg.startsWith("--out="))
const outputDir = outputDirArg ? outputDirArg.slice("--out=".length).trim() || "release-remote" : "release-remote"
const winTarget = cliArgs.includes("--dir") ? "dir" : "zip"

function run(description, command, args, options = {}) {
  console.log(`[dist-client-only] ${description}`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options
  })
  if (result.error) {
    console.error(`[dist-client-only] spawn failed: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`[dist-client-only] ${description} exited with code ${result.status}`)
    process.exit(result.status == null ? 1 : result.status)
  }
}

// Step 1: build with the client-only flag baked in. `npm run build` runs the
// package.json `prebuild` lifecycle (clean) automatically.
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
run("building app with HERMES_DESKTOP_CLIENT_ONLY=1", npmBin, ["run", "build"], {
  env: { ...process.env, HERMES_DESKTOP_CLIENT_ONLY: "1" },
  shell: process.platform === 'win32'
})

// Step 2: pack under the Hermes Remote identity. Config overrides ride the
// electron-builder CLI (dot-path -c options) — spawned without a shell, so
// spaces and ${macro} in values need no quoting.
const runner = path.join(root, "scripts", "run-electron-builder.mjs")
const builderArgs = [
  "--win",
  winTarget,
  "-c.productName=Hermes Remote",
  "-c.appId=com.nousresearch.hermes-remote",
  "-c.executableName=HermesRemote",
  "-c.artifactName=HermesRemote-${version}-${os}-${arch}-portable.${ext}",
  `-c.directories.output=${outputDir}`,
  "-c.extraMetadata.productName=Hermes Remote",
  "-c.win.legalTrademarks=Hermes Remote"
]

run(`packing win/${winTarget} as "Hermes Remote"`, process.execPath, [runner, ...builderArgs])

console.log(`[dist-client-only] done — Hermes Remote win/${winTarget} in ${path.join(root, outputDir)}`)
