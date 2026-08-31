/**
 * OneBinary Electron main — single-file harness without forking packages/*.
 * Reuses the harness’ own profile boot verbatim: runProfile() from apps/cli.
 * @module onebinary/electron/main
 */

import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { getBareModuleBaseUrl, getDistIndex, getInstallAnchor, getResourceRoot } from '../../shared/resolve-paths.ts'
import { assertDshHomeExternal, resolveOneBinaryDshHome } from '../../shared/onebinary-env.ts'

// ---------------------------------------------------------------------------
// Single instance — second double-click focuses the existing window
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) app.quit()

// DSH_HOME must be set BEFORE loadLayeredEnv() and before any dsh-home-paths import resolves.
// This preserves sessions/plugins across close/reopen even when the exe is replaced.
const resourceRoot = getResourceRoot()
const externalHome = resolveOneBinaryDshHome(app.getPath('userData'))
if (!process.env.DSH_HOME) process.env.DSH_HOME = externalHome
assertDshHomeExternal(process.env.DSH_HOME, resourceRoot)

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let win: BrowserWindow | undefined

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.js'),
      contextIsolation: true, // default true since Electron 12 — keep isolation, expose via contextBridge
      nodeIntegration: false,
      sandbox: true, // Electron 44: enables blink sandbox + disables Node in renderer
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    autoHideMenuBar: true,
  })

  win.once('ready-to-show', () => win?.show())

  // External links → OS browser, not inside the harness webview
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // The harness web server will tell us its URL via AppReady.
  // Until then, show a lightweight splash that preload replaces via IPC.
  await win.loadFile(join(import.meta.dirname, '../assets/splash.html')).catch(async () => {
    // Fallback if splash is missing (dev) — load the harness dist directly
    await win!.loadFile(getDistIndex())
  })
}

// ---------------------------------------------------------------------------
// Harness boot — reuses apps/cli profile-boot verbatim
// ---------------------------------------------------------------------------
async function bootHarness(): Promise<void> {
  // Lazy import after DSH_HOME is set so resolveDshHome() picks it up
  const { runProfile } = await import('../../../apps/cli/src/profile-boot.ts')
  const bareModuleBaseUrl = getBareModuleBaseUrl()
  const installAnchor = getInstallAnchor()

  // Patch the anchor in place — profile-boot.ts reads INSTALL_ANCHOR at import time,
  // but loadProfile() also accepts an explicit anchor via healProfilesModuleFallback.
  // We set the env so the shared helper is authoritative.
  process.env.ONEBINARY_RESOURCE_DIR = resourceRoot
  process.env.ONEBINARY_INSTALL_ANCHOR = installAnchor

  const environment = loadLayeredEnv('onebinary-electron')

  // Boot web profile as a long-lived surface. The web-runtime plugin inside
  // packages/bundle/web-app/cordis.patch.yml will bind the HTTP server and
  // expose its URL through webRuntime. We listen for AppReady to navigate.
  const { ctx } = await runProfile({
    environment,
    profile: 'web',
    patchFiles: [],
    args: [],
  })

  // When the harness signals readiness, navigate the BrowserWindow to the
  // local web server instead of opening an external browser.
  const maybeAppReady = (ctx as unknown as { get?: (k: string) => unknown }).get?.('appReady') as
    | { onReady: (cb: () => void) => () => void }
    | undefined

  // Fallback: also check webRuntime directly after a short delay
  const navigateToHarness = async (): Promise<void> => {
    const webRuntime = (ctx as unknown as { get?: (k: string) => { url?: string } })?.get?.('webRuntime') as
      | { url?: string; trustedHosts?: string[] }
      | undefined
    const url = webRuntime?.url ?? 'http://127.0.0.1:3080'
    if (win && !win.isDestroyed()) {
      try {
        await win.loadURL(url)
      } catch (error) {
        void dialog.showMessageBox(win, {
          type: 'error',
          message: `Failed to load harness at ${url}`,
          detail: String(error),
        })
      }
    }
  }

  if (maybeAppReady) {
    maybeAppReady.onReady(() => void navigateToHarness())
  } else {
    // No AppReady service (headless build) — poll once after boot settles
    setTimeout(() => void navigateToHarness(), 1500)
  }

  // Graceful shutdown: propagate to the Cordis root fiber (mirrors apps/cli/src/process-shutdown.ts)
  app.on('before-quit', () => {
    void ctx.fiber.dispose()
  })
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  await createWindow()
  await bootHarness().catch(async (error: unknown) => {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error)
    await dialog.showMessageBox({
      type: 'error',
      title: 'DeepSeek Harness failed to boot',
      message: 'OneBinary Electron could not mount the Cordis tree.',
      detail,
    })
    app.quit()
  })
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  // Keep alive on macOS like a normal harness web server; quit on Win/Linux
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})
