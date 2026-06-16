import OpenAI from 'openai'
import { configStore } from '../ConfigStore'
import type { ToolDefinition } from './ToolRegistry'

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: ToolCall[]
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'done' }

export class DeepSeekClient {
  private client: OpenAI | null = null
  private lastKey = ''
  private lastBase = ''

  /**
   * Rebuild the underlying OpenAI client whenever the apiKey or baseURL in the
   * config store changes. This lets the Settings panel take effect on the next
   * message without restarting the app. Construction is cheap (just stores
   * config), so we re-check on every chat().
   */
  private ensureClient() {
    const apiKey = configStore.get<string>('deepseekApiKey') ?? ''
    const baseURL = configStore.get<string>('baseUrl') ?? 'https://api.deepseek.com'
    if (!this.client || apiKey !== this.lastKey || baseURL !== this.lastBase) {
      this.client = new OpenAI({ baseURL, apiKey })
      this.lastKey = apiKey
      this.lastBase = baseURL
    }
    return this.client
  }

  async *chat(
    messages: Message[],
    tools: ToolDefinition[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    const toolDefs = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))

    const stream = await this.ensureClient().chat.completions.create(
      {
        model: configStore.get<string>('deepseekModel') ?? 'deepseek-v4-flash',
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        tool_choice: toolDefs.length > 0 ? 'auto' : undefined,
        stream: true
      },
      { signal }
    )

    const pendingToolCalls: Map<number, ToolCall> = new Map()

    for await (const chunk of stream) {
      if (signal?.aborted) break

      const delta = chunk.choices[0]?.delta

      if (delta?.content) {
        yield { type: 'text', content: delta.content }
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (!pendingToolCalls.has(idx)) {
            pendingToolCalls.set(idx, {
              id: tc.id ?? '',
              type: 'function',
              function: { name: tc.function?.name ?? '', arguments: '' }
            })
          }
          const existing = pendingToolCalls.get(idx)!
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.function.name = tc.function.name
          if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        const calls = [...pendingToolCalls.values()]
        yield { type: 'tool_calls', calls }
        return
      }
    }

    yield { type: 'done' }
  }
}

export const deepseekClient = new DeepSeekClient()
