import { atom } from 'jotai'

export const settingsOpenAtom = atom(false)
export const openSettingsAtom = atom(null, (_get, set) => set(settingsOpenAtom, true))
export const closeSettingsAtom = atom(null, (_get, set) => set(settingsOpenAtom, false))
