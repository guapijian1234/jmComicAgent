export function AgentMark({ size = 30 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        boxShadow: '0 6px 18px rgba(10,132,255,0.32), 0 1px 0 rgba(255,255,255,0.25) inset'
      }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l2.2 5.2L19.5 9l-4 4 1 5.5L12 16l-4.5 2.5 1-5.5-4-4 5.3-.8z" />
      </svg>
    </div>
  )
}
