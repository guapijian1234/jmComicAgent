import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { getUserPreferences } from './library/summary'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './styles/globals.css'

// Surface the renderer-side library reader to the main process so the agent
// (which runs in main) can analyze favorites/likes/history for recommendations.
// Accessed via webContents.executeJavaScript('window.__getUserPreferences()').
;(window as unknown as { __getUserPreferences: () => Promise<unknown> }).__getUserPreferences = getUserPreferences

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
