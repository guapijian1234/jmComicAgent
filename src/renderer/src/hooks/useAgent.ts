import { useCallback, useRef } from 'react'
import { useSetAtom } from 'jotai'
import {
  streamingAtom,
  agentThinkingAtom,
  appendToLastAssistantAtom,
  addMessageAtom,
  attachCardsToLastAssistantAtom
} from '../atoms'
import type { ChatMessage } from '../types'
import { normalizeSearchResults, normalizeAlbumDetail } from '../utils/normalize'

let msgId = 0
function nextId() { return `msg-${Date.now()}-${++msgId}` }

export function useAgent() {
  const addMessage = useSetAtom(addMessageAtom)
  const appendToLast = useSetAtom(appendToLastAssistantAtom)
  const attachCards = useSetAtom(attachCardsToLastAssistantAtom)
  const setStreaming = useSetAtom(streamingAtom)
  const setThinking = useSetAtom(agentThinkingAtom)
  const cleanupRef = useRef<(() => void) | null>(null)

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return

    setStreaming(true)
    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now()
    }
    addMessage(userMsg)

    setThinking(true)
    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }
    addMessage(assistantMsg)

    const cleanup = window.api.agent.onEvent((event) => {
      switch (event.type) {
        case 'text':
          appendToLast(event.content ?? '')
          setThinking(false)
          break

        case 'tool_start':
          // Tool execution bubbles are hidden — only the AgentThinking
          // indicator shows while a tool runs.
          break

        case 'tool_end': {
          if (!event.result?.success) break
          // Comic cards render whenever comic data comes back — a search
          // (list of cards) or an album detail (a single card). This lets the
          // AI surface cards at any time, not only after the first search.
          if (event.name === 'search_comic') {
            const cards = normalizeSearchResults(event.result.data)
            if (cards.length > 0) attachCards(cards)
          } else if (event.name === 'get_album_detail') {
            const cards = normalizeAlbumDetail(event.result.data)
            if (cards.length > 0) attachCards(cards)
          }
          break
        }

        case 'error':
          appendToLast(`\n\n出错了：${event.content}`)
          setThinking(false)
          break
      }
    })

    cleanupRef.current = cleanup

    try {
      await window.api.agent.send(text.trim())
    } catch (err) {
      appendToLast(`\n\n请求失败：${String(err)}`)
    } finally {
      setStreaming(false)
      setThinking(false)
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [addMessage, appendToLast, attachCards, setStreaming, setThinking])

  const cancel = useCallback(() => {
    window.api.agent.cancel()
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setStreaming(false)
  }, [setStreaming])

  return { send, cancel }
}
