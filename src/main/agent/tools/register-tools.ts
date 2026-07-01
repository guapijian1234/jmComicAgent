import { toolRegistry } from '../ToolRegistry'
import type { ToolContext } from '../ToolRegistry'
import { pythonBridge } from '../../PythonBridge'
import { getMainWindow } from '../../windowRef'

/** Clamp the agent-supplied limit to a sane range (default 6, 1–12).
 *  Hard cap is deliberately low: jmcomic returns 80/page, and dumping a full
 *  page of cards is exactly the "lists everything" behavior we want to avoid. */
function resolveLimit(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 6
  return Math.min(Math.max(Math.floor(n), 1), 12)
}

/**
 * Cap how many comic rows a search payload carries. jmcomic returns a
 * `content` array (alongside a `total`), but we coerce common wrapper keys
 * defensively so the cap holds regardless of shape. `total` is preserved so
 * the agent can tell the user more results exist and offer to page forward.
 */
function limitSearchData(data: unknown, limit: number): unknown {
  if (Array.isArray(data)) return data.slice(0, limit)
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const listKeys = ['content', 'results', 'data', 'list', 'comics', 'albums', 'search_result', 'photos']
    for (const key of listKeys) {
      if (Array.isArray(obj[key])) {
        return { ...obj, [key]: (obj[key] as unknown[]).slice(0, limit) }
      }
    }
  }
  return data
}

/** Pull the album id out of a search row, defensively (jmcomic rows are bare
 *  dicts with `id`; some wrappers nest under album/data). Returns '' if none. */
function rowAlbumId(row: unknown): string {
  if (!row || typeof row !== 'object') return ''
  const r = row as Record<string, unknown>
  const id = r['id'] ?? r['album_id'] ?? r['aid'] ?? r['comic_id']
  return id != null ? String(id) : ''
}

/**
 * Strip albums already shown this session from a search payload, then annotate
 * the payload with the surviving ids so the agent can avoid re-recommending
 * them on the next turn. Dedup is best-effort — if every result was already
 * shown, we still return the (now empty) list plus a hint so the agent knows
 * to retry with different keywords / order / category rather than re-listing.
 */
function dedupeShown(data: unknown, shown: Set<string>): unknown {
  if (!data || typeof data !== 'object') return data
  const obj = data as Record<string, unknown>
  const listKeys = ['content', 'results', 'data', 'list', 'comics', 'albums', 'search_result', 'photos']
  for (const key of listKeys) {
    if (!Array.isArray(obj[key])) continue
    const rows = obj[key] as unknown[]
    const fresh = rows.filter((r) => !shown.has(rowAlbumId(r)))
    const dropped = rows.length - fresh.length
    const hint = fresh.length === 0
      ? `本页结果全部已在本会话展示过——必须换关键词/排序/分类或翻页重新搜索，不要重复推荐`
      : dropped > 0
        ? `${dropped} 条已在本会话展示过，已剔除`
        : undefined
    return {
      ...obj,
      [key]: fresh,
      // Surface the dedup so the model understands why the list shrank and
      // knows these specific ids were already offered (don't show them again).
      _deduped: hint
    }
  }
  return data
}

/** Record every album id in a search/detail payload into the session's shown
 *  set so subsequent searches skip them. */
function rememberShown(data: unknown, shown: Set<string>) {
  const collect = (rows: unknown[]) => {
    for (const r of rows) {
      const id = rowAlbumId(r)
      if (id) shown.add(id)
    }
  }
  if (Array.isArray(data)) return collect(data)
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    // detail payloads carry the album id at top level
    const topId = rowAlbumId(obj)
    if (topId) shown.add(topId)
    for (const key of ['content', 'results', 'data', 'list', 'comics', 'albums', 'search_result', 'photos']) {
      if (Array.isArray(obj[key])) collect(obj[key] as unknown[])
    }
  }
}

