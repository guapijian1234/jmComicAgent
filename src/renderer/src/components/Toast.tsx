import { useAtomValue, useSetAtom } from 'jotai'
import { toastsAtom, dismissToastAtom } from '../atoms/toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

export function ToastContainer() {
  const toasts = useAtomValue(toastsAtom)

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItemView key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItemView({ toast }: { toast: { id: string; message: string; type: 'success' | 'error' } }) {
  const dismiss = useSetAtom(dismissToastAtom)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  const isSuccess = toast.type === 'success'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => dismiss(toast.id)}
      className="pointer-events-auto cursor-pointer glass-raised px-4 py-2.5 flex items-center gap-2"
      style={{ borderRadius: 12, fontSize: 13 }}
    >
      <span style={{ color: isSuccess ? 'var(--success)' : 'var(--danger)' }}>
        {isSuccess ? '✓' : '✗'}
      </span>
      <span style={{ color: 'var(--text-primary)' }}>{toast.message}</span>
    </motion.div>
  )
}
