import {
  action as generatedAction,
  internalAction as generatedInternalAction,
  internalMutation as generatedInternalMutation,
  internalQuery as generatedInternalQuery,
  mutation as generatedMutation,
  query as generatedQuery,
  httpAction,
} from './_generated/server'
import { customAction, customMutation, customQuery } from 'convex-helpers/server/customFunctions'
import { logConvexFunctionSuccess } from './lib/logging'

type ConvexFunctionKind = 'query' | 'mutation' | 'action'

function createLoggingCustomization(kind: ConvexFunctionKind) {
  return {
    args: {},
    input: async () => {
      const startedAt = Date.now()
      return {
        ctx: {},
        args: {},
        onSuccess: ({ args, result }: { args: Record<string, unknown>; result: unknown }) => {
          logConvexFunctionSuccess({
            kind,
            args,
            result,
            durationMs: Date.now() - startedAt,
          })
        },
      }
    },
  }
}

export const query = customQuery(generatedQuery, createLoggingCustomization('query'))
export const internalQuery = customQuery(
  generatedInternalQuery,
  createLoggingCustomization('query')
)

export const mutation = customMutation(generatedMutation, createLoggingCustomization('mutation'))
export const internalMutation = customMutation(
  generatedInternalMutation,
  createLoggingCustomization('mutation')
)

export const action = customAction(generatedAction, createLoggingCustomization('action'))
export const internalAction = customAction(
  generatedInternalAction,
  createLoggingCustomization('action')
)

export { httpAction }
export type {
  ActionCtx,
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  QueryCtx,
} from './_generated/server'
