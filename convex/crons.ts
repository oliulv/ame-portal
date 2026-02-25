import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Sync metrics from Stripe + Tracker every 12 hours
crons.interval('sync-metrics', { hours: 12 }, internal.metrics.syncAllMetrics)

export default crons
