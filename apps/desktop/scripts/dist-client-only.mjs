#!/usr/bin/env node
// Hermes Remote (client-only) distribution.
//
// Produces an installer / unpacked build that contains NO Hermes runtime and
// never attempts to install one: the renderer shows only remote-connection
// flows, and the main process is baked with HERMES_DESKTOP_CLIENT_ONLY=1 so
// every local-runtime discovery/adoption/bootstrap path is disabled.
//
// Usage (run from apps/desktop):
//   node scripts/dist-client-only.mjs            # --win nsis (default)
//   node scripts/dist-client-only.mjs msi        # --win msi
//   node scripts/dist-client-only.mjs --dir      # unpacked win dir
//
// Steps:
//   1. `npm run build` with HERMES_DESKTOP_CLIENT_ONLY=1 so
//      bundle-electron-main.mjs bakes the client-only flag into the bundle.
//   2. Invoke the existing electron-builder runner (run-electron-builder.mjs,
//      which pins --publish never and reuses the local electron dist) with the
//      Hermes Remote product identity as CLI config overrides. Everything else
//      (files, asar, icons, beforePack/afterPack hooks, protocols) comes from
//      package.json's `build` block untouched.

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const cliArgs = process.argv.slice(2)
const targetArg = cliArgs.find(arg => arg === "msi" || arg === "nsis" || arg === "--dir") || "nsis"
const winTarget = targetArg === "msi" ? "msi" : targetArg === "--dir" ? "dir" : "nsis"
// Output dir override (--out=<dir>). Defaults to release-remote; the override
// exists so a locked/partially-deleted release dir (a stale handle on
// win-unpacked/resources/app.asar) can be worked around without touching it.
const outArg = cliArgs.find(arg => arg.startsWith("--out="))
const outputDir = outArg ? outArg.slice("--out=".length).trim() || "release-remote" : "release-remote"

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
  "-c.artifactName=HermesRemote-${version}-${os}-${arch}.${ext}",
  `-c.directories.output=${outputDir}`,
  "-c.extraMetadata.productName=Hermes Remote",
  "-c.win.legalTrademarks=Hermes Remote",
  "-c.nsis.shortcutName=Hermes Remote",
  "-c.nsis.uninstallDisplayName=Hermes Remote"
]

run(`packing win/${winTarget} as "Hermes Remote"`, process.execPath, [runner, ...builderArgs])

console.log(`[dist-client-only] done — Hermes Remote win/${winTarget} in ${path.join(root, outputDir)}`)
