import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useAgent } from '../hooks/useAgent'

export function ChatView() {
  const { send, cancel } = useAgent()
  return (
    <div className="flex flex-col h-full min-h-0">
      <MessageList onSuggestion={send} />
      <ChatInput send={send} cancel={cancel} />
    </div>
  )
}
