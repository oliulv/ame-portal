import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync metrics from Stripe + Tracker every 12 hours
crons.interval(
  "sync-metrics",
  { hours: 12 },
  internal.metrics.syncAllMetrics
);

// Check goal progress based on latest metrics every 6 hours
crons.interval(
  "check-goal-progress",
  { hours: 6 },
  internal.startupGoals.checkAllGoalProgress
);

export default crons;
