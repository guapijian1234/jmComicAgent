import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFile } from 'child_process'
import { createServer, Server } from 'http'
import { agentRuntime } from './agent/AgentRuntime'
import type { AgentEvent } from './agent/AgentRuntime'
import { configStore } from './ConfigStore'
import { pythonBridge } from './PythonBridge'
import { getMainWindow } from './windowRef'

const LAN_PORT = parseInt(process.env.JM_LAN_PORT || '3456', 10)

let sseCleanup: (() => void) | null = null

function isDev(): boolean {
  return !!process.env.ELECTRON_RENDERER_URL
}

function resolveRendererDir(): string {
  return path.join(__dirname, '..', 'renderer')
}

function sseStream(req: express.Request, res: express.Response, onStart: (send: (event: string, data: unknown) => void) => (() => void) | void) {
  // Write headers and first byte with a single write to avoid any buffering
  // issues. The first `res.write` implicitly flushes headers in Node.js.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Accel-Buffering': 'no'
  })
  // Send initial keepalive immediately so client knows stream is alive
  res.write(':ok\n\n')

  let closed = false
  const onClose = () => {
    closed = true
    // eslint-disable-next-line no-console
    console.log('[LanServer] SSE client disconnected')
  }

  req.on('close', onClose)
  req.on('aborted', onClose)

  // Keepalive timer — send a comment every 5s to prevent idle timeout
  const keepalive = setInterval(() => {
    if (closed) { clearInterval(keepalive); return }
    try { res.write(':ping\n\n') } catch { /* ignore */ }
  }, 5000)

  const send = (event: string, data: unknown) => {
    if (closed) return
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      // Client disconnected, ignore
    }
  }

  const cleanup = onStart(send) || (() => {})
  if (cleanup) {
    req.on('close', () => {
      clearInterval(keepalive)
      ;(cleanup as () => void)()
      if (sseCleanup === cleanup) sseCleanup = null
    })
  }
}

