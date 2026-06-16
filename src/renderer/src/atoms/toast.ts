import { atom } from 'jotai'

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error'
}

export const toastsAtom = atom<ToastItem[]>([])

let toastSeq = 0

export const showToastAtom = atom(null, (_get, set, payload: Omit<ToastItem, 'id'>) => {
  const id = `toast-${Date.now()}-${++toastSeq}`
  set(toastsAtom, (prev) => [...prev, { ...payload, id }])
})

export const dismissToastAtom = atom(null, (_get, set, id: string) => {
  set(toastsAtom, (prev) => prev.filter((t) => t.id !== id))
})
