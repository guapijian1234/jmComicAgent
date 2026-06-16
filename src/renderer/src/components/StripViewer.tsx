import { useRef, useState, useEffect } from 'react'
import type { PageInfo } from '../types'

const MIN_COL = 0.5
const MAX_COL = 3
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Strip reader: every page stitched top-to-bottom into one scrollable column
 * (webtoon-style). Plain wheel scrolls vertically; Ctrl/⌘+wheel (incl. trackpad
 * pinch) scales the column width. Images lazy-load so a long chapter doesn't
 * decode everything up front.
 */
export function StripViewer({ pages }: { pages: PageInfo[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [baseW, setBaseW] = useState(0) // 1× column width = container width (capped)
  const [colScale, setColScale] = useState(1)

  // Measure the base column width from the viewport; cap so ultra-wide windows
  // don't stretch comics into a thin horizontal band.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth - 48 // stage padding
      setBaseW(Math.max(280, Math.min(w, 900)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Reset scroll position and zoom when the chapter changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    setColScale(1)
  }, [pages])

  // Ctrl/⌘+wheel zooms the column width. Plain wheel is left to scroll natively.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setColScale((s) => clamp(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_COL, MAX_COL))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keyboard scrolling (ReaderOverlay skips arrow nav in strip mode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scrollRef.current
      if (!el) return
      if (e.key === ' ' || e.key === 'PageDown' || e.key === 'ArrowDown') {
        e.preventDefault()
        el.scrollBy({ top: el.clientHeight * 0.9, behavior: 'smooth' })
      } else if (e.key === 'PageUp' || e.key === 'ArrowUp') {
        e.preventDefault()
        el.scrollBy({ top: -el.clientHeight * 0.9, behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const width = Math.round(baseW * colScale)

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
      <div className="flex flex-col items-center gap-1 py-4">
        {pages.map((p, i) => (
          <img
            key={i}
            src={p.url}
            alt={`第 ${i + 1} 页`}
            loading="lazy"
            draggable={false}
            className="no-drag select-none"
            style={{ width, height: 'auto', display: 'block', borderRadius: 4 }}
          />
        ))}
        <div className="h-10" />
      </div>
    </div>
  )
}
