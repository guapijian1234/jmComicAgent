import * as path from 'node:path'
import { spawn, ChildProcess } from 'child_process'
import { configStore } from './ConfigStore'

interface PythonBridgeResult {
  success: boolean
  data?: unknown
  error?: string
}

export class PythonBridge {
  // Search retries against the flaky jmcomic API can add up, and a chapter
  // download+decode fetches every page image over the proxy. Allow ample time.
  private timeout = 180000

  async run(args: string[]): Promise<PythonBridgeResult> {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let settled = false

      const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'jmcomic_cli.py')
      const proc: ChildProcess = spawn('python', [scriptPath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: this.timeout,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      })

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          proc.kill()
          resolve({ success: false, error: `Command timed out after ${this.timeout / 1000}s` })
        }
      }, this.timeout)

      proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

      proc.on('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)

        if (code === 0) {
          try {
            const data = JSON.parse(stdout.trim())
            resolve({ success: true, data })
          } catch {
            // If not JSON, return raw output
            resolve({ success: true, data: stdout.trim() || null })
          }
        } else {
          resolve({ success: false, error: stderr || stdout || `Exit code ${code}` })
        }
      })

      proc.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ success: false, error: `Failed to start Python: ${err.message}` })
      })
    })
  }
}

export const pythonBridge = new PythonBridge()
