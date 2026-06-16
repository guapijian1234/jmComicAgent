import { useCallback, useEffect, useRef } from 'react'
import { useSetAtom } from 'jotai'
import { upsertDownload, getAlbumDownloadProgress, type DownloadRecord } from '../db'
import { showToastAtom } from '../atoms/toast'

export function useDownload(albumId: string, title: string, author: string, coverUrl?: string) {
  const showToast = useSetAtom(showToastAtom)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Listen for download progress and persist to DB
  useEffect(() => {
    const cleanup = window.api.download.onProgress((data) => {
      if (data.albumId !== albumId) return
      const record: DownloadRecord = {
        albumId: data.albumId,
        chapterId: data.chapterId || albumId,
        title,
        author,
        coverUrl,
        chapterTitle: data.chapterId ?? '',
        progress: data.progress,
        status: data.status as DownloadRecord['status'],
        startedAt: Date.now(),
        completedAt: data.status === 'done' || data.status === 'error' ? Date.now() : undefined
      }
      upsertDownload(record)

      // Show toast on completion
      if (data.status === 'done') {
        showToast({ message: `✓ 《${title}》下载完成`, type: 'success' })
      } else if (data.status === 'error') {
        showToast({ message: `✗ 《${title}》下载失败 — ${data.error || '未知错误'}`, type: 'error' })
      }
    })
    cleanupRef.current = cleanup
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [albumId, title, author, coverUrl, showToast])

  const startDownload = useCallback(async () => {
    const progress = await getAlbumDownloadProgress(albumId)
    if (progress !== null) {
      // Already has records — user may want to restart
    }
    await window.api.download.start(albumId)
  }, [albumId])

  const cancelDownload = useCallback(async () => {
    await window.api.download.cancel(albumId)
  }, [albumId])

  return { startDownload, cancelDownload }
}
