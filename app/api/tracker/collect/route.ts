import { NextRequest, NextResponse } from 'next/server'

// Vercel populates these on every incoming request. `x-real-ip` is the
// trusted single-IP value behind their edge; `x-forwarded-for` is the
// classic comma-separated list with the client at index 0. We prefer
// `x-real-ip` and fall back to the leftmost forwarded entry. `req.ip`
// would also work on Vercel runtimes but isn't always present in local dev.
function readClientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')
  if (realIp && realIp.trim().length > 0) return realIp.trim()
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  const first = forwarded.split(',')[0]?.trim()
  if (first) return first
  const direct = (request as unknown as { ip?: string }).ip
  return direct ?? ''
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
    return process.env.CONVEX_SITE_URL
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (convexUrl) {
    return convexUrl.replace(/\.cloud$/, '.site')
  }
  throw new Error('Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_SITE_URL')
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
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500, headers: corsHeaders }
      )
    }

    const body = await request.json()
    const siteUrl = getConvexSiteUrl()
    const clientIp = readClientIp(request)
    const userAgent = request.headers.get('user-agent') ?? ''

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

    const data = await response.json()
    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders,
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
