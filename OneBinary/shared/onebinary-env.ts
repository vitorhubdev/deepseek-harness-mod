/**
 * Environment isolation for OneBinary — DSH_HOME stays external so sessions survive reboot.
 * @module onebinary/shared/onebinary-env
 */

import { join } from 'node:path'
import { homedir } from 'node:os'

/**
 * Resolve external DSH_HOME for a packaged app.
 * Precedence: explicit env DSH_HOME > Electron userData/.dsh > ~/.dsh.
 * Electron's app.getPath('userData') is passed in; Tauri uses appDataDir().
 * This mirrors packages/util/home-paths/src/index.ts:94 resolveDshHome().
 */
export function resolveOneBinaryDshHome(electronUserData?: string): string {
  const fromEnv = process.env.DSH_HOME
  if (fromEnv !== undefined && fromEnv.trim().length > 0) return fromEnv

  if (electronUserData !== undefined && electronUserData.length > 0) {
    // Keep it beside the Electron userData but namespaced, so uninstall doesn't nuke sessions
    return join(electronUserData, '.dsh')
  }

  // Fallback — same as defaultDshHome()
  return join(homedir(), '.dsh')
}

/**
 * Guard: refuse to boot if DSH_HOME resolves inside the read-only bundle.
 * Prevents accidental session loss when packager misconfigures paths.
 */
export function assertDshHomeExternal(dshHome: string, resourceRoot: string): void {
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase()
  if (norm(dshHome).startsWith(norm(resourceRoot).replace(/\/$/, '') + '/')) {
    throw new Error(`OneBinary: DSH_HOME must be outside resources, got ${dshHome} inside ${resourceRoot}`)
  }
}
