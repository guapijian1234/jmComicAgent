import { motion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  readerAtom, closeReaderAtom, setReaderLoadingAtom,
  setReaderPagesAtom, setReaderChaptersAtom, setChapterListOpenAtom,
  readerModeAtom, setReaderModeAtom
} from '../atoms'
import { useRef, useState, useCallback, useEffect } from 'react'
import { normalizeChapters, normalizeChapterPages } from '../utils/normalize'
import { isMobile } from '../utils/isMobile'
import { ChapterDropdown } from './ChapterDropdown'
import { SinglePageViewer } from './SinglePageViewer'
import { StripViewer } from './StripViewer'
import { ActionButtons } from './ActionButtons'
import type { ReaderMode } from '../types'

const mobile = isMobile()

export function ReaderOverlay() {
  const reader = useAtomValue(readerAtom)
  const mode = useAtomValue(readerModeAtom)
  const closeReader = useSetAtom(closeReaderAtom)
  const setLoading = useSetAtom(setReaderLoadingAtom)
  const setPages = useSetAtom(setReaderPagesAtom)
  const setChapters = useSetAtom(setReaderChaptersAtom)
  const setChapterListOpen = useSetAtom(setChapterListOpenAtom)
  const setMode = useSetAtom(setReaderModeAtom)
  const [page, setPage] = useState(reader.currentPage)

  const total = reader.pages.length
  const go = useCallback((p: number) => setPage((c) => Math.max(0, Math.min(p, total - 1))), [total])

  // Download + decode a chapter's images (heavy: fetches every page over the
  // proxy). Returns the decoded pages or surfaces an error message.
  const loadChapter = useCallback(async (albumId: string, chapterId: string, chapterTitle: string) => {
    setLoading(true)
    try {
      const res = await window.api.comic.fetchChapterPages(albumId, chapterId)
      if (!res.success) {
        setPages({ chapterId, chapterTitle, pages: [] })
        return
      }
      const pagesData = normalizeChapterPages(res.data)
      setPages({ chapterId, chapterTitle, pages: pagesData })
      setPage(0)
    } catch {
      setPages({ chapterId, chapterTitle, pages: [] })
    }
  }, [setLoading, setPages])

  // Fetch album detail on open, then auto-load the first chapter (single or
  // multi). Multi-chapter albums expose the dropdown to switch chapters.
  useEffect(() => {
    if (!reader.isOpen || !reader.albumId) return
    const albumId = reader.albumId
    const albumTitle = reader.albumTitle ?? ''

    const fetchData = async () => {
      setLoading(true)
      try {
        const detailRes = await window.api.comic.fetchAlbumDetail(albumId)
        const chapters = detailRes.success ? normalizeChapters(detailRes.data) : []
        setChapters(chapters)
        const ch = chapters[0]
        await loadChapter(albumId, ch?.id ?? albumId, ch?.title ?? albumTitle)
      } catch {
        setLoading(false)
      }
    }
    fetchData()
  }, [reader.isOpen, reader.albumId, reader.albumTitle, loadChapter, setLoading, setChapters])

  // Hydrate the saved reading mode from config, then persist subsequent changes.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    let cancelled = false
    window.api.config.get()
      .then((cfg) => {
        if (cancelled) return
        const m = cfg.readerMode
        if (m === 'single' || m === 'strip') setMode(m)
        setHydrated(true)
      })
      .catch(() => setHydrated(true))
    return () => { cancelled = true }
  }, [setMode])

  useEffect(() => {
    if (!hydrated) return
    window.api.config.set('readerMode', mode)
  }, [mode, hydrated])

  // Keyboard: Esc closes dropdown before reader; arrows flip pages only in
  // single mode (strip mode scrolls via StripViewer's own handler).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!reader.isOpen) return
      if (e.key === 'Escape') {
        if (reader.showChapterList) setChapterListOpen(false)
        else closeReader()
      } else if (mode === 'single' && !reader.showChapterList) {
        if (e.key === 'ArrowLeft' || e.key === 'a') go(page - 1)
        else if (e.key === 'ArrowRight' || e.key === 'd') go(page + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reader.isOpen, reader.showChapterList, mode, page, go, closeReader, setChapterListOpen])

  const hasMultipleChapters = reader.chapters.length > 1

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50"
    >
      {/* Frosted backdrop lives on a LEAF with no descendants. Previously it sat
         on this root, and the zooming image's transform (plus page-turn remounts,
         fade-ins, dropdown AnimatePresence) churned descendant compositor layers,
         which made Chromium drop the sampled backdrop → flat rgba(0,0,0,0.78) =
         "black background". As a leaf, nothing under it can invalidate it; the
         content below is a sibling, so its transforms no longer reach it. */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'var(--blur-lg)', WebkitBackdropFilter: 'var(--blur-lg)' }}
      />
      {/* content layer — sits above the backdrop leaf */}
      <div className="relative z-[1] flex flex-col h-full">
      {/* top bar */}
      <div
        className={`flex items-center justify-between drag-region ${mobile ? 'px-2.5 py-2' : 'px-5 py-3.5'}`}
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(20,20,23,0.4)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={closeReader}
            className="no-drag flex items-center gap-1.5 px-2.5 py-1.5 glass flex-shrink-0"
            style={{ borderRadius: 10 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>返回</span>
          </button>

          {reader.albumId && (
            <ActionButtons comic={{
              id: reader.albumId,
              title: reader.albumTitle ?? '',
              author: reader.author ?? '',
              cover_url: reader.coverUrl
            }} />
          )}

          {hasMultipleChapters && (
            <ChapterDropdown
              chapters={reader.chapters}
              currentId={reader.chapterId}
              open={reader.showChapterList}
              onOpenChange={setChapterListOpen}
              onSelect={(id, title) => loadChapter(reader.albumId!, id, title)}
            />
          )}
        </div>

        {mobile ? (
          /* On phones the album title is long and the bar is narrow — the
             chapter picker already shows the chapter, so only the page index
             belongs here. Keeping it off the bar frees the full width for the
             back / actions / chapter / mode controls and stops the title from
             wrapping and stealing vertical space from the page. */
          <div className="text-center pointer-events-none flex-shrink-0 px-2">
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {reader.chapterTitle ? `${reader.chapterTitle} · ` : ''}
              {mode === 'single' ? `${page + 1}/${total || '?'}` : `${total || '?'}页`}
            </p>
          </div>
        ) : (
          <div className="text-center pointer-events-none flex-1 min-w-0">
            <p className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {reader.albumTitle}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {reader.chapterTitle ? `${reader.chapterTitle} · ` : ''}
              {mode === 'single' ? `第 ${page + 1} / ${total || '?'} 页` : `${total || '?'} 页`}
            </p>
          </div>
        )}

        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* stage */}
      {reader.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
            <div className="dot-pulse mb-4">
              <span /><span /><span />
            </div>
            <p className="text-[13px]">加载中...</p>
          </div>
        </div>
      ) : reader.pages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
            <p className="text-[14px]">暂无页面数据</p>
            <p className="text-[12px] mt-1">无法加载此漫画的图片</p>
          </div>
        </div>
      ) : mode === 'single' ? (
        <SinglePageViewer pages={reader.pages} page={page} go={go} total={total} />
      ) : (
        <StripViewer pages={reader.pages} />
      )}
      </div>
    </motion.div>
  )
}

function ModeToggle({ mode, onChange }: { mode: ReaderMode; onChange: (m: ReaderMode) => void }) {
  return (
    <div className="no-drag flex items-center gap-1 p-1 glass" style={{ borderRadius: 10 }}>
      <ToggleButton active={mode === 'single'} onClick={() => onChange('single')} title="单页模式">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="4" width="12" height="16" rx="2" />
        </svg>
      </ToggleButton>
      <ToggleButton active={mode === 'strip'} onClick={() => onChange('strip')} title="连读模式">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="4" width="14" height="4.5" rx="1.2" />
          <rect x="5" y="10" width="14" height="4.5" rx="1.2" />
          <rect x="5" y="16" width="14" height="4.5" rx="1.2" />
        </svg>
      </ToggleButton>
    </div>
  )
}

function ToggleButton({ active, onClick, title, children }: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center transition-colors"
      style={{
        width: 30,
        height: 28,
        borderRadius: 7,
        color: active ? '#fff' : 'var(--text-secondary)',
        background: active ? 'var(--accent)' : 'transparent'
      }}
    >
      {children}
    </button>
  )
}
