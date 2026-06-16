import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useSetAtom } from 'jotai'
import { openSettingsAtom } from '../atoms/settings'

const isMac = window.api?.platform === 'darwin'

export function TitleBar() {
  const [hovered, setHovered] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const openSettings = useSetAtom(openSettingsAtom)

  useEffect(() => {
    if (isMac) return
    window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizeChange(setMaximized)
  }, [])

  return (
    <div
      className="drag-region flex items-center justify-between flex-shrink-0"
      style={{ height: 48, padding: '0 20px', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* left: traffic lights */}
      <div
        className="no-drag flex items-center"
        style={{ width: 80, gap: 8 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isMac ? null : (
          <>
            <Light color="#FF5F57" hovered={hovered} label="关闭" onClick={() => window.api.window.close()}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="3.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </Light>
            <Light color="#FEBC2E" hovered={hovered} label="最小化" onClick={() => window.api.window.minimize()}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="3.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </Light>
            <Light color="#28C840" hovered={hovered} label={maximized ? '还原' : '最大化'} onClick={() => window.api.window.toggleMaximize()}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="rgba(0,0,0,0.55)"><path d="M10 4 L4 10 L8 10 L8 14 L14 8 L10 8 Z" transform="translate(7 0)" /><path d="M14 20 L20 14 L16 14 L16 10 L10 16 L14 16 Z" transform="translate(-7 0)" /></svg>
            </Light>
          </>
        )}
      </div>

      {/* center: app identity */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-2 pointer-events-none select-none"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
          Comic Agent
        </span>
        <span
          className="ml-1 inline-block rounded-full"
          style={{ width: 6, height: 6, background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}
          title="就绪"
        />
      </motion.div>

      {/* right: settings gear + balance spacer */}
      <div className="no-drag flex items-center justify-end" style={{ width: 80 }}>
        <motion.button
          whileHover={{ rotate: 60, scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          onClick={openSettings}
          aria-label="设置"
          title="设置 API Key / 接口地址"
          className="flex items-center justify-center"
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            color: 'var(--text-secondary)',
            background: 'transparent'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}

function Light({
  color,
  hovered,
  label,
  onClick,
  children
}: {
  color: string
  hovered: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex items-center justify-center"
      style={{
        width: 13,
        height: 13,
        borderRadius: '50%',
        background: color,
        border: '0.5px solid rgba(0,0,0,0.16)',
        boxShadow: '0 0 0 0.5px rgba(0,0,0,0.14) inset'
      }}
    >
      <span style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.12s var(--ease)', display: 'flex' }}>
        {children}
      </span>
    </motion.button>
  )
}
