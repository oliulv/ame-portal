import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Sync metrics from Stripe + Tracker every 12 hours
crons.interval('sync-metrics', { hours: 12 }, internal.metrics.syncAllMetrics)

// Send daily event reminders at 8am UTC
crons.cron('daily-event-reminders', '0 8 * * *', internal.notifications.sendDailyEventReminders)

export default crons
