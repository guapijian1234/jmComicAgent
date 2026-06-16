interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error'
  content?: string
  name?: string
  params?: Record<string, unknown>
  result?: { success: boolean; data?: unknown; error?: string }
}

function serverUrl(): string {
  const saved = localStorage.getItem('jm_server_url')
  if (saved) return saved.replace(/\/+$/, '')
  const origin = window.location.origin
  if (origin.startsWith('http://') || origin.startsWith('https://')) {
    return origin
  }
  return ''
}

export function getServerUrl(): string {
  return serverUrl()
}

export function setServerUrl(url: string) {
  localStorage.setItem('jm_server_url', url.replace(/\/+$/, ''))
}

// XHR-based SSE reader. Android WebViews often lack ReadableStream on
// fetch() Response.body — res.body is null or the reader completes
// immediately on the first read. XHR onprogress fires reliably for
// chunked responses in every WebView going back to Android 2.x.
function sseXhr(
  url: string,
  method: string,
  body: string | null,
  onLine: (eventType: string, data: string) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    if (body !== null) xhr.setRequestHeader('Content-Type', 'application/json')

    let lastLen = 0
    let buffer = ''
    let currentEvent = ''
    // Set if reading xhr.responseText throws (e.g. cross-origin read blocked
    // mid-stream) — the stream is then unusable and we surface it as an error.
    let readError: unknown = null

    const processChunk = (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          onLine(currentEvent, line.slice(6))
        }
      }
    }

    xhr.onprogress = () => {
      let text: string
      try { text = xhr.responseText } catch (e) { readError = e; return }
      try { processChunk(text.slice(lastLen)) } catch { /* ignore */ }
      lastLen = text.length
    }

    xhr.onloadend = () => {
      // Intentional cancel (user abort) — resolve silently, no error event.
      if (signal?.aborted) { resolve(); return }

      if (!readError) {
        try { processChunk(xhr.responseText.slice(lastLen)) } catch { /* ignore */ }
      }

      const status = xhr.status
      if (readError) {
        reject(new Error(`stream read blocked (status ${status}): ${(readError as Error)?.name || readError}`))
      } else if (status === 0) {
        // status 0 with no abort = network/CORS failure (no usable response).
        reject(new Error('network/CORS failure (status 0)'))
      } else if (status < 200 || status >= 300) {
        reject(new Error(`HTTP ${status}`))
      } else {
        resolve()
      }
    }
    // eslint-disable-next-line no-console
    xhr.onerror = () => { console.warn('[sseXhr] network error', url, 'status', xhr.status) }

    if (signal) signal.addEventListener('abort', () => { xhr.abort() }, { once: true })

    xhr.send(body)
  })
}

class HttpAgentApi {
  private eventHandlers = new Set<(evt: AgentEvent) => void>()
  private abortController: AbortController | null = null

  onEvent(cb: (evt: AgentEvent) => void) {
    this.eventHandlers.add(cb)
    return () => { this.eventHandlers.delete(cb) }
  }

  private fireEvent(evt: AgentEvent) {
    this.eventHandlers.forEach((cb) => cb(evt))
  }

  async send(message: string, sessionId?: string): Promise<AgentEvent[]> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    const events: AgentEvent[] = []
    const base = serverUrl()

    // GET, not POST: Android WebView reliably streams chunked text/event-stream
    // over GET, while POST + streaming often yields an empty response there.
    // Desktop/browser works either way; GET is the canonical SSE method.
    const params = new URLSearchParams({
      message,
      sessionId: sessionId || 'default'
    })

    try {
      await sseXhr(
        `${base}/api/agent/send?${params.toString()}`,
        'GET',
        null,
        (eventType, data) => {
          if (eventType !== 'agent-event') return
          try {
            const evt = JSON.parse(data) as AgentEvent
            events.push(evt)
            this.fireEvent(evt)
          } catch { /* skip malformed */ }
        },
        signal
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return events
      const errorEvent: AgentEvent = { type: 'error', content: String(err) }
      events.push(errorEvent)
      this.fireEvent(errorEvent)
    }

    return events
  }

  async cancel() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    try {
      await fetch(`${serverUrl()}/api/agent/cancel`, { method: 'POST' })
    } catch { /* ignore */ }
  }
}

class HttpComicApi {
  async fetchAlbumDetail(albumId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const res = await fetch(`${serverUrl()}/api/comic/album/${encodeURIComponent(albumId)}`)
      return (await res.json()) as any
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  async fetchChapterPages(albumId: string, chapterId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const res = await fetch(`${serverUrl()}/api/comic/chapter/${encodeURIComponent(albumId)}/${encodeURIComponent(chapterId)}`)
      return (await res.json()) as any
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

class HttpConfigApi {
  async get(): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`${serverUrl()}/api/config`)
      return (await res.json()) as any
    } catch {
      return {}
    }
  }

  async set(key: string, value: unknown): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`${serverUrl()}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
      return (await res.json()) as any
    } catch (err) {
      return { success: false }
    }
  }
}

class HttpWindowApi {
  private maximized = false
  private maxListeners = new Set<(max: boolean) => void>()

  async minimize() {}
  async toggleMaximize() {}
  async close() {}
  async isMaximized() { return this.maximized }
  onMaximizeChange(cb: (max: boolean) => void) {
    this.maxListeners.add(cb)
    return () => { this.maxListeners.delete(cb) }
  }
}

class HttpDownloadApi {
  private progressHandlers = new Set<(data: any) => void>()

  onProgress(cb: (data: any) => void) {
    this.progressHandlers.add(cb)
    return () => { this.progressHandlers.delete(cb) }
  }

  private fireProgress(data: any) {
    this.progressHandlers.forEach((cb) => cb(data))
  }

  async start(albumId: string) {
    const base = serverUrl()
    try {
      await sseXhr(
        `${base}/api/download/start/${encodeURIComponent(albumId)}`,
        'POST',
        null,
        (_eventType, data) => {
          try {
            this.fireProgress(JSON.parse(data))
          } catch { /* skip */ }
        }
      )
    } catch (err) {
      this.fireProgress({ albumId, chapterId: '', progress: 0, status: 'error', error: String(err) })
    }
  }

  async cancel(albumId: string) {
    try {
      await fetch(`${serverUrl()}/api/download/cancel/${encodeURIComponent(albumId)}`, { method: 'POST' })
    } catch { /* ignore */ }
  }
}

export interface ElectronApi {
  platform: NodeJS.Platform
  _transport?: 'http' | 'ipc'
  agent: HttpAgentApi
  comic: HttpComicApi
  config: HttpConfigApi
  window: HttpWindowApi
  download: HttpDownloadApi
}

export function createHttpApi(): ElectronApi {
  return {
    platform: 'android' as any,
    _transport: 'http' as const,
    agent: new HttpAgentApi(),
    comic: new HttpComicApi(),
    config: new HttpConfigApi(),
    window: new HttpWindowApi(),
    download: new HttpDownloadApi()
  }
}
