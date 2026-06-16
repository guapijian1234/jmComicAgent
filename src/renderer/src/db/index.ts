import Dexie, { type Table } from 'dexie'

export interface FavoriteRecord {
  albumId: string
  title: string
  author: string
  coverUrl?: string
  category?: string
  tags?: string[]
  addedAt: number
}

export interface LikeRecord {
  albumId: string
  title: string
  author: string
  coverUrl?: string
  category?: string
  tags?: string[]
  createdAt: number
}

export interface HistoryRecord {
  id?: number
  albumId: string
  title: string
  author: string
  coverUrl?: string
  chapterId?: string
  chapterTitle?: string
  visitedAt: number
}

export type DownloadStatus = 'pending' | 'downloading' | 'done' | 'error'

export interface DownloadRecord {
  albumId: string
  chapterId: string
  title: string
  author: string
  coverUrl?: string
  chapterTitle: string
  progress: number
  status: DownloadStatus
  localPath?: string
  startedAt?: number
  completedAt?: number
}

class LibraryDB extends Dexie {
  favorites!: Table<FavoriteRecord, string>
  likes!: Table<LikeRecord, string>
  history!: Table<HistoryRecord, number>
  downloads!: Table<DownloadRecord, [string, string]>

  constructor() {
    super('jmLibrary')
    this.version(1).stores({
      favorites: 'albumId',
      likes: 'albumId',
      history: '++id,albumId,visitedAt',
      downloads: '[albumId+chapterId],albumId,status'
    })
    // v2: index the sort fields so orderBy('addedAt'/'createdAt'/'startedAt')
    // works. Without these indexes Dexie throws SchemaError on orderBy — which
    // under useLiveQuery crashes the render tree (blank window). Safe additive
    // upgrade: existing rows are re-indexed automatically.
    this.version(2).stores({
      favorites: 'albumId, addedAt',
      likes: 'albumId, createdAt',
      history: '++id,albumId,visitedAt',
      downloads: '[albumId+chapterId],albumId,status, startedAt'
    })
  }
}

export const db = new LibraryDB()

// --- Favorites helpers ---

export async function isFavorite(albumId: string): Promise<boolean> {
  const record = await db.favorites.get(albumId)
  return record !== undefined
}

export async function toggleFavorite(record: FavoriteRecord): Promise<boolean> {
  const existing = await db.favorites.get(record.albumId)
  if (existing) {
    await db.favorites.delete(record.albumId)
    return false
  } else {
    await db.favorites.put(record)
    return true
  }
}

export async function getFavorites(): Promise<FavoriteRecord[]> {
  return db.favorites.orderBy('addedAt').reverse().toArray()
}

// --- Likes helpers ---

export async function isLiked(albumId: string): Promise<boolean> {
  const record = await db.likes.get(albumId)
  return record !== undefined
}

export async function toggleLike(record: LikeRecord): Promise<boolean> {
  const existing = await db.likes.get(record.albumId)
  if (existing) {
    await db.likes.delete(record.albumId)
    return false
  } else {
    await db.likes.put(record)
    return true
  }
}

export async function getLikes(): Promise<LikeRecord[]> {
  return db.likes.orderBy('createdAt').reverse().toArray()
}

// --- History helpers ---

export async function addHistory(record: Omit<HistoryRecord, 'id'>): Promise<void> {
  const existing = await db.history.where('albumId').equals(record.albumId).first()
  if (existing) {
    await db.history.update(existing.id!, { ...record, id: existing.id })
  } else {
    await db.history.put(record as HistoryRecord)
  }
}

export async function getHistory(): Promise<HistoryRecord[]> {
  return db.history.orderBy('visitedAt').reverse().toArray()
}

// --- Downloads helpers ---

export async function getDownloads(): Promise<DownloadRecord[]> {
  return db.downloads.orderBy('startedAt').reverse().toArray()
}

export async function getDownloadByAlbum(albumId: string): Promise<DownloadRecord[]> {
  return db.downloads.where('albumId').equals(albumId).toArray()
}

export async function upsertDownload(record: DownloadRecord): Promise<void> {
  await db.downloads.put(record)
}

export async function getAlbumDownloadProgress(albumId: string): Promise<number | null> {
  const records = await db.downloads.where('albumId').equals(albumId).toArray()
  if (records.length === 0) return null
  const total = records.reduce((sum, r) => sum + r.progress, 0)
  return Math.round(total / records.length)
}