export function startLanServer(): Server | null {
  if (!isDev()) {
    const dist = resolveRendererDir()
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      // eslint-disable-next-line no-console
      console.log('[LanServer] No renderer build found, skipping. Run npm run build first.')
      return null
    }
  }

  const app = express()
  app.use(cors())
  app.use(express.json())

  // --- Static files (production only) ---
  if (!isDev()) {
    const dist = resolveRendererDir()
    app.use(express.static(dist))
  }

  // --- Comic images ---
  const cacheBase = path.resolve(
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.jmcomic')
  )
  const norm = (p: string) => p.toLowerCase().replace(/\\/g, '/')

  app.get('/comic-img/{*encoded}', (req, res) => {
    const encoded = (req.params as Record<string, string>).encoded ?? ''
    const target = path.resolve(decodeURIComponent(encoded))
    if (!fs.existsSync(target)) {
      return res.status(404).send('Not Found')
    }
    let realTarget: string
    try {
      const realBase = fs.realpathSync(cacheBase)
      realTarget = fs.realpathSync(target)
      const rel = path.relative(norm(realBase), norm(realTarget))
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return res.status(403).send('Forbidden')
      }
    } catch {
      return res.status(403).send('Forbidden')
    }
    // dotfiles: 'allow' is required — the jmcomic cache lives under the
    // `.jmcomic` dotfile dir, so sendFile's default ('ignore') returns 404 for
    // every image. Path-traversal is already guarded by the realpath/relative
    // check above, so allowing dotfiles here is safe.
    res.sendFile(realTarget!, { dotfiles: 'allow' })
  })

  // --- Agent ---
  // Accept BOTH GET and POST so the mobile (Capacitor/Android WebView) client
  // can stream over GET, which Android WebView handles far more reliably than
  // POST + chunked text/event-stream (POST streaming often yields an empty
  // response on Android WebView). Desktop/browser keeps using POST.
  function readParam(req: express.Request, key: string): string | undefined {
    const q = req.query[key]
    if (typeof q === 'string') return q
    if (Array.isArray(q) && q.length > 0) return String(q[0])
    const b = (req.body as Record<string, unknown> | undefined)?.[key]
    return typeof b === 'string' ? b : undefined
  }

  function handleAgentSend(req: express.Request, res: express.Response) {
    const message = readParam(req, 'message')
    const sessionId = readParam(req, 'sessionId')
    if (!message) {
      res.status(400).json({ error: 'message required' })
      return
    }

    // eslint-disable-next-line no-console
    console.log(`[LanServer] Agent request from ${req.ip} (${req.method}): "${String(message).slice(0, 60)}..."`)

    sseStream(req, res, (send) => {
      let cancelled = false
      sseCleanup = () => { cancelled = true; agentRuntime.cancel() }

      // Send immediate keepalive so the client knows the SSE stream is alive
      // before the LLM API call (which takes 1–3s) produces its first token.
      send('connected', { status: 'ok' })

      ;(async () => {
        try {
          for await (const event of agentRuntime.run(message, sessionId || 'default')) {
            if (cancelled) break
            send('agent-event', event)
            if (event.type === 'error') {
              // eslint-disable-next-line no-console
              console.error('[LanServer] Agent error event:', event.content)
              break
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[LanServer] Agent crashed:', err)
          send('agent-event', { type: 'error', content: String(err) })
        } finally {
          if (sseCleanup) sseCleanup = null
          try { res.end() } catch { /* ignore */ }
        }
      })()

      return () => {
        cancelled = true
        agentRuntime.cancel()
      }
    })
  }

  app.get('/api/agent/send', handleAgentSend)
  app.post('/api/agent/send', handleAgentSend)

  app.post('/api/agent/cancel', (_req, res) => {
    agentRuntime.cancel()
    if (sseCleanup) {
      sseCleanup()
      sseCleanup = null
    }
    res.json({ success: true })
  })

  // --- Comic data ---
  app.get('/api/comic/album/:id', async (req, res) => {
    try {
      const result = await pythonBridge.run(['album', '-a', req.params.id])
      res.json(result)
    } catch (err) {
      res.json({ success: false, error: String(err) })
    }
  })

  app.get('/api/comic/chapter/:albumId/:chapterId', async (req, res) => {
    try {
      const result = await pythonBridge.run(['chapter', '-a', req.params.albumId, '-c', req.params.chapterId])
      res.json(result)
    } catch (err) {
      res.json({ success: false, error: String(err) })
    }
  })

  // --- Config ---
  app.get('/api/config', (_req, res) => {
    res.json(configStore.getAll())
  })

  app.post('/api/config', (req, res) => {
    const { key, value } = req.body
    if (!key) return res.status(400).json({ error: 'key required' })
    configStore.set(key, value)
    res.json({ success: true })
  })

  // --- Library (favorites / likes / history) ---
  // These proxy to the renderer's IndexedDB via executeJavaScript — the data
  // lives in the renderer process. The Electron window must be open.

  async function callRenderer(fn: string, ...args: unknown[]): Promise<unknown> {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return null
    try {
      const json = JSON.stringify(args)
      return await win.webContents.executeJavaScript(
        `window.__${fn} ? window.__${fn}(...${json}) : null`, true
      )
    } catch { return null }
  }

  app.get('/api/library/favorites', async (_req, res) => {
    const data = await callRenderer('getFavorites')
    res.json(Array.isArray(data) ? data : [])
  })

  app.post('/api/library/favorites', async (req, res) => {
    const result = await callRenderer('toggleFavorite', req.body)
    res.json({ success: true, data: Array.isArray(result) ? result : [] })
  })

  app.get('/api/library/likes', async (_req, res) => {
    const data = await callRenderer('getLikes')
    res.json(Array.isArray(data) ? data : [])
  })

  app.post('/api/library/likes', async (req, res) => {
    const result = await callRenderer('toggleLike', req.body)
    res.json({ success: true, data: Array.isArray(result) ? result : [] })
  })

  app.get('/api/library/history', async (_req, res) => {
    const data = await callRenderer('getHistory')
    res.json(Array.isArray(data) ? data : [])
  })

  app.post('/api/library/history', async (req, res) => {
    await callRenderer('addHistory', req.body)
    res.json({ success: true })
  })

  // Aggregated preference profile (top categories/tags/authors + raw lists)
  // for the agent's personalized recommendations. The renderer computes it;
  // the mobile client (no Electron window) reaches it over HTTP instead of
  // via executeJavaScript.
  app.get('/api/user-preferences', async (_req, res) => {
    const data = await callRenderer('getUserPreferences')
    res.json(data ?? { counts: { favorites: 0, likes: 0, history: 0 }, topCategories: [], topTags: [], topAuthors: [], favorites: [], likes: [], recentHistory: [] })
  })

  // --- Download ---
  const activeDownloads = new Map<string, AbortController>()

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

  app.post('/api/download/start/:albumId', async (req, res) => {
    const { albumId } = req.params
    const existing = activeDownloads.get(albumId)
    if (existing) existing.abort()

    const ac = new AbortController()
    activeDownloads.set(albumId, ac)

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Accel-Buffering': 'no'
    })
    res.write(':ok\n\n')

    const send = (data: Record<string, unknown>) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch { /* ignore */ }
    }

    try {
      const detailResult = await pythonBridge.run(['album', '-a', albumId])
      if (!detailResult.success) {
        send({ albumId, chapterId: '', progress: 0, status: 'error', error: String(detailResult.error || 'Failed') })
        activeDownloads.delete(albumId)
        return res.end()
      }

      const chapters = extractChapters(detailResult.data)
      if (chapters.length === 0) {
        send({ albumId, chapterId: '', progress: 0, status: 'error', error: 'No chapters' })
        activeDownloads.delete(albumId)
        return res.end()
      }

      for (let i = 0; i < chapters.length; i++) {
        if (ac.signal.aborted) break
        const ch = chapters[i]
        send({ albumId, chapterId: ch.id, progress: 0, status: 'downloading' })
        try {
          const chResult = await pythonBridge.run(['chapter', '-a', albumId, '-c', ch.id])
          const chProgress = Math.round(((i + 1) / chapters.length) * 100)
          if (chResult.success) {
            const paths = (chResult.data as any)?.image_paths
            const firstPath = Array.isArray(paths) && paths.length > 0 ? String(paths[0]) : undefined
            send({ albumId, chapterId: ch.id, progress: chProgress, status: 'done', localPath: firstPath })
          } else {
            send({ albumId, chapterId: ch.id, progress: chProgress, status: 'error', error: String(chResult.error || '') })
          }
        } catch (err) {
          send({ albumId, chapterId: ch.id, progress: Math.round(((i + 1) / chapters.length) * 100), status: 'error', error: String(err) })
        }
      }
    } catch (err) {
      send({ albumId, chapterId: '', progress: 0, status: 'error', error: String(err) })
    } finally {
      activeDownloads.delete(albumId)
      try { res.end() } catch { /* ignore */ }
    }
  })

  app.post('/api/download/cancel/:albumId', (req, res) => {
    const ac = activeDownloads.get(req.params.albumId)
    if (ac) {
      ac.abort()
      activeDownloads.delete(req.params.albumId)
    }
    res.json({ success: true })
  })

  // --- Server info ---
  app.get('/api/status', (_req, res) => {
    const nets = os.networkInterfaces()
    const ips: string[] = []
    // Interface names that are definitely virtual/container/VPN adapters
    const virtualKeywords = [
      'vmnet', 'vmware', 'virtualbox', 'host-only',
      'vethernet', 'v ethernet', 'hyper-v', 'docker', 'wsl',
      'loopback', 'pseudo', 'bluetooth', 'teredo',
      'tunnel', 'vpn', 'tap-', 'p2p', 'ppp',
      'zerotier', 'tailscale', 'wireguard', 'openvpn',
      'virtual', 'nat', 'bridge', 'bridged',
      'unidentified', '未知', '虚拟', '蓝牙'
    ]
    const isVirtual = (name: string) =>
      virtualKeywords.some(k => name.toLowerCase().includes(k.toLowerCase()))

    for (const name of Object.keys(nets)) {
      const skip = isVirtual(name)
      // eslint-disable-next-line no-console
      console.log(`[LanServer] iface "${name}" ${skip ? 'SKIPPED' : 'KEPT'}`)
      if (skip) continue
      const ifaceNets = nets[name]
      if (!ifaceNets) continue
      for (const net of ifaceNets) {
        if (net.family === 'IPv4' && !net.internal) {
          const addr = net.address
          // eslint-disable-next-line no-console
          console.log(`[LanServer]   -> ${addr}`)
          if (addr.startsWith('192.168.56.') || addr.startsWith('192.168.137.')) continue
          if (addr.startsWith('169.254.')) continue // APIPA
          // Docker bridge (172.17.0.0/16) and common compose ranges
          if (/^172\.(1[789]|2[0-9]|3[01])\./.test(addr)) continue
          ips.push(addr)
        }
      }
    }

    // Deduplicate: if multiple IPs share the same /24 subnet, keep only the first.
    // Multiple real adapters on the same subnet are redundant for LAN access.
    const seen = new Set<string>()
    const deduped = ips.filter(ip => {
      const subnet = ip.split('.').slice(0, 3).join('.')
      if (seen.has(subnet)) return false
      seen.add(subnet)
      return true
    })

    res.json({
      status: 'running',
      version: '1.0.0',
      ips: deduped,
      port: LAN_PORT,
      urls: deduped.map((ip) => `http://${ip}:${LAN_PORT}`)
    })
  })

  // SPA fallback — serve index.html for any non-API, non-asset route
  if (!isDev()) {
    const dist = resolveRendererDir()
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/comic-img/')) return next()
      const ext = path.extname(req.path)
      if (ext && ext !== '.html') return next()
      res.sendFile(path.join(dist, 'index.html'))
    })
  }

  const server = createServer(app)
  server.listen(LAN_PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[LanServer] Listening on http://0.0.0.0:${LAN_PORT}`)

    // Open Windows Firewall inbound rule so phones on LAN can reach us.
    const ruleName = 'Comic Agent LAN Server'
    execFile('netsh', [
      'advfirewall', 'firewall', 'add', `rule name=${ruleName}`,
      'dir=in', 'action=allow', 'protocol=TCP', `localport=${LAN_PORT}`
    ], (err, stdout) => {
      if (!err) {
        // eslint-disable-next-line no-console
        console.log('[LanServer] Firewall rule added.')
      } else if ((stdout || '').includes('already exists') || (stdout || '').includes('2002')) {
        // Rule already present — fine.
      } else {
        // eslint-disable-next-line no-console
        console.log('[LanServer] Could not add firewall rule (may need admin). Run as admin:')
        // eslint-disable-next-line no-console
        console.log(`  netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${LAN_PORT}`)
      }
    })
  })

  return server
}
