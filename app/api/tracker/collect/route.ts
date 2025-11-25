import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

/**
 * CORS headers for cross-origin requests from external websites
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 24 hours
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * POST /api/tracker/collect
 * Collect tracking events from the AccelerateMe Tracker script
 * This endpoint is public (no auth required) but validates website IDs
 * CORS enabled to allow requests from any origin (external websites)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, payload } = body

    if (!type || !payload || !payload.website) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: corsHeaders })
    }

    const supabase = createAdminClient()

    // Look up website by ID
    const { data: website, error: websiteError } = await supabase
      .from('tracker_websites')
      .select('id, startup_id')
      .eq('id', payload.website)
      .single()

    if (websiteError || !website) {
      return NextResponse.json(
        { error: 'Invalid website ID' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Get request headers for additional data
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || ''
    const _referer = headersList.get('referer') || payload.referrer || ''
    const _ip =
      headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || 'unknown'

    // Parse user agent (basic parsing - could use a library like ua-parser-js)
    const device = parseDevice(userAgent)
    const browser = parseBrowser(userAgent)
    const os = parseOS(userAgent)

    // Extract UTM parameters from URL
    const url = payload.url || ''
    const utmParams = extractUTMParams(url)

    // Generate or get session ID
    const sessionId = payload.id || generateSessionId()

    // Prepare event data
    const eventData: {
      website_id: string
      session_id: string
      event_name: string | null
      url: string
      referrer: string | null
      utm_source: string | null
      utm_medium: string | null
      utm_campaign: string | null
      utm_term: string | null
      utm_content: string | null
      country: string | null
      device: string | null
      browser: string | null
      os: string | null
      screen: string | null
      language: string | null
      title: string | null
      hostname: string | null
      data: Record<string, unknown> | null
    } = {
      website_id: website.id,
      session_id: sessionId,
      event_name: type === 'event' && payload.name ? payload.name : null,
      url: normalizeUrl(url),
      referrer: payload.referrer ? normalizeUrl(payload.referrer) : null,
      utm_source: utmParams.source || null,
      utm_medium: utmParams.medium || null,
      utm_campaign: utmParams.campaign || null,
      utm_term: utmParams.term || null,
      utm_content: utmParams.content || null,
      country: null, // TODO: Add geo IP lookup
      device: device || null,
      browser: browser || null,
      os: os || null,
      screen: payload.screen || null,
      language: payload.language || null,
      title: payload.title || null,
      hostname: payload.hostname || null,
      data: payload.data ? payload.data : null,
    }

    // Insert event
    const { error: insertError } = await supabase.from('tracker_events').insert(eventData)

    if (insertError) {
      console.error('Error inserting tracker event:', insertError)
      return NextResponse.json(
        { error: 'Failed to store event' },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error in tracker collect:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Normalize URL (remove hash, optionally search params)
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

/**
 * Extract UTM parameters from URL
 */
function extractUTMParams(url: string): {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
} {
  try {
    const u = new URL(url)
    return {
      source: u.searchParams.get('utm_source') || undefined,
      medium: u.searchParams.get('utm_medium') || undefined,
      campaign: u.searchParams.get('utm_campaign') || undefined,
      term: u.searchParams.get('utm_term') || undefined,
      content: u.searchParams.get('utm_content') || undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Generate a session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Basic device detection from user agent
 */
function parseDevice(userAgent: string): string | null {
  const ua = userAgent.toLowerCase()
  if (
    /mobile|android|iphone|ipod|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec/i.test(
      ua
    )
  ) {
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      return 'tablet'
    }
    return 'mobile'
  }
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet'
  }
  return 'desktop'
}

/**
 * Basic browser detection from user agent
 */
function parseBrowser(userAgent: string): string | null {
  const ua = userAgent.toLowerCase()
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
  if (ua.includes('edg')) return 'Edge'
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera'
  return null
}

/**
 * Basic OS detection from user agent
 */
function parseOS(userAgent: string): string | null {
  const ua = userAgent.toLowerCase()
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('mac os')) return 'macOS'
  if (ua.includes('linux')) return 'Linux'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS'
  return null
}
