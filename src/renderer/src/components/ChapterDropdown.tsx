import { motion, AnimatePresence } from 'framer-motion'
import { useRef, useEffect } from 'react'
import type { ChapterInfo } from '../types'

/**
 * Custom glass-styled chapter dropdown (replaces the old button grid).
 * Self-contained trigger + absolutely-positioned panel. Controlled: the
 * parent owns the `open` flag (it doubles as the reader's showChapterList
 * state, which also gates keyboard page-nav). Esc is handled by the parent
 * so it closes the dropdown before closing the reader.
 */
export function ChapterDropdown({
  chapters,
  currentId,
  open,
  onOpenChange,
  onSelect
}: {
  chapters: ChapterInfo[]
  currentId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (id: string, title: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const currentTitle = chapters.find((c) => c.id === currentId)?.title

  // Close when a pointer lands outside the dropdown.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open, onOpenChange])

  return (
    <div ref={rootRef} className="relative no-drag">
      <button
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 glass transition-colors"
        style={{ borderRadius: 10 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span className="text-[12.5px] max-w-[180px] truncate" style={{ color: 'var(--text-secondary)' }}>
          {currentTitle || '章节'}
        </span>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s var(--ease)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 glass-raised"
            style={{
              borderRadius: 12,
              minWidth: 220,
              maxWidth: 320,
              maxHeight: 340,
              overflowY: 'auto',
              top: 'calc(100% + 8px)',
              left: 0
            }}
          >
            {chapters.map((ch) => {
              const active = ch.id === currentId
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    onSelect(ch.id, ch.title)
                    onOpenChange(false)
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${active ? '' : 'hover:bg-white/10'}`}
                  style={{ background: active ? 'var(--accent-soft)' : undefined }}
                >
                  <span className="text-[12.5px] truncate" style={{ color: 'var(--text-primary)' }}>{ch.title}</span>
                  {ch.page_count ? (
                    <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{ch.page_count}P</span>
                  ) : null}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
