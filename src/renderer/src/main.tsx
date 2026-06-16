import './api/boot'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { getUserPreferences } from './library/summary'
import { db, getFavorites, getLikes, getHistory, toggleFavorite, toggleLike, addHistory } from './db'
import type { FavoriteRecord, LikeRecord, HistoryRecord } from './db'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './styles/globals.css'

// Expose library functions to the main process so the agent and LAN server can
// read/write the renderer-side IndexedDB (favorites, likes, history).
const w = window as unknown as Record<string, unknown>
w.__getUserPreferences = getUserPreferences
w.__getFavorites = getFavorites
w.__getLikes = getLikes
w.__getHistory = getHistory
w.__toggleFavorite = async (r: FavoriteRecord) => { await toggleFavorite(r); return db.favorites.toArray() }
w.__toggleLike = async (r: LikeRecord) => { await toggleLike(r); return db.likes.toArray() }
w.__addHistory = (r: HistoryRecord) => addHistory(r)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
