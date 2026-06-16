import { motion } from 'framer-motion'
import { useState } from 'react'
import type { ComicSearchResult } from '../types'
import { useSetAtom } from 'jotai'
import { openReaderAtom } from '../atoms'
import { ActionButtons } from './ActionButtons'

export function ComicResultCard({ comic, index }: { comic: ComicSearchResult; index: number }) {
  const [coverFailed, setCoverFailed] = useState(false)
  const [coverLoaded, setCoverLoaded] = useState(false)
  const openReader = useSetAtom(openReaderAtom)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="flex-shrink-0"
      style={{ width: 158 }}
    >
      {/* cover */}
      <div
        onClick={() =>
          openReader({
            albumId: comic.id,
            albumTitle: comic.title,
            chapterId: '',
            chapterTitle: '',
            pages: [],
            coverUrl: comic.cover_url,
            author: comic.author
          })
        }
        className="relative overflow-hidden cursor-pointer"
        style={{
          aspectRatio: '3 / 4',
          borderRadius: 12,
          background: 'var(--surface-1)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.4)'
        }}
      >
        {/* placeholder */}
        <div
          className="absolute inset-0 shimmer-bg flex items-center justify-center"
          style={{
            opacity: coverFailed || !comic.cover_url || !coverLoaded ? 1 : 0,
            transition: 'opacity 0.3s var(--ease)'
          }}
        >
          <BookGlyph />
        </div>

        {comic.cover_url && !coverFailed && (
          <motion.img
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: coverLoaded ? 1 : 0, scale: coverLoaded ? 1 : 1.04 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            src={comic.cover_url}
            alt={comic.title}
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={() => setCoverLoaded(true)}
            onError={() => setCoverFailed(true)}
          />
        )}

        {/* hover overlay — "阅读" */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-200 flex items-end p-2.5"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%)'
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <span className="text-[11px] text-white/90 font-medium flex items-center gap-1">
            阅读正文
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </div>

      {/* meta */}
      <div className="mt-2.5 px-0.5">
        <h4
          className="text-[13px] font-medium leading-snug line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {comic.title}
        </h4>
        <p className="mt-0.5 text-[11.5px] truncate" style={{ color: 'var(--text-tertiary)' }}>
          {comic.author}
          {comic.category ? ` · ${comic.category}` : ''}
        </p>
        <p
          className="mt-0.5 text-[10.5px] truncate"
          style={{ color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}
        >
          ID {comic.id}
        </p>
      </div>

      {/* action buttons */}
      <div className="mt-1.5 px-0.5 flex justify-center">
        <ActionButtons comic={comic} />
      </div>
    </motion.div>
  )
}

function BookGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
