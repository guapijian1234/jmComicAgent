import { app, BrowserWindow, shell, session, protocol, net } from 'electron'
import { join, resolve as pathResolve } from 'path'
import { pathToFileURL } from 'url'
import { execFileSync } from 'child_process'
import { registerIpcHandlers } from './ipc-handlers'
import { setMainWindow } from './windowRef'
import { startLanServer } from './LanServer'

// Windows zh-CN consoles default to the OEM codepage (GBK/936), so Chinese in
// console.log shows as mojibake. Pin the console to UTF-8 (65001) at startup.
// Best-effort: silently skipped when the process has no attached console
// (e.g. packaged GUI app launched by double-click — no console to read anyway).
if (process.platform === 'win32') {
  try { execFileSync('chcp.com', ['65001'], { stdio: 'ignore', shell: false }) } catch { /* no console */ }
}

const isMac = process.platform === 'darwin'

// jmcomic image/CDN hosts are unreachable without a proxy on most CN networks.
// Route all session traffic through Clash Verge by default (same proxy the
// Python bridge uses). Overridable via JM_PROXY env var.
const PROXY_URL = process.env.JM_PROXY || 'http://127.0.0.1:7897'

// Register the scheme as privileged BEFORE app ready so the renderer can load
// comic-img:// resources in <img>/fetch with proper security semantics.
// comic-img:// streams locally-downloaded DECODED jmcomic page images — raw
// CDN urls can't be used directly because JM images are scrambled (garbled).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'comic-img',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 820,
    minHeight: 560,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 18 },
    // Native frosted glass: acrylic on Windows 11, vibrancy on macOS.
    // backgroundColor must be transparent so the system material shows through.
    backgroundColor: '#00000000',
    backgroundMaterial: isMac ? undefined : 'acrylic',
    vibrancy: isMac ? 'under-window' : undefined,
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
  })

  setMainWindow(mainWindow)

  // Windows 11 acrylic (backgroundMaterial) breaks after maximize/restore
  // because the compositor drops the material during the resize. Re-applying
  // the same value is a no-op, so toggle none -> acrylic on the next tick
  // (after the OS resize settles) to force a recompose. The two sets run in the
  // same tick so there's no visible flash.
  if (!isMac) {
    const refreshAcrylic = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setBackgroundMaterial('none')
        mainWindow.setBackgroundMaterial('acrylic')
      }
    }
    mainWindow.on('maximize', () => setTimeout(refreshAcrylic, 0))
    mainWindow.on('unmaximize', () => setTimeout(refreshAcrylic, 0))
    mainWindow.on('restore', () => setTimeout(refreshAcrylic, 0))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await session.defaultSession.setProxy({ proxyRules: PROXY_URL })

  // Serve locally-downloaded decoded jmcomic images to the renderer.
  // URL shape: comic-img://cache/<encodeURIComponent(absolutePath)>
  // Only files under the jmcomic cache base are served (path traversal guard).
  const cacheBase = pathResolve(join(app.getPath('home'), '.jmcomic'))
  const norm = (p: string) => p.toLowerCase().replace(/\\/g, '/')
  protocol.handle('comic-img', async (request) => {
    const u = new URL(request.url)
    const target = pathResolve(decodeURIComponent(u.pathname.slice(1)))
    if (!norm(target).startsWith(norm(cacheBase))) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      return await net.fetch(pathToFileURL(target).href)
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })

  registerIpcHandlers(() => mainWindow)
  startLanServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
