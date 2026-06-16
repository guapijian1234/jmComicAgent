import type { ComicSearchResult, ChapterInfo, PageInfo } from '../types'

/**
 * Defensively normalize jmcomic search output into UI cards.
 * The Python bridge returns JSON we don't fully control the shape of,
 * so we coerce common field aliases defensively.
 */
export function normalizeSearchResults(raw: unknown): ComicSearchResult[] {
  const rows = toArray(raw)
  return rows
    .map((r) => normalizeOne(r))
    .filter((c): c is ComicSearchResult => c !== null)
}

/**
 * Normalize a single album-detail payload into a card. Unlike search output
 * (always a list), album detail is one object — possibly bare or nested under
 * a wrapper key like `album`/`data`. Returns at most one card.
 */
export function normalizeAlbumDetail(raw: unknown): ComicSearchResult[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>

  let target: unknown = obj
  for (const key of ['album', 'data', 'detail', 'result', 'info']) {
    if (obj[key] && typeof obj[key] === 'object') {
      target = obj[key]
      break
    }
  }

  const card = normalizeOne(target)
  return card ? [card] : []
}

/**
 * Normalize album detail response into a chapter list.
 * jmcomic's get_album_detail returns an object whose `episode_list` is an
 * array of TUPLES `[photo_id, index, name]` (not dicts), serialized to JSON
 * arrays. Single-volume albums have exactly one episode whose photo_id equals
 * the album_id; multi-volume albums have one tuple per chapter.
 */
export function normalizeChapters(raw: unknown): ChapterInfo[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>

  // Drill into common wrappers
  let target: unknown = obj
  for (const key of ['album', 'data', 'detail', 'result', 'info']) {
    if (obj[key] && typeof obj[key] === 'object') {
      target = obj[key]
      break
    }
  }

  const t = target as Record<string, unknown>
  const arr = toArray(t['episode_list'] ?? t['chapters'] ?? t['eps'] ?? t['episodes'] ?? t['ep_list'] ?? [])

  const result: ChapterInfo[] = []
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    let id: string | undefined
    let title: string | undefined

    if (Array.isArray(item)) {
      // jmcomic episode tuple: [photo_id, index, name]
      id = item[0] != null ? String(item[0]) : undefined
      const name = typeof item[2] === 'string' ? item[2].trim() : ''
      title = name || (item[1] != null ? `第${item[1]}话` : `第${i + 1}话`)
    } else if (item && typeof item === 'object') {
      const c = item as Record<string, unknown>
      id = pickStr(c, ['chapter_id', 'id', 'cid', 'photo_id'])
      title = pickStr(c, ['chapter_title', 'title', 'name']) || `第${i + 1}话`
    }

    if (!id) continue
    result.push({ id, title: title || `第${i + 1}话`, index: i })
  }
  return result
}

/**
 * Normalize the chapter-download response into PageInfo[].
 * The Python bridge downloads + DECODES the chapter and returns an
 * `image_paths` array of absolute local file paths. Each path is wrapped in a
 * comic-img:// URL that the main process streams back as the decoded image
 * (raw JM CDN urls can't be used because the images are scrambled).
 */
export function normalizeChapterPages(raw: unknown): PageInfo[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const paths: unknown[] = Array.isArray(obj['image_paths'])
    ? obj['image_paths']
    : Array.isArray(raw)
      ? raw
      : []

  const result: PageInfo[] = []
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i]
    if (typeof p !== 'string' || p.length === 0) continue
    result.push({ url: localPathToComicUrl(p), index: i })
  }
  return result
}

/** Wrap a local decoded-image path in the comic-img:// protocol URL. */
export function localPathToComicUrl(absPath: string): string {
  return `comic-img://cache/${encodeURIComponent(absPath)}`
}

function toArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    // common wrapper shapes
    for (const key of ['results', 'data', 'list', 'comics', 'albums', 'content', 'search_result', 'photos', 'images']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

function normalizeOne(row: unknown): ComicSearchResult | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>

  const id = pickStr(r, ['id', 'album_id', 'aid', 'comic_id', 'book_id'])
  const title = pickStr(r, ['name', 'title', 'comic_name', 'album_name'])
  if (!id || !title) return null

  const categoryRaw = r['category']
  const category =
    (typeof categoryRaw === 'string' ? categoryRaw : undefined) ||
    (categoryRaw && typeof categoryRaw === 'object'
      ? pickStr(categoryRaw as Record<string, unknown>, ['title', 'name'])
      : undefined) ||
    pickStr(r, ['cat', 'category_name', 'genre'])

  return {
    id,
    title,
    author: pickStr(r, ['author', 'artist', 'writer']) || '未知作者',
    category,
    cover_url: pickStr(r, ['cover_url', 'cover', 'image', 'thumbnail', 'scrambled_image_url', 'pic']) || undefined,
    description: pickStr(r, ['description', 'desc', 'intro', 'synopsis']) || undefined,
    tags: toArray(r['tags'] ?? r['tag_list'] ?? r['categories'])
      .map((t) => (typeof t === 'string' ? t : (t as Record<string, string>)?.name))
      .filter((t): t is string => !!t)
      .slice(0, 6)
  }
}

function pickStr(r: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v)
    }
  }
  return undefined
}
