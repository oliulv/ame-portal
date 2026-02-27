'use client'

import { Analytics } from '@vercel/analytics/next'

export function AnalyticsProvider() {
  return (
    <Analytics
      beforeSend={(event) => {
        // Don't waste quota on admin/internal pages
        if (new URL(event.url).pathname.startsWith('/admin')) {
          return null
        }
        return event
      }}
    />
  )
}
