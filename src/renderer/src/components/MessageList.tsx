import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { messagesAtom, agentThinkingAtom } from '../atoms'
import { MessageBubble } from './MessageBubble'
import { AgentMark } from './AgentMark'

const SUGGESTIONS = [
  '推荐一部校园恋爱漫画',
  '找点热血少年番',
  '想看悬疑推理类的',
  '来一部搞笑日常'
]

export function MessageList({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const messages = useAtomValue(messagesAtom)
  const thinking = useAtomValue(agentThinkingAtom)

  // Only show the thinking avatar while the active assistant turn is still
  // empty. Once it has text or cards its own bubble carries the avatar —
  // rendering AgentThinking too would duplicate the icon.
  const last = messages[messages.length - 1]
  const trailingEmpty =
    last?.role === 'assistant' &&
    last.content.trim() === '' &&
    (!last.cards || last.cards.length === 0)
  const showThinking = thinking && trailingEmpty

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="px-8 py-7">
        {messages.length === 0 ? (
          <Welcome onSuggestion={onSuggestion} />
        ) : (
          <div className="space-y-7">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {showThinking && <AgentThinking />}
          </div>
        )}
      </div>
    </div>
  )
}

function Welcome({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center pt-[10vh] pb-10 px-6">
      {/* hero mark with soft glow halo */}
      <div className="relative" style={{ width: 64, height: 64 }}>
        <div
          className="absolute inset-0 rounded-[22px]"
          style={{ background: 'radial-gradient(circle, rgba(10,132,255,0.45), transparent 70%)', filter: 'blur(18px)' }}
        />
        <div className="relative">
          <AgentMark size={64} />
        </div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-7 text-[27px] font-semibold"
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.022em' }}
      >
        想看什么漫画？
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-2 text-[14px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        告诉我题材、风格或关键词，我来帮你找。
      </motion.p>

      <div className="mt-8 grid grid-cols-2 gap-2.5 w-full max-w-[440px]">
        {SUGGESTIONS.map((s, i) => (
          <SuggestionChip key={s} text={s} index={i} onClick={() => onSuggestion(s)} />
        ))}
      </div>
    </div>
  )
}

function SuggestionChip({ text, index, onClick }: { text: string; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 + index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-raised text-left px-4 py-3.5 flex items-center justify-between gap-2"
      style={{ borderRadius: 14 }}
    >
      <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{text}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </motion.button>
  )
}

function AgentThinking() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3"
    >
      <AgentMark size={28} />
      <div className="glass px-4 py-3 flex items-center" style={{ borderRadius: 14 }}>
        <div className="dot-pulse">
          <span /><span /><span />
        </div>
      </div>
    </motion.div>
  )
}
