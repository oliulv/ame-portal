import { auth } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json(null, { status: 401 })
  }

  try {
    const user = await getCurrentUser()
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error getting current user:', error)
    return NextResponse.json(null, { status: 500 })
  }
}
