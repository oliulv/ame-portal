import { describe, expect, it } from 'bun:test'
import { fetchGithubMetrics, syncGithubForStartup } from './metrics'

describe('GitHub metric sync wrapper', () => {
  it('refreshes every startup GitHub connection and marks partial sync failures per account', async () => {
    const connections = [
      { _id: 'conn_ok', accountName: 'octocat' },
      { _id: 'conn_bad', accountName: 'hubot' },
    ]
    const actions: unknown[] = []
    const mutations: unknown[] = []
    const ctx = {
      runQuery: async () => connections,
      runAction: async (_fn: unknown, args: Record<string, unknown>) => {
        actions.push(args)
        if (args.startupId) {
          return {
            successfulConnectionIds: ['conn_ok'],
            failedConnectionSyncErrors: { conn_bad: 'GitHub REST HTTP 401' },
          }
        }
        return null
      },
      runMutation: async (_fn: unknown, args: unknown) => {
        mutations.push(args)
      },
    }

    await expect(
      (syncGithubForStartup as any)._handler(ctx, {
        startupId: 'startup_123',
        connectionId: 'conn_ok',
      })
    ).rejects.toThrow('Some GitHub connections failed to sync: hubot')

    expect(actions).toEqual([
      { connectionId: 'conn_ok' },
      { connectionId: 'conn_bad' },
      { startupId: 'startup_123' },
    ])
    expect(mutations).toHaveLength(2)
    expect(mutations[0]).toMatchObject({ connectionId: 'conn_ok', status: 'active' })
    expect(mutations[1]).toMatchObject({
      connectionId: 'conn_bad',
      status: 'error',
      syncError: 'GitHub REST HTTP 401',
    })
  })

  it('marks every known connection errored when the shared GitHub fetch throws', async () => {
    const connections = [
      { _id: 'conn_a', accountName: 'alice' },
      { _id: 'conn_b', accountName: 'bob' },
    ]
    const mutations: unknown[] = []
    const ctx = {
      runQuery: async () => connections,
      runAction: async (_fn: unknown, args: Record<string, unknown>) => {
        if (args.startupId) throw new Error('All GitHub API calls failed')
        return null
      },
      runMutation: async (_fn: unknown, args: unknown) => {
        mutations.push(args)
      },
    }

    await expect(
      (syncGithubForStartup as any)._handler(ctx, {
        startupId: 'startup_123',
        connectionId: 'conn_a',
      })
    ).rejects.toThrow('All GitHub API calls failed')

    expect(mutations).toEqual([
      {
        connectionId: 'conn_a',
        status: 'error',
        syncError: 'All GitHub API calls failed',
      },
      {
        connectionId: 'conn_b',
        status: 'error',
        syncError: 'All GitHub API calls failed',
      },
    ])
  })
})

describe('fetchGithubMetrics failure handling', () => {
  it('throws instead of overwriting stored metrics when every active connection is unusable', async () => {
    const ctx = {
      runQuery: async () => [{ _id: 'conn_missing_token', accountName: 'octocat' }],
      runMutation: async () => {
        throw new Error('should not store metrics when all GitHub calls fail')
      },
    }

    await expect(
      (fetchGithubMetrics as any)._handler(ctx, { startupId: 'startup_123' })
    ).rejects.toThrow('All GitHub API calls failed for startup startup_123')
  })
})
