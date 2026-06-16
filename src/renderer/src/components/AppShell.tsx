import type { PropsWithChildren } from 'react'
import { TitleBar } from './TitleBar'

/**
 * The app fills the entire window edge-to-edge — one continuous glass surface.
 * The window's own rounded corners (native on Win11 acrylic / macOS vibrancy)
 * define the shape. No inner floating panel, so there's no "box within a box".
 * Content stays off the edges via internal padding (px/py utilities).
 */
export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-surface relative flex flex-col h-full w-full overflow-hidden">
      <TitleBar />
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}
