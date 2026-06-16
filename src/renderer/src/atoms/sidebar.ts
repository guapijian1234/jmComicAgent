import { atom } from 'jotai'

export type SidebarTab = 'favorites' | 'likes' | 'history' | 'downloads'

export const sidebarOpenAtom = atom(false)
export const sidebarActiveTabAtom = atom<SidebarTab>('favorites')

export const toggleSidebarAtom = atom(null, (_get, set) => {
  set(sidebarOpenAtom, (prev) => !prev)
})

export const openSidebarAtom = atom(null, (_get, set) => {
  set(sidebarOpenAtom, true)
})

export const closeSidebarAtom = atom(null, (_get, set) => {
  set(sidebarOpenAtom, false)
})
