import { useAtomValue, useSetAtom } from 'jotai'
import { sidebarOpenAtom, toggleSidebarAtom, openSidebarAtom, closeSidebarAtom } from '../atoms/sidebar'
import { motion } from 'framer-motion'
import { useCallback, useRef } from 'react'

const SIDEBAR_WIDTH = 320
const OPEN_THRESHOLD = 0.3 * SIDEBAR_WIDTH   // drag right ~96px → open
const CLOSE_THRESHOLD = -0.3 * SIDEBAR_WIDTH // drag left  ~96px → close

/** Shared spring — the handle imports this so it slides in lockstep with the
 *  panel (same stiffness/damping → identical bounce, no drift between them). */
export const SIDEBAR_SPRING = { type: 'spring' as const, stiffness: 260, damping: 18, mass: 0.8 }

/**
 * The pull-tab. A single rounded tab that lives at the screen's left edge when
 * closed and slides out to the panel's right edge when open — moving with the
 * sidebar, not independently. Click toggles; drag (right opens / left closes).
 *
 * Previously a 4px rail + separate tab; the rail was invisible/pointless, so
 * it's gone — the tab is the whole control now.
 */
export function SidebarHandle() {
  const open = useAtomValue(sidebarOpenAtom)
  const toggle = useSetAtom(toggleSidebarAtom)
  const openSidebar = useSetAtom(openSidebarAtom)
  const closeSidebar = useSetAtom(closeSidebarAtom)
  const startX = useRef(0)
  const moved = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    startX.current = e.clientX
    moved.current = false
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current
      if (Math.abs(dx) > 4) moved.current = true
      if (!open && dx > OPEN_THRESHOLD) { openSidebar(); cleanup() }
      else if (open && dx < CLOSE_THRESHOLD) { closeSidebar(); cleanup() }
    }
    const onUp = () => cleanup()
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [open, openSidebar, closeSidebar])

  const onClick = useCallback(() => {
    if (moved.current) { moved.current = false; return } // was a drag, suppress toggle
    toggle()
  }, [toggle])

  return (
    <motion.button
      onMouseDown={onMouseDown}
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      title={open ? '收起侧栏' : '展开收藏 / 喜欢 / 下载'}
      initial={false}
      animate={{ x: open ? SIDEBAR_WIDTH : 0 }}
      transition={SIDEBAR_SPRING}
      className="fixed left-0 z-[45] flex items-center justify-center cursor-pointer"
      style={{
        top: 'calc(50% - 34px)',
        width: 16,
        height: 68,
        borderRadius: 10,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        background: open ? 'var(--surface-3)' : 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderLeft: 'none',
        color: open ? 'var(--accent)' : 'var(--text-secondary)',
        boxShadow: '2px 0 14px rgba(0,0,0,0.4)',
        WebkitBackdropFilter: 'var(--blur-sm)'
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {open
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </motion.button>
  )
}
