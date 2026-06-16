import { useRef, useEffect, useState, type KeyboardEvent } from 'react'
import { useAtomValue, useAtom } from 'jotai'
import { streamingAtom, inputAtom } from '../atoms'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  send: (text: string) => void
  cancel: () => void
}

export function ChatInput({ send, cancel }: Props) {
  const [value, setValue] = useAtom(inputAtom)
  const streaming = useAtomValue(streamingAtom)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const canSend = value.trim().length > 0 && !streaming

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const handleSend = () => {
    if (!canSend) return
    send(value)
    setValue('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="px-8 pb-7 pt-1 flex-shrink-0">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="glass-raised transition-all"
          style={{
            borderRadius: 20,
            padding: '7px 7px 7px 20px',
            borderColor: focused ? 'var(--border-glow)' : 'var(--border)',
            boxShadow: focused
              ? '0 0 0 3px rgba(10,132,255,0.14), 0 8px 32px rgba(0,0,0,0.3)'
              : '0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.28)',
            transition: 'border-color 0.25s var(--ease), box-shadow 0.25s var(--ease)'
          }}
        >
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => { setValue(e.target.value); adjustHeight() }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想看的漫画…"
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-[14px] min-w-0"
              style={{
                color: 'var(--text-primary)',
                lineHeight: '22px',
                padding: '8px 0',
                minHeight: 38,
                maxHeight: 160
              }}
            />

            <AnimatePresence mode="wait" initial={false}>
              {streaming ? (
                <motion.button
                  key="stop"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  onClick={cancel}
                  aria-label="停止"
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 38, height: 38, borderRadius: 13,
                    background: 'rgba(255,69,58,0.18)',
                    border: '1px solid rgba(255,69,58,0.3)'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,69,58,0.95)">
                    <rect x="6" y="6" width="12" height="12" rx="3" />
                  </svg>
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: canSend ? 1 : 0.4 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="发送"
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 38, height: 38, borderRadius: 13,
                    background: canSend
                      ? 'linear-gradient(135deg, var(--accent), var(--accent-2))'
                      : 'var(--surface-2)',
                    border: canSend ? 'none' : '1px solid var(--border-subtle)',
                    boxShadow: canSend ? '0 4px 14px rgba(10,132,255,0.35)' : 'none',
                    cursor: canSend ? 'pointer' : 'default',
                    transition: 'opacity 0.2s, background 0.2s'
                  }}
                >
                  <motion.svg
                    width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke={canSend ? 'white' : 'var(--text-tertiary)'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    whileHover={canSend ? { x: 1.5, y: -1.5 } : {}}
                  >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </motion.svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="text-center mt-2.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Agent 会调用工具检索，结果仅供参考
        </p>
      </motion.div>
    </div>
  )
}
