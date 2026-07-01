import { deepseekClient } from './DeepSeekClient'
import type { Message, ToolCall } from './DeepSeekClient'
import { toolRegistry } from './ToolRegistry'
import { conversationMemory } from './ConversationMemory'

export { toolRegistry } from './ToolRegistry'
export { conversationMemory } from './ConversationMemory'
export { deepseekClient } from './DeepSeekClient'
export type { Message, ToolCall, StreamChunk } from './DeepSeekClient'

const SYSTEM_PROMPT = `你是 Comic Agent，漫画搜索与推荐助手。用户用自然语言描述想看的漫画，你调用工具找到并展示。务必听清用户的指令再行动：用户指定了题材/分类/排序/数量就用那个，不要自作主张换掉。

【卡片渲染】
- search_comic 与 get_album_detail 的返回会自动渲染成漫画卡片（封面/标题/作者/分类/ID），你不用在文字里复述这些字段，给一句简短推荐语即可。
- 卡片只在工具返回后才会显示，所以想推荐就调工具，不要只在文字里描述却不调。

【搜索质量——这是最关键的职责】
- jmcomic 默认按"最新"(mr)排序，常常搜不到好作品。推荐/找好作品时，order_by 优先用 tr(评分) 或 tf(喜欢数)。
- 一次搜索结果不理想是常态，不要只搜一次就放弃。没命中或质量差时：① 换更核心的关键词（去掉整句话，用漫画名/角色/题材词）；② 换 order_by；③ 按题材用 category 筛选（同人 doujin / 单本 single / 短篇 short / 韩漫 hanman 等）；④ 翻页(page)。至少尝试 1-2 次调整后再回答用户。
- 关键词建议精炼：把"我想看那种兄妹之间的恋爱故事"提炼成"兄妹"或"兄妹 恋爱"再搜，而不是直接塞整句。

【不要重复——重要】
- 系统会自动剔除本会话已经展示过的漫画（返回里若出现 _deduped 字段说明已剔重）。如果剔除后列表为空或太短，必须换关键词/排序/分类重新搜，绝不能把已展示过的再推一遍。
- 不要反复发同一段话或同一批卡片。每个回合都要有新内容或新动作。

【数量控制】
- limit 按意图给：精准定位 1-3，普通推荐 3-6，只有用户明确要"多看看/广泛探索"才 8-12。宁可少不要多，绝不整页倒。

【个性化推荐】
- 用户说"推荐/猜我喜欢/根据口味/有没有类似的"时，先调 get_user_preferences 读收藏/喜欢/历史画像，再用其中的高频分类、标签、作者作关键词去 search_comic，并简述"为什么推荐"（关联到用户喜欢过的某部或标签）。库为空时跳过，直接按关键词推荐。

【其它】
- 用中文，语气亲切自然。不编造，只用工具真实返回的数据。没找到就如实说，并建议换词。
- 用户要看章节时：get_album_detail 取章节列表 → get_chapter_pages 取图片。`

export class AgentRuntime {
  private abortController: AbortController | null = null
  /** Per-session set of album ids already shown to the user. Fed into
   *  search_comic so it can strip repeats — the agent re-recommending the
   *  same few titles across turns was the #1 "一直重复发" complaint. */
  private shownAlbums = new Map<string, Set<string>>()

  private shownSet(sessionId: string): Set<string> {
    let s = this.shownAlbums.get(sessionId)
    if (!s) {
      s = new Set()
      this.shownAlbums.set(sessionId, s)
    }
    return s
  }

  async *run(userMessage: string, sessionId = 'default'): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    conversationMemory.add({ role: 'user', content: userMessage }, sessionId)
    const shown = this.shownSet(sessionId)
    const toolCtx = { sessionId, shownAlbums: shown }

    const tools = toolRegistry.getDefinitions()
    let turn = 0
    const MAX_TURNS = 10

    while (turn < MAX_TURNS) {
      turn++
      signal.throwIfAborted()

      const messages: Message[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationMemory.getAll(sessionId)
      ]

      let fullText = ''
      let toolCallsReceived: ToolCall[] | null = null

      try {
        for await (const chunk of deepseekClient.chat(messages, tools, signal)) {
          signal.throwIfAborted()

          if (chunk.type === 'text') {
            fullText += chunk.content
            yield { type: 'text', content: chunk.content }
          }

          if (chunk.type === 'tool_calls') {
            toolCallsReceived = chunk.calls
            break
          }

          if (chunk.type === 'done') {
            break
          }
        }

        if (toolCallsReceived && toolCallsReceived.length > 0) {
          conversationMemory.add({ role: 'assistant', content: fullText || '(calling tools)', tool_calls: toolCallsReceived }, sessionId)

          for (const tc of toolCallsReceived) {
            const fn = tc.function
            let params: Record<string, unknown> = {}
            try { params = JSON.parse(fn.arguments) } catch { /* ignore */ }

            yield { type: 'tool_start', name: fn.name, params }

            const result = await toolRegistry.execute(fn.name, params, toolCtx)

            yield { type: 'tool_end', name: fn.name, result }

            conversationMemory.add({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: tc.id,
              name: fn.name
            }, sessionId)
          }
          continue // next turn to let LLM process tool results
        }

        conversationMemory.add({ role: 'assistant', content: fullText }, sessionId)
        break
      } catch (err: unknown) {
        // User cancelled (client disconnect). Check the signal directly — the
        // OpenAI SDK throws APIUserAbortError, but its instances inherit .name
        // from Error.prototype ('Error'), so name-based checks are unreliable.
        if (signal.aborted) break
        if (err instanceof Error) {
          const ctorName = err.constructor.name
          if (ctorName === 'AbortError' || ctorName === 'APIUserAbortError') break
        }
        const msg = err instanceof Error ? err.message : String(err)
        // eslint-disable-next-line no-console
        console.error('[AgentRuntime] turn failed:', err)
        yield { type: 'error', content: msg }
        break
      }
    }
  }

  cancel() {
    this.abortController?.abort()
  }
}

export interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error'
  content?: string
  name?: string
  params?: Record<string, unknown>
  result?: { success: boolean; data?: unknown; error?: string }
}

export const agentRuntime = new AgentRuntime()
