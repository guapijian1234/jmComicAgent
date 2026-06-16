import { ipcMain, BrowserWindow } from 'electron'
import { agentRuntime } from './agent/AgentRuntime'
import { registerTools } from './agent/tools/register-tools'
import { configStore } from './ConfigStore'
import { pythonBridge } from './PythonBridge'

registerTools()

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  // --- Agent ---
  ipcMain.handle('agent:send', async (_event, { message, sessionId }: { message: string; sessionId?: string }) => {
    const events: unknown[] = []
    for await (const event of agentRuntime.run(message, sessionId ?? 'default')) {
      events.push(event)
      getWindow()?.webContents.send('agent:event', event)
    }
    return events
  })

  ipcMain.handle('agent:cancel', async () => {
    agentRuntime.cancel()
  })

  // --- Config ---
  ipcMain.handle('config:get', async () => {
    return configStore.getAll()
  })

  ipcMain.handle('config:set', async (_event, { key, value }: { key: string; value: unknown }) => {
    configStore.set(key, value)
    return { success: true }
  })

  // --- Comic data (direct PythonBridge calls, bypassing Agent) ---
  ipcMain.handle('comic:fetch-album-detail', async (_event, albumId: string) => {
    try {
      const result = await pythonBridge.run(['album', '-a', albumId])
      return result
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('comic:fetch-chapter-pages', async (_event, albumId: string, chapterId: string) => {
    try {
      const result = await pythonBridge.run(['chapter', '-a', albumId, '-c', chapterId])
      return result
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // --- Window controls (macOS-style traffic lights on Windows) ---
  ipcMain.handle('window:minimize', async () => {
    getWindow()?.minimize()
  })
  ipcMain.handle('window:toggle-maximize', async () => {
    const win = getWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:close', async () => {
    getWindow()?.close()
  })
  ipcMain.handle('window:is-maximized', async () => {
    return getWindow()?.isMaximized() ?? false
  })

  getWindow()?.on('maximize', () => getWindow()?.webContents.send('window:maximize-changed', true))
  getWindow()?.on('unmaximize', () => getWindow()?.webContents.send('window:maximize-changed', false))

  // --- Download ---
  const activeDownloads = new Map<string, AbortController>()

  ipcMain.handle('download:start', async (_event, albumId: string) => {
    const existing = activeDownloads.get(albumId)
    if (existing) existing.abort()
    const ac = new AbortController()
    activeDownloads.set(albumId, ac)

    try {
      const win = getWindow()!
      const detailResult = await pythonBridge.run(['album', '-a', albumId])
      if (!detailResult.success) {
        win.webContents.send('download:progress', { albumId, chapterId: '', progress: 0, status: 'error', error: String(detailResult.error || 'Failed to fetch album') })
        activeDownloads.delete(albumId)
        return
      }

      const chapters = extractChapters(detailResult.data)
      if (chapters.length === 0) {
        win.webContents.send('download:progress', { albumId, chapterId: '', progress: 0, status: 'error', error: 'No chapters found' })
        activeDownloads.delete(albumId)
        return
      }

      for (let i = 0; i < chapters.length; i++) {
        if (ac.signal.aborted) break
        const ch = chapters[i]
        win.webContents.send('download:progress', { albumId, chapterId: ch.id, progress: 0, status: 'downloading' })
        try {
          const chResult = await pythonBridge.run(['chapter', '-a', albumId, '-c', ch.id])
          const chProgress = Math.round(((i + 1) / chapters.length) * 100)
          if (chResult.success) {
            const paths = (chResult.data as any)?.image_paths
            const firstPath = Array.isArray(paths) && paths.length > 0 ? String(paths[0]) : undefined
            win.webContents.send('download:progress', { albumId, chapterId: ch.id, progress: chProgress, status: 'done', localPath: firstPath })
          } else {
            win.webContents.send('download:progress', { albumId, chapterId: ch.id, progress: chProgress, status: 'error', error: String(chResult.error || '') })
          }
        } catch (err) {
          const chProgress = Math.round(((i + 1) / chapters.length) * 100)
          win.webContents.send('download:progress', { albumId, chapterId: ch.id, progress: chProgress, status: 'error', error: String(err) })
        }
      }
    } catch (err) {
      const win = getWindow()!
      win.webContents.send('download:progress', { albumId, chapterId: '', progress: 0, status: 'error', error: String(err) })
    } finally {
      activeDownloads.delete(albumId)
    }
  })

  ipcMain.handle('download:cancel', async (_event, albumId: string) => {
    const ac = activeDownloads.get(albumId)
    if (ac) ac.abort()
    activeDownloads.delete(albumId)
  })
}

function extractChapters(raw: unknown): { id: string; title: string }[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  let target: unknown = obj
  for (const key of ['album', 'data', 'detail', 'result', 'info']) {
    if (obj[key] && typeof obj[key] === 'object') { target = obj[key]; break }
  }
  const t = target as Record<string, unknown>
  const arr: unknown[] = Array.isArray(t['episode_list']) ? t['episode_list'] : Array.isArray(t['chapters']) ? t['chapters'] : []
  const result: { id: string; title: string }[] = []
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (Array.isArray(item)) {
      const id = item[0] != null ? String(item[0]) : undefined
      const name = typeof item[2] === 'string' ? item[2].trim() : ''
      const title = name || (item[1] != null ? `第${item[1]}话` : `第${i + 1}话`)
      if (id) result.push({ id, title })
    } else if (item && typeof item === 'object') {
      const c = item as Record<string, unknown>
      const id = c['chapter_id'] ?? c['id'] ?? c['cid'] ?? c['photo_id']
      const title = c['chapter_title'] ?? c['title'] ?? c['name'] ?? `第${i + 1}话`
      if (id) result.push({ id: String(id), title: String(title) })
    }
  }
  return result
}
