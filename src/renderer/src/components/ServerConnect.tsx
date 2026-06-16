import { useState, useEffect, useRef } from 'react'
import { getServerUrl, setServerUrl } from '../api/httpClient'
import { motion } from 'framer-motion'

const PORT = 3456

function getLocalIP(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('')
      pc.createOffer().then(o => pc.setLocalDescription(o))
      pc.onicecandidate = (e) => {
        if (!e.candidate) return
        const m = e.candidate.candidate.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/)
        if (m) {
          const ip = `${m[1]}.${m[2]}.${m[3]}.${m[4]}`
          if (m[1] !== '127') {
            pc.close()
            resolve(ip)
          }
        }
      }
      setTimeout(() => { pc.close(); resolve(null) }, 2000)
    } catch {
      resolve(null)
    }
  })
}

// Fallback: ping routers on port 80 across common /24 subnets to find which
// subnet the device is on. Most home routers respond to HTTP on .1 or .254.
async function detectSubnetViaGateway(): Promise<string | null> {
  const GWS = [1, 254] // most routers live at .1 or .254
  const BATCH = 50
  // Generate all 192.168.x subnets
  const allSubnets: string[] = []
  for (let i = 0; i <= 255; i++) allSubnets.push(`192.168.${i}`)
  allSubnets.push('10.0.0')

  for (let s = 0; s < allSubnets.length; s += BATCH) {
    const batch = allSubnets.slice(s, s + BATCH)
    const results = await Promise.all(batch.map(async subnet => {
      for (const gw of GWS) {
        const ctrl = new AbortController()
        setTimeout(() => ctrl.abort(), 300)
        try {
          await fetch(`http://${subnet}.${gw}`, { signal: ctrl.signal, mode: 'no-cors' })
          return subnet
        } catch { /* ignore */ }
      }
      return null
    }))
    const found = results.find(r => r !== null)
    if (found) return found
  }
  return null
}

async function tryIp(ip: string): Promise<string | null> {
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), 1000)
  try {
    const res = await fetch(`http://${ip}:${PORT}/api/status`, { signal: ctrl.signal })
    if (res.ok) {
      const data = await res.json()
      if (data.status === 'running') return `http://${ip}:${PORT}`
    }
  } catch { /* ignore */ }
  return null
}

async function scanSubnet(base: string, signal: { cancelled: boolean }): Promise<string | null> {
  const BATCH = 35
  for (let start = 1; start <= 254; start += BATCH) {
    if (signal.cancelled) return null
    const batch: number[] = []
    for (let i = start; i < Math.min(start + BATCH, 255); i++) batch.push(i)
    const results = await Promise.all(batch.map(i => tryIp(`${base}.${i}`)))
    const found = results.find(r => r !== null)
    if (found) return found
  }
  return null
}

export function ServerConnect() {
  const [mode, setMode] = useState<'scan' | 'manual' | 'found'>('scan')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const cancelRef = useRef(false)

  useEffect(() => {
    const saved = getServerUrl()
    if (saved) {
      // Try the saved URL first. If it works, instant connect.
      // If it fails, fall through to auto-scan.
      tryQuickTest(saved).then(ok => {
        if (!ok && !cancelRef.current) startScan()
      })
    } else {
      startScan()
    }
    return () => { cancelRef.current = true }
  }, [])

  async function tryQuickTest(target: string): Promise<boolean> {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 1500)
    try {
      const res = await fetch(`${target}/api/status`, { signal: ctrl.signal })
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'running') {
          setServerUrl(target)
          setMode('found')
          setTimeout(() => window.location.reload(), 600)
          return true
        }
      }
    } catch { /* fall through to scan */ }
    return false
  }

  async function startScan() {
    // Phase 1: WebRTC — detect phone's local IP on current LAN (fast, 2s + scan)
    const localIP = await getLocalIP()
    if (cancelRef.current) return

    let subnet: string | null = null
    if (localIP) {
      subnet = localIP.split('.').slice(0, 3).join('.')
    }

    // Phase 2: if WebRTC failed, ping routers to find the active subnet
    if (!subnet) {
      subnet = await detectSubnetViaGateway()
    }

    // Phase 3: scan the detected subnet
    if (subnet && !cancelRef.current) {
      const result = await scanSubnet(subnet, { cancelled: cancelRef.current })
      if (cancelRef.current) return
      if (result) { testAndConnect(result); return }
    }

    // Nothing found — show manual
    if (!cancelRef.current) setMode('manual')
  }

  async function testAndConnect(target: string) {
    setError('')
    try {
      const res = await fetch(`${target}/api/status`)
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'running') {
          setServerUrl(target)
          setMode('found')
          setTimeout(() => window.location.reload(), 600)
          return
        }
      }
      setError('服务器响应异常')
    } catch {
      setError('无法连接')
    }
    setMode('manual')
    setUrl(target)
  }

  async function handleManualConnect() {
    let target = url.trim()
    if (!target) return
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `http://${target}`
    }
    testAndConnect(target)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1e1e] text-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center gap-6"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center shadow-lg shadow-accent/20">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Comic Agent</h1>
        </div>

        {mode === 'scan' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative w-10 h-10">
              <svg className="animate-spin w-10 h-10 text-accent/60" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <svg className="absolute inset-0 w-10 h-10 text-accent animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" opacity="0.4" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" opacity="0.2" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" opacity="0.6" />
              </svg>
            </div>
            <p className="text-sm text-white/40">正在搜索局域网服务器...</p>
          </div>
        )}

        {mode === 'found' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <svg className="w-10 h-10 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm text-white/60">已连接，正在加载...</p>
          </div>
        )}

        {mode === 'manual' && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-xs text-white/30 text-center">
              未找到服务器，请手动输入地址
            </p>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualConnect() }}
              placeholder="http://192.168.1.100:3456"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"
            />
            <button
              onClick={handleManualConnect}
              disabled={!url.trim()}
              className="w-full py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 transition-all active:scale-[0.98]"
            >
              连接
            </button>
            <button
              onClick={() => { setMode('scan'); startScan() }}
              className="w-full py-2 text-xs text-white/25 hover:text-white/40 transition-colors"
            >
              重新搜索
            </button>
            {error && (
              <p className="text-xs text-red-400 text-center leading-relaxed">{error}</p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
