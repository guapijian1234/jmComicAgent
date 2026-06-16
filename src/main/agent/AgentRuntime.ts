import { deepseekClient } from './DeepSeekClient'
import type { Message, ToolCall } from './DeepSeekClient'
import { toolRegistry } from './ToolRegistry'
import { conversationMemory } from './ConversationMemory'

export { toolRegistry } from './ToolRegistry'
export { conversationMemory } from './ConversationMemory'
export { deepseekClient } from './DeepSeekClient'
export type { Message, ToolCall, StreamChunk } from './DeepSeekClient'

const SYSTEM_PROMPT = `你是 Comic Agent，一个专业的漫画搜索与推荐助手。用户用自然语言描述想看的漫画，你负责调用工具找到并展示它。

关于漫画卡片（重要）：
- search_comic 的结果会自动渲染成漫画卡片（封面/标题/作者/分类/ID），你不用在文字里重复这些字段，给一句简短推荐语即可。
- get_album_detail 的结果也会渲染成该漫画的卡片。
- 你可以随时让漫画卡片出现，不必只在第一次搜索时：用户想看推荐、想换方向、想"再看看 / 列出来 / 有没有类似的"、或想聚焦某一部时，直接调用对应工具把卡片刷出来——列表用 search_comic，单部用 get_album_detail。
- 不要只在文字里描述漫画却不调工具：卡片只有在工具返回后才会显示。

行为准则：
- 用中文回复，语气亲切自然，像朋友推荐漫画一样。
- 先简短确认需求，然后调用 search_comic 搜索。
- 搜索条数：search_comic 默认只返回 5 条，你用 limit 参数决定该拉多少——锁定/精准定位某一部给 1-3 条；普通推荐或候选列表给 5 条；广泛探索/想多看看/找类似的给 8-12 条。不要默认拉全部，结果太多反而让你和用户都难聚焦。返回里会带 total，如果还有更多，可以主动问用户要不要翻页。
- 结果不够精确时，根据反馈调整关键词继续搜索。
- 用户想看具体章节时，调用 get_album_detail 获取章节列表，再调用 get_chapter_pages。
- 不要编造信息，只使用工具返回的真实数据。
- 没找到匹配时诚实告知，并建议换个关键词。

个性化推荐（重要）：
- 当用户说"推荐""猜我喜欢""根据我的口味/喜好推荐""有没有类似的"或想找与已收藏漫画相似的作品时，先调用 get_user_preferences 读取用户的收藏/喜欢/历史画像。
- 拿到偏好后，用其中的高频分类、标签、作者作为关键词去 search_comic，给出贴合用户口味的推荐，并简要说明"为什么推荐"（关联到用户喜欢过的某部或某个高频标签）。
- 如果用户库为空（没收藏/喜欢/历史），不要强行调用，直接按关键词正常推荐即可。`

export class AgentRuntime {
  private abortController: AbortController | null = null

  async *run(userMessage: string, sessionId = 'default'): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    conversationMemory.add({ role: 'user', content: userMessage }, sessionId)

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

            const result = await toolRegistry.execute(fn.name, params)

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
        if (err instanceof Error && err.name === 'AbortError') break
        const msg = err instanceof Error ? err.message : String(err)
        // Surface the full error (incl. the SDK's structured response body)
        // to the main-process console so transient API/tool failures are
        // diagnosable instead of opaque.
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
