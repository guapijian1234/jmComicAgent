import { createHttpApi, getServerUrl } from './httpClient'

// In browser/APK (no Electron preload), supply HTTP-based API.
// In Electron, window.api already exists from the preload script.
if (!(window as any).api) {
  const api = createHttpApi()
  ;(window as any).api = api
  ;(window as any).__jmServerUrl = getServerUrl()
}
