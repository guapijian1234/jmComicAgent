import type { Message } from './DeepSeekClient'
import { deepseekClient } from './DeepSeekClient'
import type { StreamChunk } from './DeepSeekClient'

const MAX_TURNS = 20
const MAX_CONTEXT_MESSAGES = 40

export class ConversationMemory {
  private sessions = new Map<string, Message[]>()

  constructor() {
    this.sessions.set('default', [])
  }

  getAll(sessionId = 'default'): Message[] {
    return this.sessions.get(sessionId) ?? []
  }

  add(msg: Message, sessionId = 'default') {
    let session = this.sessions.get(sessionId)
    if (!session) {
      session = []
      this.sessions.set(sessionId, session)
    }
    session.push(msg)
    this.trim(sessionId)
  }

  /**
   * Cap the stored history. A naive front-splice can split a tool-call group —
   * an `assistant` message carrying `tool_calls` and the `tool` messages that
   * answer it — which makes the API reject the next request with:
   * "An assistant message with 'tool_calls' must be followed by tool messages
   * responding to each 'tool_call_id'". So we drop leading messages but keep
   * every tool-call group atomic: when we discard an assistant that issued
   * tool_calls, we discard its tool results in the same pass. This guarantees
   * the surviving window never starts mid-group and never orphans a caller.
   */
  trim(sessionId = 'default') {
    const session = this.sessions.get(sessionId)
    if (!session || session.length <= MAX_CONTEXT_MESSAGES) return

    while (session.length > MAX_CONTEXT_MESSAGES) {
      const removed = session.shift()
      if (!removed) break
      // Keep tool-call groups intact: an assistant tool_calls message must
      // always be immediately followed by its tool results, so drop them
      // together rather than letting a later splice split the pair.
      if (removed.role === 'assistant' && removed.tool_calls?.length) {
        while (session.length > 0 && session[0].role === 'tool') {
          session.shift()
        }
      }
    }
  }

  clear(sessionId = 'default') {
    this.sessions.set(sessionId, [])
  }
}

export const conversationMemory = new ConversationMemory()
