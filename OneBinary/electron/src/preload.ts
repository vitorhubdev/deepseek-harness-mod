/**
 * Preload — sandbox-safe bridge for the OneBinary loading screen.
 * The harness UI itself is served from localhost and does not use this bridge.
 * @module onebinary/electron/preload
 */

import { contextBridge, ipcRenderer } from 'electron'

export interface ProgressPayload {
  percent: number
  stage: string
  detail?: string
  pluginsLoaded?: number
  pluginsTotal?: number
}

export interface ErrorPayload {
  message: string
  stack: string
  phase: string
  debugInfo: Record<string, string>
}

export interface DebugInfo {
  version: string
  electron: string
  node: string
  platform: string
  arch: string
  resourceRoot: string
  installAnchor: string
  dshHome: string
  userData: string
  logFile: string
  tmpDir: string
}

contextBridge.exposeInMainWorld('onebinary', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
  onProgress: (cb: (p: ProgressPayload) => void) => {
    const handler = (_: unknown, payload: ProgressPayload) => cb(payload)
    ipcRenderer.on('onebinary:progress', handler)
    return () => ipcRenderer.off('onebinary:progress', handler)
  },
  onError: (cb: (p: ErrorPayload) => void) => {
    const handler = (_: unknown, payload: ErrorPayload) => cb(payload)
    ipcRenderer.on('onebinary:error', handler)
    return () => ipcRenderer.off('onebinary:error', handler)
  },
  onLogLine: (cb: (line: string) => void) => {
    const handler = (_: unknown, line: string) => cb(line)
    ipcRenderer.on('onebinary:log', handler)
    return () => ipcRenderer.off('onebinary:log', handler)
  },
  getDebugInfo: (): Promise<DebugInfo> => ipcRenderer.invoke('onebinary:debugInfo'),
  getLocaleInfo: (): Promise<{ osLocale: string; osLocales: string[] }> => ipcRenderer.invoke('onebinary:getLocaleInfo'),
  openLogs: (): Promise<string> => ipcRenderer.invoke('onebinary:openLogs'),
  copyLog: (): Promise<boolean> => ipcRenderer.invoke('onebinary:copyLog'),
  openDevTools: (): Promise<void> => ipcRenderer.invoke('onebinary:openDevTools'),
  retry: (): Promise<void> => ipcRenderer.invoke('onebinary:retry'),
  quit: (): Promise<void> => ipcRenderer.invoke('onebinary:quit'),
  onUpdateAvailable: (cb: (info: { version: string }) => void) => {
    const h = (_: unknown, info: { version: string }) => cb(info)
    ipcRenderer.on('onebinary:update-available', h)
    return () => ipcRenderer.off('onebinary:update-available', h)
  },
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
    const h = (_: unknown, info: { version: string }) => cb(info)
    ipcRenderer.on('onebinary:update-downloaded', h)
    return () => ipcRenderer.off('onebinary:update-downloaded', h)
  },
  checkForUpdates: (): Promise<unknown> => ipcRenderer.invoke('onebinary:checkForUpdates'),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke('onebinary:quitAndInstall'),
})

declare global {
  interface Window {
    onebinary: {
      platform: string
      versions: { electron: string; node: string }
      onProgress: (cb: (p: ProgressPayload) => void) => () => void
      onError: (cb: (p: ErrorPayload) => void) => () => void
      onLogLine: (cb: (line: string) => void) => () => void
      getDebugInfo: () => Promise<DebugInfo>
      getLocaleInfo: () => Promise<{ osLocale: string; osLocales: string[] }>
      openLogs: () => Promise<string>
      copyLog: () => Promise<boolean>
      openDevTools: () => Promise<void>
      retry: () => Promise<void>
      quit: () => Promise<void>
      onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
      onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void
      checkForUpdates: () => Promise<unknown>
      quitAndInstall: () => Promise<void>
    }
  }
}
