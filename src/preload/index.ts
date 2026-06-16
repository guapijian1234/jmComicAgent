import { contextBridge, ipcRenderer } from 'electron'

export interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error'
  content?: string
  name?: string
  params?: Record<string, unknown>
  result?: { success: boolean; data?: unknown; error?: string }
}

const api = {
  platform: process.platform,
  agent: {
    send: (message: string, sessionId?: string) =>
      ipcRenderer.invoke('agent:send', { message, sessionId }) as Promise<AgentEvent[]>,
    cancel: () => ipcRenderer.invoke('agent:cancel'),
    onEvent: (callback: (event: AgentEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: AgentEvent) => callback(data)
      ipcRenderer.on('agent:event', handler)
      return () => ipcRenderer.removeListener('agent:event', handler)
    }
  },
  comic: {
    fetchAlbumDetail: (albumId: string) =>
      ipcRenderer.invoke('comic:fetch-album-detail', albumId) as Promise<{ success: boolean; data?: unknown; error?: string }>,
    fetchChapterPages: (albumId: string, chapterId: string) =>
      ipcRenderer.invoke('comic:fetch-chapter-pages', albumId, chapterId) as Promise<{ success: boolean; data?: unknown; error?: string }>
  },
  config: {
    get: () => ipcRenderer.invoke('config:get') as Promise<Record<string, unknown>>,
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', { key, value })
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    onMaximizeChange: (cb: (max: boolean) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, max: boolean) => cb(max)
      ipcRenderer.on('window:maximize-changed', handler)
      return () => ipcRenderer.removeListener('window:maximize-changed', handler)
    }
  },
  download: {
    start: (albumId: string) =>
      ipcRenderer.invoke('download:start', albumId) as Promise<void>,
    cancel: (albumId: string) =>
      ipcRenderer.invoke('download:cancel', albumId) as Promise<void>,
    onProgress: (callback: (data: { albumId: string; chapterId: string; progress: number; status: string; error?: string; localPath?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('download:progress', handler)
      return () => ipcRenderer.removeListener('download:progress', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api
