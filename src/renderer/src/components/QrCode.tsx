import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * Renders a QR code for the given text as an inline SVG. Sized in CSS px via
 * the `size` prop. Used on the desktop LAN panel so phones can scan-to-connect
 * instead of typing the IP:port.
 */
export function QrCode({ text, size = 160 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0b0d', light: '#ffffff' }
    })
      .then((s) => { if (!cancelled) setSvg(s) })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [text])

  if (!svg) {
    return <div style={{ width: size, height: size, background: 'var(--surface-1)', borderRadius: 10 }} />
  }
  return (
    <div
      style={{ width: size, height: size, background: '#fff', borderRadius: 10, padding: 8, boxSizing: 'border-box' }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
