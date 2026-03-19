import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { logServerError } from '@/lib/logging'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const relevantEvents = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.payment_failed',
  'charge.refunded',
])

/**
 * POST /api/integrations/stripe/webhook
 * Handles Stripe webhook events for real-time MRR updates.
 * Verifies the webhook signature, checks idempotency, and triggers a metric resync.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!webhookSecret || !stripeSecretKey) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-11-17.clover' })

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    logServerError('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Return 200 immediately for irrelevant events
  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true })
  }

  try {
    // Process webhook via public mutation that handles idempotency and scheduling
    await convex.mutation(api.metrics.processStripeWebhook, {
      stripeEventId: event.id,
      eventType: event.type,
      accountId: event.account ?? '',
    })

    return NextResponse.json({ received: true, processed: true })
  } catch (error) {
    logServerError('Stripe webhook processing error:', error)
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}
