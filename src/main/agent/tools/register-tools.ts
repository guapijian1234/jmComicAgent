import { toolRegistry } from '../ToolRegistry'
import { pythonBridge } from '../../PythonBridge'
import { getMainWindow } from '../../windowRef'

export function registerTools() {
  toolRegistry.register(
    {
      name: 'search_comic',
      description: '按关键词搜索漫画。返回匹配列表：id、标题、作者、分类、封面URL。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词' },
          page: { type: 'string', description: '页码，默认 1' },
        },
        required: ['keyword']
      }
    },
    async (params) => {
      const args = ['search', '-k', String(params.keyword)]
      if (params.page) args.push('--page', String(params.page))
      return pythonBridge.run(args)
    }
  )

  toolRegistry.register(
    {
      name: 'get_album_detail',
      description: '获取漫画详情：标题、作者、简介、标签、章节列表、封面。',
      parameters: {
        type: 'object',
        properties: {
          album_id: { type: 'string', description: '漫画 ID' }
        },
        required: ['album_id']
      }
    },
    async (params) => {
      const args = ['album', '-a', String(params.album_id)]
      return pythonBridge.run(args)
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
