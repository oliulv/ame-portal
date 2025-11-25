import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    // If the webhook secret is not configured, safely no-op so local/dev
    // environments don't crash when Clerk tries to call this endpoint.
    console.warn(
      'CLERK_WEBHOOK_SECRET is not set; skipping Clerk webhook handling. User records will only be created via invite/onboarding flows.'
    )
    return new Response('', { status: 200 })
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type
  const supabase = createAdminClient()

  if (eventType === 'user.created') {
    const { id, email_addresses: _email_addresses } = evt.data

    // We no longer auto-provision app users here. User records are created
    // explicitly when a founder accepts an invite or when an admin/super_admin
    // onboards them. This prevents unauthorised signups from gaining founder
    // access by default.
    console.info('Clerk user.created webhook received for', id, '- no auto-provision performed.')
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data

    // Delete user record (cascade will handle related records)
    const { error } = await supabase.from('users').delete().eq('id', id)

    if (error) {
      console.error('Error deleting user:', error)
      return new Response('Error deleting user', { status: 500 })
    }
  }

  return new Response('', { status: 200 })
}
