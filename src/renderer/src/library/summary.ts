import { db } from '../db'

export interface NameCount {
  name: string
  count: number
}

export interface UserPreferences {
  counts: { favorites: number; likes: number; history: number }
  /** Most-seen categories across favorites + likes. */
  topCategories: NameCount[]
  /** Most-seen tags across favorites + likes. */
  topTags: NameCount[]
  /** Most-seen authors across favorites + likes + history. */
  topAuthors: NameCount[]
  favorites: { title: string; author: string; category?: string; tags?: string[] }[]
  likes: { title: string; author: string; category?: string; tags?: string[] }[]
  recentHistory: { title: string; author: string; visitedAt: number }[]
}

/**
 * Read the user's library (favorites / likes / history) from IndexedDB and
 * aggregate it into a preference profile the agent can reason over. This runs
 * in the renderer (where Dexie lives) and is surfaced to the main-process
 * agent tool via window.__getUserPreferences.
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  const [favorites, likes, history] = await Promise.all([
    db.favorites.toArray(),
    db.likes.toArray(),
    db.history.orderBy('visitedAt').reverse().toArray()
  ])

  const cat = new Map<string, number>()
  const tag = new Map<string, number>()
  const author = new Map<string, number>()

  const bump = (m: Map<string, number>, k?: string) => {
    if (!k) return
    const key = k.trim()
    if (!key) return
    m.set(key, (m.get(key) ?? 0) + 1)
  }

  for (const f of favorites) {
    bump(cat, f.category)
    bump(author, f.author)
    ;(f.tags ?? []).forEach((t) => bump(tag, t))
  }
  for (const l of likes) {
    bump(cat, l.category)
    bump(author, l.author)
    ;(l.tags ?? []).forEach((t) => bump(tag, t))
  }
  for (const h of history) bump(author, h.author)

  const top = (m: Map<string, number>, n: number): NameCount[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }))

  return {
    counts: { favorites: favorites.length, likes: likes.length, history: history.length },
    topCategories: top(cat, 8),
    topTags: top(tag, 12),
    topAuthors: top(author, 8),
    favorites: favorites.map((f) => ({ title: f.title, author: f.author, category: f.category, tags: f.tags })),
    likes: likes.map((l) => ({ title: l.title, author: l.author, category: l.category, tags: l.tags })),
    recentHistory: history.slice(0, 15).map((h) => ({ title: h.title, author: h.author, visitedAt: h.visitedAt }))
  }
}
