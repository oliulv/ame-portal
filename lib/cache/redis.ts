import { Redis } from '@upstash/redis'

// Singleton Redis client for server-side caching
// Uses Upstash REST API - works in Edge, Serverless, and Node.js
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
