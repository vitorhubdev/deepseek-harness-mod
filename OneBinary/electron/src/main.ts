/**
 * OneBinary Electron main — single-file harness with progressive splash and debuggable boot.
 * Reuses harness profile boot verbatim via runProfile(), but wraps it with observable progress
 * and in-window error reporting so the user never sees a blank Electron error dialog.
 * @module onebinary/electron/main
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import {
  getBareModuleBaseUrl,
  getDistIndex,
  getInstallAnchor,
  getResourceRoot,
} from './shared-resolve-paths.ts'
import { assertDshHomeExternal, resolveOneBinaryDshHome } from './shared-onebinary-env.ts'

// Cordis HMR requires V8 internals — web profile uses `patchReload: live` which mounts
// @deepseek-ai/cordis-plugin-hmr. That plugin checks `process.execArgv --expose-internals`
// and would otherwise crash the boot with `failed to apply loader entry b7bbc79a`.
app.commandLine.appendSwitch('js-flags', '--expose-internals')

// ---------------------------------------------------------------------------
// Single instance + external DSH_HOME (must be before loadLayeredEnv)
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) app.quit()

// resourceRoot is safe early — it reads process.resourcesPath (set before main runs)
const resourceRoot = getResourceRoot()
const installAnchor = getInstallAnchor()
const bareModuleBaseUrl = getBareModuleBaseUrl()

// Defer userData/temp paths until app is ready — calling app.getPath() before ready
// throws in Electron 44 and would crash main with "Cannot call app.getPath before app is ready".
let LOG_DIR = ''
let LOG_FILE = ''
let TMP_LOG = ''
let TMP_ERR = ''
let externalHome = ''

function initPathsAndEnv(): void {
  // userData is only reliable after ready
  try {
    externalHome = resolveOneBinaryDshHome(app.getPath('userData'))
  } catch {
    externalHome = resolveOneBinaryDshHome(undefined)
  }
  if (!process.env.DSH_HOME) process.env.DSH_HOME = externalHome
  try {
    assertDshHomeExternal(process.env.DSH_HOME, resourceRoot)
  } catch (error) {
    // assert should crash with visible dialog rather than silent fail
    void dialog.showMessageBoxSync?.({ type: 'error', message: String(error) } as unknown as never)
    throw error
  }
  process.env.ONEBINARY_RESOURCE_DIR = resourceRoot
  process.env.ONEBINARY_INSTALL_ANCHOR = installAnchor

  try {
    LOG_DIR = join(app.getPath('userData'), 'logs')
    mkdirSync(LOG_DIR, { recursive: true })
  } catch {
    // fallback when userData still unavailable (tests) — keep logs in temp
    try {
      LOG_DIR = join(app.getPath('temp'), 'deepmod-logs')
      mkdirSync(LOG_DIR, { recursive: true })
    } catch {}
  }
  try {
    LOG_FILE = LOG_DIR ? join(LOG_DIR, `onebinary-${new Date().toISOString().slice(0, 10)}.log`) : ''
    TMP_LOG = join(app.getPath('temp'), 'deepmod-boot.log')
    TMP_ERR = join(app.getPath('temp'), 'deepmod-boot-error.log')
  } catch {
    TMP_LOG = ''
    TMP_ERR = ''
  }
}

function ts(): string {
  return new Date().toISOString()
}

function writeLog(line: string): void {
  const entry = `[${ts()}] ${line}\n`
  try {
    appendFileSync(LOG_FILE, entry)
  } catch {}
  try {
    appendFileSync(TMP_LOG, entry)
  } catch {}
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('onebinary:log', line)
    } catch {}
  }
}

let win: BrowserWindow | undefined
let harnessCtx: unknown | undefined
let bootPhase = 'init'

function emitProgress(
  percent: number,
  stage: string,
  detail?: string,
  pluginsLoaded?: number,
  pluginsTotal?: number,
): void {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  writeLog(`progress ${p}% — ${stage}${detail ? ` — ${detail}` : ''}${pluginsLoaded !== undefined ? ` (${pluginsLoaded}/${pluginsTotal ?? '?'})` : ''}`)
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('onebinary:progress', { percent: p, stage, detail, pluginsLoaded, pluginsTotal })
    } catch {}
  }
}

function emitError(phase: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack ?? message) : String(error)
  const debugInfo: Record<string, string> = {
    phase,
    resourceRoot,
    installAnchor,
    bareModuleBaseUrl: String(bareModuleBaseUrl ?? '(dev)'),
    dshHome: String(process.env.DSH_HOME),
    userData: app.getPath('userData'),
    logFile: LOG_FILE,
    tmpLog: TMP_LOG,
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    platform: `${process.platform}/${process.arch}`,
  }
  try {
    writeFileSync(TMP_ERR, `${phase}:\n${stack}\n\n${JSON.stringify(debugInfo, null, 2)}\n`, 'utf8')
  } catch {}
  writeLog(`ERROR [${phase}] ${message}`)
  writeLog(stack.slice(0, 2000))
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('onebinary:error', { message: message.slice(0, 2000), stack, phase, debugInfo })
    } catch {}
    // keep splash visible — do NOT quit, user can copy logs / retry
    try {
      writeLog('Boot falhou — splash mantém aberto para cópia de log. Use Reiniciar.')
    } catch {}
  } else {
    void dialog.showMessageBox({
      type: 'error',
      title: 'DeepMod — falha no boot',
      message: `Falhou em "${phase}": ${message}`,
      detail: `${stack.slice(0, 3500)}\n\nLog: ${LOG_FILE}`,
    })
  }
}

// ---------------------------------------------------------------------------
// IPC for splash
// ---------------------------------------------------------------------------
ipcMain.handle('onebinary:debugInfo', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  resourceRoot,
  installAnchor,
  dshHome: String(process.env.DSH_HOME),
  userData: (() => { try { return app.getPath('userData') } catch { return LOG_DIR } })(),
  logFile: LOG_FILE,
  tmpDir: (() => { try { return app.getPath('temp') } catch { return '' } })(),
  locale: (() => { try { return app.getLocale() } catch { return '' } })(),
}))

ipcMain.handle('onebinary:getLocaleInfo', () => ({
  osLocale: (() => { try { return app.getLocale() } catch { return 'en-US' } })(),
  osLocales: (() => { try { return (app as unknown as { getPreferredSystemLanguages?: () => string[] }).getPreferredSystemLanguages?.() ?? [app.getLocale()] } catch { return ['en-US'] } })(),
}))

ipcMain.handle('onebinary:openLogs', async () => {
  try {
    await shell.openPath(LOG_DIR)
  } catch {}
  return LOG_DIR
})

ipcMain.handle('onebinary:copyLog', async () => {
  try {
    const { clipboard } = await import('electron')
    const tail = readFileSync(LOG_FILE, 'utf8').slice(-20000)
    const debug = [
      `DeepMod ${app.getVersion()} — ${process.platform}/${process.arch} — Electron ${process.versions.electron}`,
      `resourceRoot=${resourceRoot}`,
      `installAnchor=${installAnchor}`,
      `DSH_HOME=${process.env.DSH_HOME}`,
      `logFile=${LOG_FILE}`,
      '',
      tail,
    ].join('\n')
    clipboard.writeText(debug)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('onebinary:openDevTools', () => {
  win?.webContents.openDevTools({ mode: 'detach' })
})

ipcMain.handle('onebinary:retry', () => {
  writeLog('Usuário clicou Reiniciar — relaunch')
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('onebinary:quit', () => app.quit())

// ---------------------------------------------------------------------------
// Window + menu
// ---------------------------------------------------------------------------
async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    title: 'DeepMod',
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#0a0a0c',
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    autoHideMenuBar: true,
  })

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Recarregar splash' },
        { role: 'forceReload', label: 'Forçar recarregar' },
        { role: 'toggleDevTools', label: 'DevTools', accelerator: 'F12' },
        { type: 'separator' },
        { label: 'Abrir pasta de logs', click: () => void shell.openPath(LOG_DIR) },
        { label: 'Copiar log', click: async () => {
          try {
            const { clipboard } = await import('electron')
            clipboard.writeText(readFileSync(LOG_FILE, 'utf8').slice(-20000))
          } catch {}
        }},
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  win.once('ready-to-show', () => win?.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Right-click → Inspect
  win.webContents.on('context-menu', (_e, params) => {
    const m = Menu.buildFromTemplate([
      { label: 'Inspecionar', click: () => win?.webContents.inspectElement(params.x, params.y) },
      { label: 'Abrir DevTools (F12)', click: () => win?.webContents.openDevTools({ mode: 'detach' }) },
    ])
    m.popup({ window: win! })
  })

  const splashPath = join(import.meta.dirname, '../assets/splash.html')
  writeLog(`Criando janela — splash=${splashPath} exists=${existsSync(splashPath)} isPackaged=${app.isPackaged}`)
  if (existsSync(splashPath)) {
    await win.loadFile(splashPath)
  } else {
    writeLog(`Splash não encontrado, tentando fallback getDistIndex=${getDistIndex()}`)
    const dist = getDistIndex()
    if (existsSync(dist)) await win.loadFile(dist)
    else await win.loadURL('data:text/html,<h1 style="color:#fff;background:#111;padding:24px">DeepMod — splash ausente: ' + splashPath + '</h1>')
  }
}

// ---------------------------------------------------------------------------
// Harness boot with progressive reporting
// ---------------------------------------------------------------------------
async function bootHarness(): Promise<void> {
  bootPhase = 'env'
  emitProgress(5, 'Preparando ambiente', `DSH_HOME=${process.env.DSH_HOME}`)
  let environment: ReturnType<typeof loadLayeredEnv>
  try {
    environment = loadLayeredEnv('onebinary-electron')
    writeLog(`loadLayeredEnv ok — cwd=${process.cwd()} dshHome=${process.env.DSH_HOME}`)
  } catch (error) {
    bootPhase = 'loadLayeredEnv'
    throw error
  }

  emitProgress(12, 'Verificando instalação', `resourceRoot → ${resourceRoot}`)
  if (!existsSync(installAnchor)) {
    throw new Error(`INSTALL_ANCHOR não encontrado: ${installAnchor} (resourceRoot=${resourceRoot})`)
  }
  if (!existsSync(join(resourceRoot, 'apps/web/dist/index.html'))) {
    writeLog(`WARN apps/web/dist/index.html não encontrado em ${resourceRoot} — web bundle pode estar faltando`)
  }

  emitProgress(18, 'Resolvendo perfil web', 'healProfilesModuleFallback + barras de bundles')
  writeLog(`installAnchor=${installAnchor} bareModuleBaseUrl=${String(bareModuleBaseUrl)}`)

  // OneBinary não precisa de HMR live — web profile usa `patchReload: live` que exige --expose-internals.
  // Patch o manifest do profile web para `startup` antes de runProfile, para que o boot não exija internals.
  try {
    const { resolveDshHome } = await import('@deepseek-ai/dsh-home-paths')
    const { initProfile, PROFILE_TEMPLATES } = await import('@deepseek-ai/dsh-app-boot')
    const { join: join2 } = await import('node:path')
    const home = resolveDshHome()
    const webDir = join2(home, 'profiles/web')
    const webManifest = join2(webDir, 'package.json')
    if (!existsSync(webManifest)) {
      // Primeira vez — cria já como startup para não exigir --expose-internals
      const t = PROFILE_TEMPLATES.web
      initProfile(webDir, t.bundles, 'startup')
      writeLog('Init web profile como startup (OneBinary, primeira vez)')
    } else {
      const raw = readFileSync(webManifest, 'utf8')
      const j = JSON.parse(raw) as { dsh?: { profile?: { patchReload?: string; bundles?: unknown } } }
      if (j.dsh?.profile?.patchReload === 'live') {
        j.dsh.profile.patchReload = 'startup'
        writeFileSync(webManifest, JSON.stringify(j, null, 2) + '\n')
        writeLog('Patch web profile: live → startup (OneBinary não precisa de HMR)')
      }
    }
  } catch (error) {
    writeLog(`WARN patch web profile HMR: ${String(error)}`)
  }

  // Dynamic import after DSH_HOME is set so resolveDshHome picks it up
  let runProfile: (options: {
    environment: ReturnType<typeof loadLayeredEnv>
    profile: string
    patchFiles: string[]
    args: string[]
  }) => Promise<{ ctx: unknown; shutdown: () => Promise<void> }>

  try {
    const isDev = existsSync(join(import.meta.dirname, '../../../apps/cli/src/profile-boot.ts'))
    if (isDev) {
      const mod = await import('../../../apps/cli/src/profile-boot.ts')
      runProfile = mod.runProfile
    } else {
      const packagedBootPath = join(resourceRoot, 'apps/cli/lib/profile-boot.js')
      const targetUrl = packagedBootPath.startsWith('file:') ? packagedBootPath : `file://${packagedBootPath.replace(/\\/g, '/')}`
      const mod = await import(targetUrl)
      runProfile = mod.runProfile
    }
    writeLog('profile-boot carregado')
  } catch (error) {
    bootPhase = 'import profile-boot'
    throw error
  }

  emitProgress(22, 'Compondo camadas web', 'lendo cordis.patch.yml e bundles base+web-app')
  writeLog('Iniciando runProfile({ profile: web }) — isso pode levar 10-20s na primeira vez (compilando + ligando plugins)')

  // Fake incremental progress while runProfile is pending — keeps bar alive so user não se sente lesado
  let fake = 22
  const fakeTimer = setInterval(() => {
    fake = Math.min(68, fake + (Math.random() * 3 + 0.7))
    emitProgress(fake, 'Montando árvore Cordis', fake < 35 ? 'lendo bundles' : fake < 55 ? 'injetando plugins' : 'aguardando entry fibers', undefined, undefined)
  }, 650)

  let ctx: Awaited<ReturnType<typeof runProfile>>['ctx'] | undefined
  let shutdown: Awaited<ReturnType<typeof runProfile>>['shutdown'] | undefined
  try {
    const result = await runProfile({ environment, profile: 'web', patchFiles: [], args: [] })
    ctx = result.ctx
    shutdown = result.shutdown
    harnessCtx = ctx as unknown
    clearInterval(fakeTimer)
    writeLog('runProfile resolvido — ctx criado')
  } catch (error) {
    clearInterval(fakeTimer)
    bootPhase = 'runProfile'
    throw error
  }

  // Poll real plugin activation counts for 55% → 85%
  emitProgress(70, 'Ativando plugins', 'checando fibers do Loader')
  const pollStart = Date.now()
  const getCounts = (): { loaded: number; total: number; pending: string[] } => {
    try {
      const loader = (ctx as unknown as { get?: (k: string) => { entries?: () => Iterable<{ fiber?: { state: number }; options: { name: string }; disabled?: boolean }> } })?.get?.('loader')
      if (!loader) return { loaded: 0, total: 0, pending: [] }
      const entries = [...(loader.entries?.() ?? [])]
      const total = entries.filter(e => !e.disabled).length
      // FiberState ACTIVE=2 ; PENDING=0 ; FAILED=3  (ver packages/boot/app-boot/src/index.ts)
      const loaded = entries.filter(e => !e.disabled && e.fiber?.state === 2).length
      const pending = entries.filter(e => !e.disabled && e.fiber?.state === 0).slice(0, 6).map(e => e.options.name)
      return { loaded, total, pending }
    } catch {
      return { loaded: 0, total: 0, pending: [] }
    }
  }

  // Emit plugin counts every 400ms until stable or 6s
  for (let i = 0; i < 15; i += 1) {
    const { loaded, total, pending } = getCounts()
    const pct = Math.min(86, 70 + Math.floor((loaded / Math.max(1, total)) * 14) + i)
    const detail = total > 0 ? (pending.length > 0 ? `pendentes: ${pending.join(', ')}` : `${loaded}/${total} ativos`) : 'aguardando Loader…'
    emitProgress(pct, 'Ativando plugins', detail, loaded, total)
    if (total > 0 && loaded >= total) break
    // also log that we are still waiting — user sees bar mexendo
    if (Date.now() - pollStart > 6500) break
    await new Promise<void>(r => setTimeout(r, 400))
  }

  emitProgress(88, 'Iniciando servidor web', 'webRuntime em 127.0.0.1')

  // Navigate — use connection.authenticatedUrl so the Electron window has the token
  // (webRuntime has no url field; the token lives in HostConnectionService).
  const tryNavigate = async (): Promise<boolean> => {
    try {
      const connection = (ctx as unknown as { get?: (k: string) => { authenticatedUrl?: (u: string) => string } })?.get?.('connection') as
        | { authenticatedUrl?: (u: string) => string }
        | undefined
      const webServer = (ctx as unknown as { get?: (k: string) => { config?: { port?: number }; listenedPort?: number; host?: string } })?.get?.('webServer') as
        | { config?: { port?: number }; listenedPort?: number; host?: string }
        | undefined
      const port = (webServer as { listenedPort?: number; config?: { port?: number } } | undefined)?.listenedPort
        ?? (webServer as { config?: { port?: number } } | undefined)?.config?.port
        ?? 3080
      const base = `http://127.0.0.1:${port}`
      const url = connection?.authenticatedUrl ? connection.authenticatedUrl(base) : base
      const logUrl = url.replace(/([?&]token=)[^&]+/, '$1***')
      writeLog(`Navegando para ${logUrl} (base=${base} hasAuth=${Boolean(connection?.authenticatedUrl)})`)
      if (win && !win.isDestroyed()) {
        await win.loadURL(url)
        writeLog(`loadURL ok — ${logUrl}`)
        emitProgress(100, 'Pronto!', logUrl)
        return true
      }
      return false
    } catch (error) {
      writeLog(`loadURL falhou: ${String(error)}`)
      return false
    }
  }

  // Hook AppReady when available — otherwise poll with exponential backoff
  const maybeAppReady = (ctx as unknown as { get?: (k: string) => { onReady: (cb: () => void) => () => void } })?.get?.('appReady')
  if (maybeAppReady) {
    writeLog('AppReady encontrado — aguardando onReady')
    maybeAppReady.onReady(() => void tryNavigate())
    // safety: if onReady never fires, poll
    setTimeout(() => void tryNavigate(), 2500)
  } else {
    writeLog('AppReady ausente — polling webRuntime em 1.5s')
    setTimeout(() => void tryNavigate(), 1500)
    // keep trying up to 12s caso o servidor suba devagar
    let attempts = 0
    const iv = setInterval(() => {
      attempts += 1
      if (attempts > 6) clearInterval(iv)
      void tryNavigate().then(ok => { if (ok) clearInterval(iv) })
    }, 2000)
  }

  // Graceful shutdown mirrors apps/cli/src/process-shutdown.ts
  const c = ctx as unknown as { fiber: { dispose: () => Promise<void> } }
  app.on('before-quit', () => {
    writeLog('before-quit — disposing Cordis root fiber')
    void c.fiber.dispose()
  })
  // also proxy shutdown if harnessCtx is kept
  void shutdown
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
async function setupAutoUpdate(): Promise<void> {
  if (!app.isPackaged) return
  try {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.logger = { info: (m: string) => writeLog(`[updater] ${m}`), warn: (m: string) => writeLog(`[updater] WARN ${m}`), error: (m: string) => writeLog(`[updater] ERR ${m}`), debug: () => {} } as unknown as typeof autoUpdater.logger
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    // Não bloquear boot — checa em background
    setTimeout(() => {
      writeLog('Checando atualização… (GitHub Releases)')
      void autoUpdater.checkForUpdates().catch(e => writeLog(`updater check failed: ${String(e)}`))
    }, 8000)
    autoUpdater.on('update-available', info => {
      writeLog(`Atualização disponível: v${info.version}`)
      if (win && !win.isDestroyed()) win.webContents.send('onebinary:update-available', { version: info.version })
      void autoUpdater.downloadUpdate().catch(e => writeLog(`download failed: ${String(e)}`))
    })
    autoUpdater.on('update-downloaded', info => {
      writeLog(`Atualização baixada: v${info.version} — reinicie para aplicar`)
      if (win && !win.isDestroyed()) win.webContents.send('onebinary:update-downloaded', { version: info.version })
    })
    autoUpdater.on('error', e => writeLog(`updater error: ${String(e)}`))
    // Checagem periódica a cada 6h
    setInterval(() => void autoUpdater.checkForUpdates().catch(()=>{}), 6*60*60*1000)
    // IPC manual: renderer pode pedir check
    ipcMain.handle('onebinary:checkForUpdates', () => autoUpdater.checkForUpdates())
    ipcMain.handle('onebinary:quitAndInstall', () => autoUpdater.quitAndInstall())
  } catch (e) {
    writeLog(`autoUpdater desabilitado: ${String(e)}`)
  }
}

app.whenReady().then(async () => {
  initPathsAndEnv()
  writeLog(`DeepMod ${app.getVersion()} iniciado — Electron ${process.versions.electron} Node ${process.versions.node} — isPackaged=${app.isPackaged} resourcesPath=${(process as unknown as { resourcesPath?: string }).resourcesPath ?? 'n/a'}`)
  await createWindow()
  void setupAutoUpdate()
  // initial progress so bar não fica parada
  emitProgress(2, 'Janela criada', 'inicializando logs')
  try {
    // also dump for external tail
    try {
      if (TMP_LOG) writeFileSync(TMP_LOG, `[${ts()}] boot start resourceRoot=${resourceRoot} installAnchor=${installAnchor}\n`, 'utf8')
    } catch {}
  } catch {}
  // slight delay so splash paints before heavy boot blocks microtasks
  setTimeout(() => {
    void bootHarness().catch((error: unknown) => {
      writeLog(`bootHarness catch [${bootPhase}] ${String(error)}`)
      emitError(bootPhase, error)
    })
  }, 250)
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

process.on('uncaughtException', error => {
  writeLog(`uncaughtException [${bootPhase}] ${String(error)} — ${error.stack ?? ''}`)
  emitError(`uncaughtException:${bootPhase}`, error)
})

process.on('unhandledRejection', reason => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  writeLog(`unhandledRejection [${bootPhase}] ${String(reason)}`)
  emitError(`unhandledRejection:${bootPhase}`, err)
})
