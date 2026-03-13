import {
  action as generatedAction,
  internalAction as generatedInternalAction,
  internalMutation as generatedInternalMutation,
  internalQuery as generatedInternalQuery,
  mutation as generatedMutation,
  query as generatedQuery,
  httpAction,
} from './_generated/server'
import { ConvexError } from 'convex/values'
import { logConvexFunctionComplete } from './lib/logging'

type ConvexFunctionKind = 'query' | 'mutation' | 'action'

// Wide event: a single, context-rich log line per function call.
// Handlers enrich this via enrichEvent(ctx, { ... }) to add business context.
export type WideEvent = Record<string, unknown>

// Store wide events by ctx reference to avoid mutating the framework-owned ctx object.
const eventMap = new WeakMap<object, WideEvent>()

/**
 * Add business context to the wide event for the current function call.
 * Usage: enrichEvent(ctx, { userId: user._id, startupId })
 */
export function enrichEvent(ctx: object, data: Record<string, unknown>) {
  const event = eventMap.get(ctx)
  if (event) Object.assign(event, data)
}

/**
 * Wrap a Convex handler with wide-event logging (try/catch/finally).
 * - Associates a wide event with ctx via WeakMap for handler enrichment
 * - Always emits one log line in `finally` — success AND error
 * - Re-throws errors so Convex framework behavior is unchanged
 */
function wrapHandler<Ctx extends object, Args, Result>(
  kind: ConvexFunctionKind,
  handler: (ctx: Ctx, args: Args) => Promise<Result>
): (ctx: Ctx, args: Args) => Promise<Result> {
  return async (ctx: Ctx, args: Args) => {
    const startedAt = Date.now()
    const event: WideEvent = {
      kind,
      argKeys: Object.keys(args as Record<string, unknown>),
    }

    eventMap.set(ctx, event)

    try {
      const result = await handler(ctx, args)
      event.outcome = 'success'
      event.result = result
      return result
    } catch (error) {
      event.outcome = 'error'
      if (error instanceof ConvexError) {
        event.error = {
          type: 'ConvexError',
          message: typeof error.data === 'string' ? error.data : JSON.stringify(error.data),
          isUserFacing: true,
        }
      } else if (error instanceof Error) {
        event.error = {
          type: error.name,
          message: error.message,
        }
      } else {
        event.error = { type: 'Unknown', message: String(error) }
      }
      throw error
    } finally {
      event.durationMs = Date.now() - startedAt
      logConvexFunctionComplete(event)
    }
  }
}

interface ConvexFunctionConfig {
  handler: (...args: any[]) => Promise<any>
  [key: string]: unknown
}

/**
 * Create a wrapped version of a Convex function builder (query/mutation/action)
 * that instruments every handler with wide-event logging.
 */
function createWrapper<T extends (...args: any[]) => any>(base: T, kind: ConvexFunctionKind): T {
  return ((config: ConvexFunctionConfig) => {
    return base({
      ...config,
      handler: wrapHandler(kind, config.handler),
    })
  }) as T
}

export const query = createWrapper(generatedQuery, 'query')
export const internalQuery = createWrapper(generatedInternalQuery, 'query')

export const mutation = createWrapper(generatedMutation, 'mutation')
export const internalMutation = createWrapper(generatedInternalMutation, 'mutation')

export const action = createWrapper(generatedAction, 'action')
export const internalAction = createWrapper(generatedInternalAction, 'action')

export { httpAction }
export type {
  ActionCtx,
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  QueryCtx,
} from './_generated/server'
