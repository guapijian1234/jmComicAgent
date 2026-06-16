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

  trim(sessionId = 'default') {
    const session = this.sessions.get(sessionId)
    if (!session || session.length <= MAX_CONTEXT_MESSAGES) return
    const excess = session.length - MAX_CONTEXT_MESSAGES
    session.splice(0, excess)
  }

  clear(sessionId = 'default') {
    this.sessions.set(sessionId, [])
  }
}

export const conversationMemory = new ConversationMemory()
