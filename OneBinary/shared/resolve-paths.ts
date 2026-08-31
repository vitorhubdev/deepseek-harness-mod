/**
 * Shared path resolution for OneBinary targets (Electron + Tauri).
 * Reuses the harness’ own boot contracts without forking them.
 * @module onebinary/shared/resolve-paths
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Where the packed harness lives at runtime.
 * Electron: `process.resourcesPath` (…/resources/app.asar or …/resources).
 * Tauri sidecar: `resourceDir()` resolved by Rust and passed as env `ONEBINARY_RESOURCE_DIR`.
 * Dev (tsx): falls back to the source checkout.
 */
export function getResourceRoot(): string {
  // Electron injects this global
  const electronResources = (globalThis as unknown as { process?: NodeJS.Process })?.process?.resourcesPath
  if (typeof electronResources === 'string' && electronResources.length > 0) return electronResources

  // Tauri sidecar passes this env
  const tauriResources = process.env.ONEBINARY_RESOURCE_DIR
  if (typeof tauriResources === 'string' && tauriResources.length > 0) return tauriResources

  // Dev fallback — source checkout, same logic as apps/cli/src/profile-boot.ts:74
  return fileURLToPath(new URL('../../apps/cli', import.meta.url))
}

/**
 * INSTALL_ANCHOR for loadProfile — must point at the CLI package.json that owns `dsh.profile.bundles`.
 * Mirrors apps/cli/src/profile-boot.ts:74 but branches on packaged vs dev.
 */
export function getInstallAnchor(): string {
  const root = getResourceRoot()
  // When packaged, Electron nests inside app.asar; Tauri sidecar mirrors that layout via extraResources
  // Try asar first, then plain resources dir, then dev fallback
  return join(root, 'apps/cli/package.json')
}

/**
 * bareModuleBaseUrl for Cordis Loader — where bare specifiers like '@deepseek-ai/dsh-llm' resolve
 * when the host owns the plugin closure (packaged exe), per packages/boot/app-boot/src/index.ts:772.
 */
export function getBareModuleBaseUrl(): string | undefined {
  const root = getResourceRoot()
  // In dev, let Loader resolve from profile dir (default). In packaged exe, own the closure.
  const isPackaged = typeof (globalThis as unknown as { process?: NodeJS.Process })?.process?.resourcesPath === 'string'
    || typeof process.env.ONEBINARY_RESOURCE_DIR === 'string'
  return isPackaged ? root : undefined
}

/**
 * Absolute dist index for the frontend-static fallback seat.
 * Mirrors packages/host/frontend-static/src/index.ts:62 `readFile(distIndex)` expectation.
 */
export function getDistIndex(): string {
  return join(getResourceRoot(), 'apps/web/dist/index.html')
}

/**
 * Allowlist check — ONEBINARY_RESOURCE_DIR must be absolute and inside the app bundle.
 * Prevents env injection from hijacking which harness the exe boots.
 */
export function assertSafeResourceDir(dir: string): void {
  if (!dir || !/^([A-Z]:\\|\/).*/.test(dir)) {
    throw new Error(`OneBinary: ONEBINARY_RESOURCE_DIR must be absolute, got ${JSON.stringify(dir)}`)
  }
}
