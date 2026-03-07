import posthog from 'posthog-js'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  ui_host: 'https://eu.posthog.com',
  defaults: '2026-01-30',
  person_profiles: 'identified_only',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: true,
  session_recording: {
    maskAllInputs: false,
    maskInputFn: (text, element) => {
      if (element?.getAttribute('type') === 'password') return '*'.repeat(text.length)
      return text
    },
  },
  capture_exceptions: true,
})
