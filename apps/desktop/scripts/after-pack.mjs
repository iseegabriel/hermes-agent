/**
 * after-pack.mjs — electron-builder afterPack hook.
 *
 * Stamps the Hermes icon + identity onto the packed Windows Hermes.exe via
 * rcedit (delegated to set-exe-identity.mjs). This runs for EVERY packed build
 * — first install, `hermes desktop`, the installer's --update rebuild, and a
 * dev's manual `npm run pack` — so the branded exe can never silently revert
 * to the stock "Electron" icon/name (the bug when the stamp lived only in
 * install.ps1, which the update path doesn't use).
 *
 * Windows-only: rcedit edits PE resources, irrelevant on macOS/Linux where the
 * app identity comes from the bundle Info.plist / desktop entry. Best-effort:
 * a stamp failure must never fail an otherwise-good build (worst case is the
 * stock icon, not a broken app), so we log and resolve rather than throw.
 *
 * electron-builder passes a context with:
 *   - electronPlatformName: 'win32' | 'darwin' | 'linux'
 *   - appOutDir:            the unpacked app directory for this target
 *   - packager.appInfo.productFilename: the exe basename (e.g. 'Hermes')
 *   - packager.appInfo.productName:     the display name (e.g. 'Hermes Remote')
 */

import path from 'node:path'

import { stampExeIdentity } from './set-exe-identity.mjs'

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return
  }

  const appInfo = context.packager?.appInfo
  // The exe basename (no spaces, e.g. 'HermesRemote') and the display name
  // (e.g. 'Hermes Remote') differ for distribution variants, so read both:
  // the former locates the file, the latter brands its PE version resource.
  const productFilename = appInfo?.productFilename || 'Hermes'
  const productName = appInfo?.productName || productFilename
  const exe = path.join(context.appOutDir, `${productFilename}.exe`)
  const desktopRoot = path.resolve(import.meta.dirname, '..')

  try {
    await stampExeIdentity(exe, desktopRoot, { productName })
  } catch (err) {
    // Never fail the build over a cosmetic stamp.
    console.warn(`[after-pack] exe identity stamp failed (${err.message}); ${productFilename}.exe keeps the stock Electron icon`)
  }
}
