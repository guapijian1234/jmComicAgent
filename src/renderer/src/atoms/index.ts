import { atom } from 'jotai'
import type { ChatMessage, ReaderState, ComicSearchResult, PageInfo, ChapterInfo, ReaderMode } from '../types'
import { addHistory } from '../api/libraryApi'

export const messagesAtom = atom<ChatMessage[]>([])
export const inputAtom = atom('')
export const streamingAtom = atom(false)
export const agentThinkingAtom = atom(false)

export const readerAtom = atom<ReaderState>({
  isOpen: false,
  pages: [],
  chapters: [],
  currentPage: 0,
  loading: false,
  showChapterList: false
})

export const currentCardAtom = atom<ComicSearchResult | null>(null)

// Reading mode lives outside readerAtom so it survives open/close cycles.
// Persisted to the config store by the reader shell (default 'strip').
export const readerModeAtom = atom<ReaderMode>('strip')
export const setReaderModeAtom = atom(null, (_get, set, mode: ReaderMode) => {
  set(readerModeAtom, mode)
})

export const addMessageAtom = atom(null, (get, set, msg: ChatMessage) => {
  set(messagesAtom, [...get(messagesAtom), msg])
})

export const appendToLastAssistantAtom = atom(null, (get, set, text: string) => {
  const msgs = get(messagesAtom)
  if (msgs.length === 0) return
  const last = msgs[msgs.length - 1]
  if (last.role === 'assistant') {
    set(messagesAtom, [
      ...msgs.slice(0, -1),
      { ...last, content: last.content + text }
    ])
  }
})

export const attachCardsToLastAssistantAtom = atom(null, (get, set, cards: ComicSearchResult[]) => {
  const msgs = get(messagesAtom)
  // find the last assistant message
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') {
      const existing = msgs[i].cards ?? []
      // dedupe by id within this message — e.g. an album-detail card that
      // duplicates a card already shown by the preceding search.
      const seen = new Set(existing.map((c) => c.id))
      const merged = [...existing, ...cards.filter((c) => !seen.has(c.id))]
      set(messagesAtom, [
        ...msgs.slice(0, i),
        { ...msgs[i], cards: merged },
        ...msgs.slice(i + 1)
      ])
      return
    }
  }
})

export const openReaderAtom = atom(
  null,
  (_get, set, { albumId, albumTitle, chapterId, chapterTitle, pages, coverUrl, author }: {
    albumId: string
    albumTitle: string
    chapterId?: string
    chapterTitle?: string
    pages?: PageInfo[]
    coverUrl?: string
    author?: string
  }) => {
    set(readerAtom, {
      isOpen: true,
      albumId,
      albumTitle,
      author,
      coverUrl,
      chapterId: chapterId ?? '',
      chapterTitle: chapterTitle ?? '',
      pages: pages ?? [],
      chapters: [],
      currentPage: 0,
      loading: false,
      showChapterList: false
    })
    // Record to history (fire-and-forget)
    addHistory({
      albumId,
      title: albumTitle,
      author: author ?? '',
      coverUrl,
      chapterId: chapterId ?? '',
      chapterTitle: chapterTitle ?? '',
      visitedAt: Date.now()
    })
  }
)

export const closeReaderAtom = atom(null, (_get, set) => {
  set(readerAtom, {
    isOpen: false,
    pages: [],
    chapters: [],
    currentPage: 0,
    loading: false,
    showChapterList: false
  })
})

export const setReaderLoadingAtom = atom(null, (_get, set, loading: boolean) => {
  set(readerAtom, (prev) => ({ ...prev, loading }))
})

export const setReaderPagesAtom = atom(null, (_get, set, { chapterId, chapterTitle, pages }: {
  chapterId: string
  chapterTitle: string
  pages: PageInfo[]
}) => {
  set(readerAtom, (prev) => ({
    ...prev,
    chapterId,
    chapterTitle,
    pages,
    currentPage: 0,
    loading: false,
    showChapterList: false
  }))
})

export const setReaderChaptersAtom = atom(null, (_get, set, chapters: ChapterInfo[]) => {
  // The chapter picker is now a click-triggered dropdown (showChapterList =
  // "dropdown open"), so it never auto-opens. Multi-chapter albums auto-load
  // their first chapter and let the user switch via the dropdown.
  set(readerAtom, (prev) => ({ ...prev, chapters, showChapterList: false }))
})

export const setChapterListOpenAtom = atom(null, (_get, set, open: boolean) => {
  set(readerAtom, (prev) => ({ ...prev, showChapterList: open }))
})
