export function DownloadProgress({ percent, size = 28 }: { percent: number; size?: number }) {
  const strokeWidth = 2.5
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="flex-shrink-0 relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s var(--ease)' }}
        />
      </svg>
      <span
        className="absolute text-[8px] font-semibold"
        style={{ color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}
      >
        {percent}
      </span>
    </div>
  )
}
