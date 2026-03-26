export function MomentumArrow({ momentum }: { momentum: 'up' | 'flat' | 'down' | null }) {
  if (!momentum) return null
  const config = {
    up: { icon: '↑', color: 'text-emerald-500', label: 'Trending up' },
    flat: { icon: '→', color: 'text-muted-foreground', label: 'Flat' },
    down: { icon: '↓', color: 'text-red-500', label: 'Trending down' },
  }
  const { icon, color, label } = config[momentum]
  return (
    <span className={`${color} font-bold text-sm`} title={label}>
      {icon}
    </span>
  )
}
