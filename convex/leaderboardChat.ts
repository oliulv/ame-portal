import { action } from './functions'
import { v } from 'convex/values'

const SCORING_SYSTEM_PROMPT = `You are a helpful assistant that explains the Accelerate ME leaderboard scoring system. Answer questions clearly and concisely in plain English.

## Scoring Overview
The leaderboard ranks startups in an accelerator cohort based on 6 categories of growth metrics over a rolling 4-week window.

## Categories & Weights
- Revenue Growth (22%) - Week-over-week MRR percentage change from Stripe
- Traffic Growth (18%) - Week-over-week session percentage change from website tracker
- GitHub Activity (16%) - Git Velocity scoring: commits (10pts), PRs opened (25pts), PRs merged (50pts), PR reviews (30pts)
- Social Growth (16%) - Week-over-week follower growth + engagement rate from Twitter, LinkedIn, Instagram
- Weekly Updates (15%) - Base 10pts for submission + streak bonus (+2 per consecutive week, max +10) + admin favorite bonus (+25pts)
- Milestones (13%) - (approved milestones / total milestones) × 100

## Key Mechanics
1. Rolling 4-Week Window: Only the last 4 weeks count. No cumulative advantage.
2. Temporal Decay: score × e^(-0.03 × days_old). This week = 100%, last week ≈ 81%, 2 weeks ≈ 66%, 3 weeks ≈ 53%.
3. Power Law Normalization: Unbounded metrics (revenue, traffic, GitHub, social) are normalized using (1 + value)^p where p is configurable (default 0.7). This compresses outliers while preserving meaningful gaps.
4. 40% Cap: No single category can contribute more than 40% of total score.
5. 4-of-6 Qualification Gate: Must have non-zero activity in at least 4 of 6 categories to appear ranked.
6. Consistency Bonus: Up to +5% bonus for steady performance (low coefficient of variation across weekly scores).
7. Admin Favorite: Up to 2 weekly updates per week can be picked as favorites, giving a 1.25x multiplier on that startup's total score.
8. Anomaly Detection: Spikes >2 standard deviations from the 4-week mean are flagged for admin review.

## How to Improve Score
- Connect Stripe and grow MRR week-over-week
- Install the website tracker and drive traffic growth
- Connect GitHub and maintain consistent development velocity
- Add social media handles and grow followers
- Submit weekly updates consistently to build streaks
- Complete milestones
- Focus on balanced growth across all categories (consistency bonus rewards this)`

/**
 * Chat with the leaderboard scoring AI.
 * Uses OpenRouter (same pattern as ai.ts) with Gemini Flash.
 */
export const chat = action({
  args: {
    message: v.string(),
    context: v.optional(v.string()), // Optional startup-specific context
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return {
        response: 'AI chat is not configured. Please set up OPENROUTER_API_KEY.',
      }
    }

    const messages = [{ role: 'system', content: SCORING_SYSTEM_PROMPT }]

    if (args.context) {
      messages.push({
        role: 'system',
        content: `Current context about the startup being discussed:\n${args.context}`,
      })
    }

    messages.push({ role: 'user', content: args.message })

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? 'Sorry, I could not generate a response.'

    return { response: content }
  },
})
