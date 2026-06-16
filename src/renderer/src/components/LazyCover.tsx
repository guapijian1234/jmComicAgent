import { useState } from 'react'

/**
 * A cover thumbnail that renders an instant placeholder (shimmer + glyph) and
 * fades the real image in only once it has actually loaded over the network.
 * Covers come from the JM CDN via the proxy and can be slow or unreachable,
 * so the placeholder keeps the card looking complete immediately — the text
 * (title / author / ID) is always shown by the parent regardless.
 */
export function LazyCover({
  src,
  alt,
  width,
  height,
  radius = 6
}: {
  src?: string
  alt?: string
  width: number
  height: number
  radius?: number
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showCover = !!src && !failed

  return (
    <div
      className="relative overflow-hidden flex-shrink-0"
      style={{ width, height, borderRadius: radius, background: 'var(--surface-1)' }}
    >
      {/* placeholder — visible until the cover finishes loading (and on error / no src) */}
      <div
        className="absolute inset-0 shimmer-bg flex items-center justify-center"
        style={{
          opacity: failed || !src || !loaded ? 1 : 0,
          transition: 'opacity 0.3s var(--ease)'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>

      {showCover && (
        <img
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s var(--ease)' }}
        />
      )}
    </div>
  )
}
