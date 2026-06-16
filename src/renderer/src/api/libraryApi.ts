/**
 * Library API — in Electron mode uses local IndexedDB directly, in HTTP/mobile
 * mode proxies to the PC server so favorites/likes/history sync automatically.
 */
import type { FavoriteRecord, LikeRecord, HistoryRecord } from '../db/index'
import { getServerUrl } from './httpClient'

const isHttp = ((window as any).api?._transport) === 'http'

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getServerUrl()}${path}`)
  return res.json() as T
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${getServerUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return res.json() as T
}

// ---- Favorites ----

export async function isFavorite(albumId: string): Promise<boolean> {
  if (!isHttp) {
    const { isFavorite: local } = await import('../db/index')
    return local(albumId)
  }
  const favs = await apiGet<FavoriteRecord[]>('/api/library/favorites')
  return favs.some(f => f.albumId === albumId)
}

export async function toggleFavorite(record: FavoriteRecord): Promise<boolean> {
  if (!isHttp) {
    const { toggleFavorite: local } = await import('../db/index')
    return local(record)
  }
  // The server toggles and returns the updated list; check if now favorited
  const res = await apiPost<{ success: boolean; data: FavoriteRecord[] }>('/api/library/favorites', record)
  return res.data.some(f => f.albumId === record.albumId)
}

export async function getFavorites(): Promise<FavoriteRecord[]> {
  if (!isHttp) {
    const { getFavorites: local } = await import('../db/index')
    return local()
  }
  return apiGet<FavoriteRecord[]>('/api/library/favorites')
}

// ---- Likes ----

export async function isLiked(albumId: string): Promise<boolean> {
  if (!isHttp) {
    const { isLiked: local } = await import('../db/index')
    return local(albumId)
  }
  const likes = await apiGet<LikeRecord[]>('/api/library/likes')
  return likes.some(l => l.albumId === albumId)
}

export async function toggleLike(record: LikeRecord): Promise<boolean> {
  if (!isHttp) {
    const { toggleLike: local } = await import('../db/index')
    return local(record)
  }
  const res = await apiPost<{ success: boolean; data: LikeRecord[] }>('/api/library/likes', record)
  return res.data.some(l => l.albumId === record.albumId)
}

export async function getLikes(): Promise<LikeRecord[]> {
  if (!isHttp) {
    const { getLikes: local } = await import('../db/index')
    return local()
  }
  return apiGet<LikeRecord[]>('/api/library/likes')
}

// ---- History ----

export async function addHistory(record: Omit<HistoryRecord, 'id'>): Promise<void> {
  if (!isHttp) {
    const { addHistory: local } = await import('../db/index')
    return local(record)
  }
  await apiPost('/api/library/history', record)
}

export async function getHistory(): Promise<HistoryRecord[]> {
  if (!isHttp) {
    const { getHistory: local } = await import('../db/index')
    return local()
  }
  return apiGet<HistoryRecord[]>('/api/library/history')
}

// ---- Downloads (local-only, no remote sync needed) ----

export async function getAlbumDownloadProgress(albumId: string): Promise<number | null> {
  // Downloads are tracked per-device (PC downloads, phone just watches SSE)
  // Always use local DB for this
  const { getAlbumDownloadProgress: local } = await import('../db/index')
  return local(albumId)
}

// For Sidebar listing
export { getDownloads, upsertDownload } from '../db/index'
