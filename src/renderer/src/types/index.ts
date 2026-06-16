export interface ComicSearchResult {
  id: string
  title: string
  author: string
  category?: string
  cover_url?: string
  coverLocalUrl?: string
  description?: string
  tags?: string[]
  chapter_count?: number
}

export interface AlbumDetail {
  id: string
  title: string
  author: string
  description?: string
  cover_url?: string
  tags?: string[]
  chapters: ChapterInfo[]
}

export interface ChapterInfo {
  id: string
  title: string
  index: number
  page_count?: number
}

export interface PageInfo {
  url: string
  localUrl?: string
  index: number
}

/** Single-page (flip one at a time) vs strip (all images stitched, scroll). */
export type ReaderMode = 'single' | 'strip'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  cards?: ComicSearchResult[]
  toolCall?: { name: string; status: 'running' | 'done' | 'error'; result?: string }
  timestamp: number
}

export interface ReaderState {
  isOpen: boolean
  albumId?: string
  albumTitle?: string
  author?: string
  coverUrl?: string
  chapterId?: string
  chapterTitle?: string
  pages: PageInfo[]
  chapters: ChapterInfo[]
  currentPage: number
  loading: boolean
  showChapterList: boolean
}
