import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

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
  const absHome = resolve(dshHome)
  const absResource = resolve(resourceRoot)
  const isWindows = process.platform === 'win32' || process.platform === 'cygwin'
  const targetHome = isWindows ? absHome.toLowerCase() : absHome
  const targetResource = isWindows ? absResource.toLowerCase() : absResource

  const rel = relative(targetResource, targetHome)
  const isInside = rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
  if (isInside) {
    throw new Error(`OneBinary: DSH_HOME must be outside resources, got ${dshHome} inside ${resourceRoot}`)
  }
}
