/// <reference types="vite/client" />

export interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error'
  content?: string
  name?: string
  params?: Record<string, unknown>
  result?: { success: boolean; data?: unknown; error?: string }
}

interface ElectronApi {
  platform: NodeJS.Platform
  agent: {
    send: (message: string, sessionId?: string) => Promise<AgentEvent[]>
    cancel: () => Promise<void>
    onEvent: (cb: (e: AgentEvent) => void) => () => void
  }
  comic: {
    fetchAlbumDetail: (albumId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
    fetchChapterPages: (albumId: string, chapterId: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  }
  config: {
    get: () => Promise<Record<string, unknown>>
    set: (key: string, value: unknown) => Promise<{ success: boolean }>
  }
  window: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (cb: (max: boolean) => void) => () => void
  }
  download: {
    start: (albumId: string) => Promise<void>
    cancel: (albumId: string) => Promise<void>
    onProgress: (cb: (data: { albumId: string; chapterId: string; progress: number; status: string; error?: string; localPath?: string }) => void) => () => void
  }
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
