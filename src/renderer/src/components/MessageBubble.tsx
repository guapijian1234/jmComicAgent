import { motion } from 'framer-motion'
import type { ChatMessage } from '../types'
import { ComicResultCard } from './ComicResultCard'
import { Markdown } from './Markdown'
import { AgentMark } from './AgentMark'

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'system') return null

  const isUser = message.role === 'user'
  const hasContent = message.content.trim().length > 0
  const hasCards = !!message.cards && message.cards.length > 0

  // While the agent is working but hasn't emitted text or cards yet, the
  // AgentThinking indicator owns the avatar. Skip the empty bubble so we
  // don't render a second icon next to it.
  if (!isUser && !hasContent && !hasCards) return null

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end w-full"
      >
        <div
          className="px-4 py-3 text-[14px] leading-relaxed max-w-[80%] min-w-0 break-words whitespace-pre-wrap"
          style={{
            borderRadius: 18,
            borderBottomRightRadius: 6,
            background: 'var(--accent-soft)',
            border: '1px solid rgba(10,132,255,0.22)',
            color: 'var(--text-primary)',
            overflowWrap: 'break-word',
            wordBreak: 'break-word'
          }}
        >
          {message.content}
        </div>
      </motion.div>
    )
  }

  // assistant
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3"
    >
      <div className="pt-0.5 flex-shrink-0">
        <AgentMark size={28} />
      </div>

      <div className="flex-1 min-w-0">
        {hasContent && (
          <div className="text-[14px] leading-[1.65] break-words" style={{ color: 'var(--text-primary)' }}>
            <Markdown>{message.content}</Markdown>
          </div>
        )}

        {hasCards && (
          <div className="flex flex-wrap gap-3 pt-1">
            {message.cards!.map((card, i) => (
              <ComicResultCard key={`${card.id}-${i}`} comic={card} index={i} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
