import { app } from 'electron'
import { join } from 'path'

export class ConfigStore {
  private store: Record<string, unknown>
  private path: string
  private fs: typeof import('fs')

  constructor() {
    this.fs = require('fs')
    this.path = join(app.getPath('userData'), 'config.json')
    this.store = this.load()
    this.ensureDefaults()
  }

  private load(): Record<string, unknown> {
    try {
      if (this.fs.existsSync(this.path)) {
        return JSON.parse(this.fs.readFileSync(this.path, 'utf-8'))
      }
    } catch { /* ignore */ }
    return {}
  }

  private save() {
    const dir = join(this.path, '..')
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true })
    }
    this.fs.writeFileSync(this.path, JSON.stringify(this.store, null, 2))
  }

  private ensureDefaults() {
    // No hardcoded API key — the user supplies their own via Settings.
    if (this.store.deepseekApiKey === undefined) {
      this.store.deepseekApiKey = ''
    }
    if (!this.store.deepseekModel) {
      this.store.deepseekModel = 'deepseek-v4-flash'
    }
    // OpenAI-compatible base URL. DeepSeek by default; user can repoint to any
    // OpenAI-compatible endpoint (OpenAI, OpenRouter, local, etc.) in Settings.
    if (!this.store.baseUrl) {
      this.store.baseUrl = 'https://api.deepseek.com'
    }
    this.save()
  }

  get<T>(key: string): T | undefined {
    return this.store[key] as T
  }

  set(key: string, value: unknown) {
    this.store[key] = value
    this.save()
  }

  getAll() {
    return { ...this.store }
  }
}

export const configStore = new ConfigStore()