export function registerTools() {
  toolRegistry.register(
    {
      name: 'search_comic',
      description:
        '按关键词搜索漫画，返回匹配列表（id/标题/作者/分类/封面）。这是找漫画的主工具，没搜到想要的时候不要放弃——换关键词、换 order_by（推荐用 tr 评分或 tf 喜欢数排序，比默认"最新"更可能命中好作品）、换 category 分类，或翻页(page)再试。' +
        'limit 控制条数：精准定位给 1-3；普通推荐给 3-6；用户明确要"多看看/广泛探索"才给 8-12，且不要重复推荐本会话已展示过的漫画（结果会自动剔除已展示的）。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词，建议用漫画名/角色/题材的核心词，避免整句话' },
          page: { type: 'string', description: '页码，默认 1。结果不够时翻页' },
          limit: {
            type: 'number',
            description: '返回条数，默认 6。精准定位 1-3，普通推荐 3-6，广泛探索 8-12。'
          },
          order_by: {
            type: 'string',
            description: '排序方式。推荐/找好作品优先用 tr(评分) 或 tf(喜欢数)；默认 mr(最新) 常常不准。可选: mr(最新) mv(观看) mp(图片数) tf(喜欢) tr(评分) md(评论)',
            enum: ['mr', 'mv', 'mp', 'tf', 'tr', 'md']
          },
          category: {
            type: 'string',
            description: '分类筛选，默认 0(全部)。可选: 0(全部) doujin(同人) single(单本) short(短篇) hanman(韩漫) meiman(美漫) another(其它) doujin_cosplay 3D',
            enum: ['0', 'doujin', 'single', 'short', 'hanman', 'meiman', 'another', 'doujin_cosplay', '3D']
          },
          time: {
            type: 'string',
            description: '时间范围，默认 a(全部)。可选: a(全部) t(今天) w(本周) m(本月)',
            enum: ['a', 't', 'w', 'm']
          }
        },
        required: ['keyword']
      }
    },
    async (params, ctx) => {
      const args = ['search', '-k', String(params.keyword)]
      if (params.page) args.push('--page', String(params.page))
      if (params.order_by) args.push('--order-by', String(params.order_by))
      if (params.category) args.push('--category', String(params.category))
      if (params.time) args.push('--time', String(params.time))
      const result = await pythonBridge.run(args)
      if (result.success) {
        // Dedupe against already-shown albums first, THEN cap — so the cap
        // counts fresh results, not re-shown ones.
        if (ctx?.shownAlbums) {
          result.data = dedupeShown(result.data, ctx.shownAlbums)
          rememberShown(result.data, ctx.shownAlbums)
        }
        result.data = limitSearchData(result.data, resolveLimit(params.limit))
      }
      return result
    }
  )

  toolRegistry.register(
    {
      name: 'get_album_detail',
      description: '获取某部漫画的详情：标题、作者、简介、标签、章节列表、封面。用户点名某部、或要看章节列表时调用。',
      parameters: {
        type: 'object',
        properties: {
          album_id: { type: 'string', description: '漫画 ID' }
        },
        required: ['album_id']
      }
    },
    async (params, ctx) => {
      const args = ['album', '-a', String(params.album_id)]
      const result = await pythonBridge.run(args)
      if (result.success && ctx?.shownAlbums) rememberShown(result.data, ctx.shownAlbums)
      return result
    }
  )

  toolRegistry.register(
    {
      name: 'get_chapter_pages',
      description: '获取指定章节的页面图片列表。',
      parameters: {
        type: 'object',
        properties: {
          album_id: { type: 'string', description: '漫画 ID' },
          chapter_id: { type: 'string', description: '章节 ID' }
        },
        required: ['album_id', 'chapter_id']
      }
    },
    async (params) => {
      const args = ['chapter', '-a', String(params.album_id), '-c', String(params.chapter_id)]
      return pythonBridge.run(args)
    }
  )

  // Reads the user's library (favorites / likes / history, stored in the
  // renderer's IndexedDB) and returns an aggregated preference profile
  // (top categories / tags / authors + the raw lists). The renderer computes
  // it; we fetch the result via executeJavaScript since the data lives there.
  toolRegistry.register(
    {
      name: 'get_user_preferences',
      description:
        '读取当前用户的收藏、喜欢和浏览历史，并聚合出偏好画像（高频分类/标签/作者，以及收藏与喜欢的完整列表）。用于个性化推荐：当用户说"推荐""猜我喜欢""根据我的口味/喜好推荐"或想找类似已收藏的漫画时调用，再结合返回的高频标签/分类作为关键词调用 search_comic。无需参数。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    async () => {
      const win = getMainWindow()
      if (!win || win.isDestroyed()) {
        return { success: false, error: 'window not ready' }
      }
      try {
        const data = await win.webContents.executeJavaScript(
          'window.__getUserPreferences ? window.__getUserPreferences() : null',
          true
        )
        if (!data) return { success: false, error: 'library reader unavailable' }
        return { success: true, data }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
