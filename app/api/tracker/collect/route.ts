import { NextRequest, NextResponse } from 'next/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    const body = await request.json()
    const siteUrl = getConvexSiteUrl()

    const response = await fetch(`${siteUrl}/tracker/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
