import { useAtomValue, useSetAtom } from 'jotai'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { sidebarOpenAtom, sidebarActiveTabAtom, closeSidebarAtom } from '../atoms/sidebar'
import type { SidebarTab as SidebarTabType } from '../atoms/sidebar'
import { SidebarHandle, SIDEBAR_SPRING } from './SidebarHandle'
import { SidebarTabView } from './SidebarTab'
import { useEffect } from 'react'
import { db } from '../db'
import type { FavoriteRecord, LikeRecord, HistoryRecord, DownloadRecord } from '../db'

const SIDEBAR_WIDTH = 320
const TABS: { key: SidebarTabType; icon: React.JSX.Element }[] = [
  {
    key: 'favorites',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  },
  {
    key: 'likes',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
  },
  {
    key: 'history',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  },
  {
    key: 'downloads',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
  }
]

export function Sidebar() {
  const open = useAtomValue(sidebarOpenAtom)
  const activeTab = useAtomValue(sidebarActiveTabAtom)
  const setActiveTab = useSetAtom(sidebarActiveTabAtom)
  const closeSidebar = useSetAtom(closeSidebarAtom)

  // Reactive lists: useLiveQuery re-runs whenever the matching table changes,
  // so favoriting/liking a comic from anywhere is reflected here immediately.
  // (Previously these were plain useState hydrated only on open/tab-change, so
  //  a favorite toggled while the panel was open never appeared in the list.)
  // Each querier swallows errors → [] so a DB hiccup can never blank the app.
  const favorites = useLiveQuery(
    () => db.favorites.orderBy('addedAt').reverse().toArray().catch(() => [] as FavoriteRecord[]),
    [], []
  )
  const likes = useLiveQuery(
    () => db.likes.orderBy('createdAt').reverse().toArray().catch(() => [] as LikeRecord[]),
    [], []
  )
  const history = useLiveQuery(
    () => db.history.orderBy('visitedAt').reverse().toArray().catch(() => [] as HistoryRecord[]),
    [], []
  )
  const downloads = useLiveQuery(
    () => db.downloads.orderBy('startedAt').reverse().toArray().catch(() => [] as DownloadRecord[]),
    [], []
  )

  // Esc key closes sidebar
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeSidebar])

  return (
    <>
      <SidebarHandle />

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -SIDEBAR_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: -SIDEBAR_WIDTH }}
            transition={SIDEBAR_SPRING}
            className="fixed left-0 top-0 bottom-0 z-40 flex flex-col"
            style={{
              width: SIDEBAR_WIDTH,
              background: 'rgba(20,20,23,0.92)',
              backdropFilter: 'var(--blur-lg)',
              WebkitBackdropFilter: 'var(--blur-lg)',
              borderRight: '1px solid var(--border)',
              boxShadow: '4px 0 32px rgba(0,0,0,0.35)'
            }}
          >
            {/* Tab bar */}
            <div
              className="flex items-center gap-1 px-3 py-3 drag-region"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              {TABS.map((t) => (
                <TabButton
                  key={t.key}
                  active={activeTab === t.key}
                  icon={t.icon}
                  label={TAB_LABELS[t.key]}
                  onClick={() => setActiveTab(t.key)}
                />
              ))}

              <button
                onClick={closeSidebar}
                onMouseDown={(e) => e.stopPropagation()}
                title="收起"
                className="no-drag ml-auto flex items-center justify-center"
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  color: 'var(--text-tertiary)',
                  background: 'transparent'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <SidebarTabView
              tab={activeTab}
              favorites={favorites}
              likes={likes}
              history={history}
              downloads={downloads}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

const TAB_LABELS: Record<SidebarTabType, string> = {
  favorites: '收藏',
  likes: '喜欢',
  downloads: '下载',
  history: '历史'
}

function TabButton({ active, icon, label, onClick }: {
  active: boolean
  icon: React.JSX.Element
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="no-drag flex items-center gap-1.5 px-3 py-1.5 transition-colors text-[12px]"
      style={{
        borderRadius: 8,
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
