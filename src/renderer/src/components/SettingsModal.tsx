import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { motion, AnimatePresence } from 'framer-motion'
import { settingsOpenAtom, closeSettingsAtom } from '../atoms/settings'
import { showToastAtom } from '../atoms/toast'

const DEFAULTS = {
  deepseekApiKey: '',
  baseUrl: 'https://api.deepseek.com',
  deepseekModel: 'deepseek-v4-flash'
}

export function SettingsModal() {
  const open = useAtomValue(settingsOpenAtom)
  const close = useSetAtom(closeSettingsAtom)
  const showToast = useSetAtom(showToastAtom)

  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULTS.baseUrl)
  const [model, setModel] = useState(DEFAULTS.deepseekModel)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lanUrls, setLanUrls] = useState<string[]>([])
  const [lanPort, setLanPort] = useState(0)

  // Hydrate from the config store each time the modal opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.api.config.get().then((cfg) => {
      if (cancelled) return
      setApiKey(String(cfg.deepseekApiKey ?? ''))
      setBaseUrl(String(cfg.baseUrl ?? DEFAULTS.baseUrl))
      setModel(String(cfg.deepseekModel ?? DEFAULTS.deepseekModel))
    })
    // Fetch LAN server status
    fetch('http://localhost:3456/api/status')
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.urls) {
          setLanUrls(d.urls as string[])
          setLanPort(d.port as number)
        }
      })
      .catch(() => setLanUrls([]))
    return () => { cancelled = true }
  }, [open])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        window.api.config.set('deepseekApiKey', apiKey.trim()),
        window.api.config.set('baseUrl', baseUrl.trim() || DEFAULTS.baseUrl),
        window.api.config.set('deepseekModel', model.trim() || DEFAULTS.deepseekModel)
      ])
      showToast({ message: '设置已保存', type: 'success' })
      close()
    } catch {
      showToast({ message: '保存失败', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'var(--blur-md)', WebkitBackdropFilter: 'var(--blur-md)' }}
          onMouseDown={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            className="glass-raised"
            style={{ width: 440, maxWidth: '90vw', borderRadius: 18, padding: 24 }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)' }}>设置</h2>
              <button
                onClick={close}
                className="flex items-center justify-center"
                style={{ width: 26, height: 26, borderRadius: 7, color: 'var(--text-tertiary)' }}
                title="关闭"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-[12px] mb-5" style={{ color: 'var(--text-tertiary)' }}>
              OpenAI 兼容接口 — 支持任意符合 OpenAI 协议的服务（DeepSeek / OpenAI / OpenRouter / 本地部署等）。
            </p>

            <div className="space-y-4">
              <Field label="API Key">
                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    spellCheck={false}
                    className="flex-1 min-w-0"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{ width: 34, height: 34, borderRadius: 9, color: 'var(--text-tertiary)', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
                    title={showKey ? '隐藏' : '显示'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showKey ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </Field>

              <Field label="Base URL">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com"
                  spellCheck={false}
                  className="w-full"
                  style={inputStyle}
                />
              </Field>

              <Field label="模型名称">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="deepseek-v4-flash"
                  spellCheck={false}
                  className="w-full"
                  style={inputStyle}
                />
              </Field>
            </div>

            {/* LAN Server status — shown when server is running */}
            {lanUrls.length > 0 && (
              <div
                className="mt-5 pt-5 space-y-2"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <label className="block text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  局域网访问（手机扫码 / 输入地址）
                </label>
                {lanUrls.map((url) => (
                  <div
                    key={url}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
                  >
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-400" />
                    <code
                      className="text-[12px] flex-1 select-all"
                      style={{ color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {url}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(url); showToast({ message: '已复制', type: 'success' }) }}
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{ width: 28, height: 28, borderRadius: 7, color: 'var(--text-tertiary)' }}
                      title="复制地址"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                ))}
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  确保手机和电脑在同一局域网，手机浏览器打开以上地址即可使用。
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={close}
                className="px-4 py-2 text-[13px]"
                style={{ borderRadius: 10, color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
              >
                取消
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-[13px] font-medium"
                style={{
                  borderRadius: 10,
                  color: '#fff',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  boxShadow: '0 4px 14px rgba(10,132,255,0.35)',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: '"JetBrains Mono", monospace'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}
