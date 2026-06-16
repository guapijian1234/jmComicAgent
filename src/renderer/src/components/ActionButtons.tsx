import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import { isFavorite, isLiked, toggleFavorite, toggleLike } from '../api/libraryApi'
import type { ComicSearchResult } from '../types'
import { useDownload } from '../hooks/useDownload'
import { DownloadProgress } from './DownloadProgress'

interface Props {
  comic: ComicSearchResult
}

export function ActionButtons({ comic }: Props) {
  const [favorited, setFavorited] = useState(false)
  const [liked, setLiked] = useState(false)
  const [animatingFav, setAnimatingFav] = useState(false)
  const [animatingLike, setAnimatingLike] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadPct, setDownloadPct] = useState(0)

  const { startDownload } = useDownload(comic.id, comic.title, comic.author, comic.cover_url)

  // Hydrate state from DB on mount
  useEffect(() => {
    let cancelled = false
    Promise.all([isFavorite(comic.id), isLiked(comic.id)]).then(([fav, like]) => {
      if (cancelled) return
      setFavorited(fav)
      setLiked(like)
    })
    return () => { cancelled = true }
  }, [comic.id])

  // Listen for download progress for this specific album
  useEffect(() => {
    const cleanup = window.api.download.onProgress((data) => {
      if (data.albumId !== comic.id) return
      const active = data.status === 'downloading' || data.status === 'pending'
      setDownloading(active)
      setDownloadPct(data.progress)
    })
    return () => cleanup()
  }, [comic.id])

  const handleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    // Optimistic: flip the icon immediately so the click feels instant — the
    // IndexedDB round-trip can lag when the event loop is busy (e.g. the
    // sidebar loading covers). We reconcile if the DB disagreed.
    const next = !favorited
    setFavorited(next)
    setAnimatingFav(true)
    setTimeout(() => setAnimatingFav(false), 300)
    const result = await toggleFavorite({
      albumId: comic.id,
      title: comic.title,
      author: comic.author,
      coverUrl: comic.cover_url,
      category: comic.category,
      tags: comic.tags,
      addedAt: Date.now()
    })
    if (result !== next) setFavorited(result)
  }, [comic, favorited])

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !liked
    setLiked(next)
    setAnimatingLike(true)
    setTimeout(() => setAnimatingLike(false), 300)
    const result = await toggleLike({
      albumId: comic.id,
      title: comic.title,
      author: comic.author,
      coverUrl: comic.cover_url,
      category: comic.category,
      tags: comic.tags,
      createdAt: Date.now()
    })
    if (result !== next) setLiked(result)
  }, [comic, liked])

  return (
    <div className="flex items-center gap-1">
      {/* Favorite */}
      <motion.button
        onClick={handleFavorite}
        animate={{ scale: animatingFav ? [1, 1.2, 1] : 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        title={favorited ? '取消收藏' : '收藏'}
        className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={favorited ? 'var(--accent)' : 'none'} stroke={favorited ? 'var(--accent)' : 'var(--text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </motion.button>

      {/* Like */}
      <motion.button
        onClick={handleLike}
        animate={{ scale: animatingLike ? [1, 1.2, 1] : 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        title={liked ? '取消喜欢' : '喜欢'}
        className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={liked ? 'var(--danger)' : 'none'} stroke={liked ? 'var(--danger)' : 'var(--text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </motion.button>

      {/* Download */}
      {downloading ? (
        <div className="p-1.5">
          <DownloadProgress percent={downloadPct} size={20} />
        </div>
      ) : (
        <motion.button
          onClick={(e) => { e.stopPropagation(); startDownload() }}
          title="下载"
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </motion.button>
      )}
    </div>
  )
}
