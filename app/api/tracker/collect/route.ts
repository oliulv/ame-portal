import { NextRequest, NextResponse } from 'next/server'
import { logServerError, logServerWarn } from '@/lib/logging'

const CLIENT_IP_HEADERS = [
  'x-real-ip',
  'x-vercel-forwarded-for',
  'cf-connecting-ip',
  'true-client-ip',
  'x-forwarded-for',
]

function readClientIp(request: NextRequest): string {
  for (const header of CLIENT_IP_HEADERS) {
    const parsed = readIpHeader(request.headers.get(header))
    if (parsed) return parsed
  }
  const direct = (request as unknown as { ip?: string }).ip
  return direct ?? ''
}

function readIpHeader(value: string | null): string | null {
  if (!value) return null
  for (const part of value.split(',')) {
    let candidate = part.trim().replace(/^"|"$/g, '')
    if (!candidate || candidate.toLowerCase() === 'unknown') continue

    if (candidate.startsWith('[')) {
      const end = candidate.indexOf(']')
      if (end > 0) candidate = candidate.slice(1, end)
    } else {
      const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)$/.exec(candidate)
      if (ipv4WithPort) candidate = ipv4WithPort[1]
    }

    if (candidate) return candidate
  }
  return null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-umami-cache',
  'Access-Control-Expose-Headers': 'x-umami-cache',
  'Access-Control-Max-Age': '86400',
}

function getConvexSiteUrl(): string {
  if (process.env.CONVEX_SITE_URL) {
    return normalizeConvexSiteUrl(process.env.CONVEX_SITE_URL)
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (convexUrl) {
    return normalizeConvexSiteUrl(convexUrl)
  }
  throw new Error('Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_SITE_URL')
}

function normalizeConvexSiteUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.cloud$/, '.site')
}

function parseJsonOrNull(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const proxySecret = process.env.TRACKER_PROXY_SECRET
    if (!proxySecret) {
      // Server misconfigured. Fail loud rather than silently regressing
      // to the unauthenticated path.
      logServerError('Tracker collect proxy misconfigured', undefined, {
        reason: 'missing_tracker_proxy_secret',
      })
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500, headers: corsHeaders }
      )
    }

    const body = await request.json()
    const siteUrl = getConvexSiteUrl()
    const clientIp = readClientIp(request)
    const userAgent = request.headers.get('user-agent') ?? ''
    if (!clientIp) {
      logServerWarn('Tracker collect proxy missing client IP', {
        hasXRealIp: request.headers.has('x-real-ip'),
        hasXVercelForwardedFor: request.headers.has('x-vercel-forwarded-for'),
        hasXForwardedFor: request.headers.has('x-forwarded-for'),
      })
    }

    const response = await fetch(`${siteUrl}/tracker/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tracker-proxy-secret': proxySecret,
        'x-tracker-client-ip': clientIp,
        'x-tracker-client-ua': userAgent,
      },
      body: JSON.stringify(body),
    })

    const raw = await response.text()
    const data = parseJsonOrNull(raw)
    if (data === null) {
      logServerWarn('Tracker collect upstream returned non-JSON', {
        status: response.status,
        siteHost: new URL(siteUrl).host,
        bodyPrefix: raw.slice(0, 200),
      })
      return NextResponse.json(
        { error: 'Tracker upstream error' },
        { status: response.ok ? 502 : response.status, headers: corsHeaders }
      )
    }
    if (!response.ok) {
      logServerWarn('Tracker collect upstream returned error', {
        status: response.status,
        siteHost: new URL(siteUrl).host,
        body: data,
      })
    }
    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders,
    })
  } catch (error) {
    logServerError('Tracker collect proxy error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
