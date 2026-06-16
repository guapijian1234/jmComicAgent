import { useRef, useState, useEffect } from 'react'
import type { PageInfo } from '../types'

const MIN_SCALE = 1
const MAX_SCALE = 5
const DRAG_THRESHOLD = 4 // px — sub-threshold motion counts as a click, not a drag
const CLICK_DELAY = 200 // ms — wait for a possible double-click before flipping

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Single-page reader: one image at a time.
 *
 * Zoom: plain mouse wheel zooms (no other use for the wheel here), anchored to
 * the cursor so the point under the pointer stays put. Range 1×–5×.
 * Pan: once zoomed in, drag to pan; clamped so the image can't be lost.
 * Double-click toggles between fit (1×) and 2×.
 * Click to flip: click left/right half of the stage for prev/next — deferred
 * briefly so a double-click can cancel it (and skipped if the press was a drag).
 *
 * NOTE: the image is a plain <img>, not motion.img — framer-motion claims the
 * `transform` style, which would fight the zoom/pan transform we set here. The
 * per-page fade-in is a CSS animation on opacity only (see globals.css).
 */
export function SinglePageViewer({
  pages,
  page,
  go,
  total
}: {
  pages: PageInfo[]
  page: number
  go: (p: number) => void
  total: number
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Displayed (contained) image size, measured from layout — offsetWidth/Height
  // ignore the CSS transform, so this is the unzoomed fit size.
  const [disp, setDisp] = useState({ w: 0, h: 0 })
  const dispRef = useRef(disp)
  dispRef.current = disp

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const viewRef = useRef(view)
  viewRef.current = view

  const [dragging, setDragging] = useState(false)
  // drag start snapshot (screen pos + translate at press time) — read by the
  // window mousemove listener, which isn't a React handler so it can't see
  // fresh state without this.
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  // did the latest press move enough to count as a drag? lives past mouseup so
  // the click handler can read it (mouseup fires before click).
  const movedRef = useRef(false)
  // pending flip timer, cancelled if a double-click follows the click
  const clickTimer = useRef<number | null>(null)

  const measureImg = () => {
    const img = imgRef.current
    if (img && img.offsetWidth > 0) setDisp({ w: img.offsetWidth, h: img.offsetHeight })
  }

  // Reset zoom/pan + cancel any pending flip on page turn or chapter change.
  useEffect(() => {
    setView({ scale: 1, tx: 0, ty: 0 })
    movedRef.current = false
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
  }, [page, pages])

  // Clear pending flip on unmount.
  useEffect(() => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current)
  }, [])

  // Re-measure on viewport resize (image re-fits → disp changes).
  useEffect(() => {
    const onResize = () => measureImg()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Cursor-anchored wheel zoom. Attached as a non-passive native listener so we
  // can preventDefault (React's onWheel is passive in some browsers).
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // cursor relative to stage center (the image is centered)
      const cx = e.clientX - (rect.left + rect.width / 2)
      const cy = e.clientY - (rect.top + rect.height / 2)
      const d = dispRef.current
      setView((v) => {
        const next = clamp(v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_SCALE, MAX_SCALE)
        if (next === v.scale) return v
        // image-local point under the cursor before this zoom step
        const px = (cx - v.tx) / v.scale
        const py = (cy - v.ty) / v.scale
        // pan bounds at the new scale (only when image overflows the stage)
        const ow = Math.max(0, (d.w * next - el.clientWidth) / 2)
        const oh = Math.max(0, (d.h * next - el.clientHeight) / 2)
        return {
          scale: next,
          tx: clamp(cx - px * next, -ow, ow),
          ty: clamp(cy - py * next, -oh, oh)
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Window-level drag tracking so panning keeps working when the cursor leaves
  // the stage mid-drag.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const start = dragRef.current
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true
      const d = dispRef.current
      const el = stageRef.current!
      const scale = viewRef.current.scale
      const ow = Math.max(0, (d.w * scale - el.clientWidth) / 2)
      const oh = Math.max(0, (d.h * scale - el.clientHeight) / 2)
      setView((v) => ({
        ...v,
        tx: clamp(start.tx + dx, -ow, ow),
        ty: clamp(start.ty + dy, -oh, oh)
      }))
    }
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null
        setDragging(false)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    movedRef.current = false // every fresh press starts clean
    if (viewRef.current.scale <= 1.001) return // only pan once zoomed in
    dragRef.current = { x: e.clientX, y: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty }
    setDragging(true)
  }

  const onClick = (e: React.MouseEvent) => {
    if (movedRef.current) {
      movedRef.current = false
      return // it was a pan, not a click-to-flip
    }
    if (e.detail >= 2) return // the trailing click of a double-click — let dblclick handle it
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const target = e.clientX < rect.left + rect.width / 2 ? page - 1 : page + 1
    // defer the flip so a double-click can cancel it (zoom vs. flip)
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(() => {
      go(target)
      clickTimer.current = null
    }, CLICK_DELAY)
  }

  const onDoubleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    setView((v) => (v.scale > 1.001 ? { scale: 1, tx: 0, ty: 0 } : { scale: 2, tx: 0, ty: 0 }))
  }

  const cursor = dragging ? 'grabbing' : view.scale > 1.001 ? 'grab' : 'default'

  return (
    <>
      <div
        ref={stageRef}
        className="flex-1 flex items-center justify-center overflow-hidden p-6 min-h-0"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <img
          ref={imgRef}
          key={page}
          src={pages[page]?.url}
          alt={`第 ${page + 1} 页`}
          draggable={false}
          onLoad={measureImg}
          className="max-w-full max-h-full object-contain select-none no-drag"
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.1s ease-out',
            borderRadius: 4,
            boxShadow: '0 12px 50px rgba(0,0,0,0.6)',
            animation: 'reader-fade-in 0.25s var(--ease)'
          }}
        />
      </div>

      {/* page navigation */}
      <div className="flex items-center justify-center gap-3 py-3.5">
        <NavButton dir="prev" disabled={page === 0} onClick={() => go(page - 1)} />
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 glass" style={{ borderRadius: 20 }}>
          {Array.from({ length: Math.min(total, 24) }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === page ? 18 : 5,
                height: 5,
                borderRadius: 3,
                background: i === page ? 'var(--accent)' : 'rgba(255,255,255,0.18)',
                transition: 'width 0.25s var(--ease), background 0.25s var(--ease)'
              }}
            />
          ))}
          {total > 24 && (
            <span className="text-[11px] ml-1" style={{ color: 'var(--text-tertiary)' }}>+{total - 24}</span>
          )}
        </div>
        <NavButton dir="next" disabled={total > 0 && page === total - 1} onClick={() => go(page + 1)} />
      </div>
    </>
  )
}

function NavButton({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center glass"
      style={{ width: 34, height: 34, borderRadius: 10, opacity: disabled ? 0.3 : 1, cursor: disabled ? 'default' : 'pointer' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir === 'prev' ? 'none' : 'rotate(180deg)' }}>
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}
