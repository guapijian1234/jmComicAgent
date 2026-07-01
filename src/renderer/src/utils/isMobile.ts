/**
 * Mobile detection — true when running in the Capacitor/Android WebView (the
 * HTTP transport) rather than Electron. The app is built for desktop and only
 * runs over HTTP when packaged as the phone APK, so `_transport === 'http'` is
 * a reliable "this is the phone client" signal.
 */
export function isMobile(): boolean {
  return ((window as any).api?._transport) === 'http'
}
