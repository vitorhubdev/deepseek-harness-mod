/**
 * Preload — minimal, sandboxed. Harness UI is served from localhost, not via IPC.
 * @module onebinary/electron/preload
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('onebinary', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
  onHarnessUrl: (cb: (url: string) => void) => {
    const handler = (_: unknown, url: string): void => cb(url)
    ipcRenderer.on('onebinary:harness-url', handler)
    return () => ipcRenderer.off('onebinary:harness-url', handler)
  },
})

declare global {
  interface Window {
    onebinary: {
      platform: string
      versions: { electron: string; node: string }
      onHarnessUrl: (cb: (url: string) => void) => () => void
    }
  }
}
