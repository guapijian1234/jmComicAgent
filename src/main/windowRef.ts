import type { BrowserWindow } from 'electron'

// Lets agent tools (which run in the main process) reach the renderer window
// to query renderer-side state (e.g. the IndexedDB library) without threading
// the window reference through every registration call.
let main: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null) {
  main = win
}

export function getMainWindow(): BrowserWindow | null {
  return main
}
