'use client'

import { useState, useEffect } from 'react'

export function BatchCountdown({ scheduledTime }: { scheduledTime: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  const remaining = Math.max(0, Math.ceil((scheduledTime - now) / 1000))
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  return (
    <span className="font-mono">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  )
}
