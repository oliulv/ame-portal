export function RankChangeArrow({ rankChange }: { rankChange: number | null }) {
  if (!rankChange) return null
  const config =
    rankChange > 0
      ? { icon: '↑', color: 'text-emerald-500', label: `Up ${rankChange}` }
      : { icon: '↓', color: 'text-red-500', label: `Down ${Math.abs(rankChange)}` }
  return (
    <span className={`${config.color} font-bold text-sm`} title={config.label}>
      {config.icon}
    </span>
  )
}
