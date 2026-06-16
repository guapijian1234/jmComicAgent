import { motion } from 'framer-motion'
import type { FavoriteRecord, LikeRecord, HistoryRecord, DownloadRecord } from '../db'
import type { SidebarTab as SidebarTabType } from '../atoms/sidebar'
import { useSetAtom } from 'jotai'
import { openReaderAtom } from '../atoms'
import { DownloadProgress } from './DownloadProgress'
import { LazyCover } from './LazyCover'

interface Props {
  tab: SidebarTabType
  favorites: FavoriteRecord[]
  likes: LikeRecord[]
  history: HistoryRecord[]
  downloads: DownloadRecord[]
}

export function SidebarTabView({ tab, favorites, likes, history, downloads }: Props) {
  if (tab === 'favorites') return <List items={favorites} tab={tab} emptyText="还没有收藏任何漫画" />
  if (tab === 'likes') return <List items={likes} tab={tab} emptyText="还没有喜欢任何漫画" />
  if (tab === 'history') return <List items={history} tab={tab} emptyText="还没有浏览记录" />
  if (tab === 'downloads') return <DownloadList downloads={downloads} />
  return null
}

function List({ items, tab, emptyText }: {
  items: Array<{ albumId: string; title: string; author: string; coverUrl?: string }>
  tab: SidebarTabType
  emptyText: string
}) {
  const openReader = useSetAtom(openReaderAtom)

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
      {items.map((item, i) => (
        <motion.div
          key={`${tab}-${item.albumId}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.02, 0.12), duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => openReader({ albumId: item.albumId, albumTitle: item.title, coverUrl: item.coverUrl, author: item.author, chapterId: '', chapterTitle: '', pages: [] })}
          className="flex items-center gap-3 p-2 cursor-pointer glass hover:bg-[var(--surface-hover)] transition-colors"
          style={{ borderRadius: 10 }}
        >
          {/* cover thumbnail — placeholder shows instantly, cover fades in when loaded */}
          <LazyCover src={item.coverUrl} alt={item.title} width={40} height={56} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{item.author}</p>
            <p
              className="text-[9.5px] truncate mt-0.5"
              style={{ color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', opacity: 0.7 }}
            >
              ID {item.albumId}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function DownloadList({ downloads }: { downloads: DownloadRecord[] }) {
  const openReader = useSetAtom(openReaderAtom)

  if (downloads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>还没有下载任务</p>
      </div>
    )
  }

  // Group by albumId for display
  const grouped = new Map<string, { record: DownloadRecord; records: DownloadRecord[] }>()
  for (const d of downloads) {
    const existing = grouped.get(d.albumId)
    if (existing) {
      existing.records.push(d)
    } else {
      grouped.set(d.albumId, { record: d, records: [d] })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
      {[...grouped.values()].map(({ record, records }, i) => {
        const totalChapters = records.length
        const doneChapters = records.filter((r) => r.status === 'done').length
        const isDownloading = records.some((r) => r.status === 'downloading')
        const overallProgress = Math.round(records.reduce((s, r) => s + r.progress, 0) / records.length)

        return (
          <motion.div
            key={`dl-${record.albumId}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.12), duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => openReader({ albumId: record.albumId, albumTitle: record.title, coverUrl: record.coverUrl, author: record.author, chapterId: '', chapterTitle: '', pages: [] })}
            className="flex items-center gap-3 p-2 cursor-pointer glass hover:bg-[var(--surface-hover)] transition-colors"
            style={{ borderRadius: 10 }}
          >
            <LazyCover src={record.coverUrl} alt={record.title} width={40} height={56} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{record.title}</p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {doneChapters}/{totalChapters} 章节 · {isDownloading ? `下载中 ${overallProgress}%` : doneChapters === totalChapters ? '已完成' : '已暂停'}
              </p>
            </div>
            {isDownloading && <DownloadProgress percent={overallProgress} size={28} />}
          </motion.div>
        )
      })}
    </div>
  )
}
