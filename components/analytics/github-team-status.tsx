'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Github, CheckCircle2, XCircle } from 'lucide-react'

interface FounderStatus {
  userId: string
  name: string
  hasGithub: boolean
}

interface GithubConnection {
  accountName?: string
  status: string
  lastSyncedAt?: string
  userName?: string
  connectedByUserId?: string
}

interface GithubTeamStatusProps {
  founders: FounderStatus[]
  githubConnections: GithubConnection[]
}

export function GithubTeamStatus({ founders, githubConnections }: GithubTeamStatusProps) {
  if (githubConnections.length === 0 && founders.length === 0) return null

  // Show connected accounts (from connection data, not from founder profile matching)
  // and unconnected founders (those whose userId doesn't appear in any connection)
  const unconnectedFounders = founders.filter((f) => !f.hasGithub)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            Team GitHub Connections
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {githubConnections.length} connected
            {unconnectedFounders.length > 0 && <>, {unconnectedFounders.length} pending</>}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Connected accounts — show directly from connection data */}
          {githubConnections.map((conn) => (
            <div
              key={conn.accountName ?? conn.connectedByUserId}
              className="flex items-center justify-between py-1.5 border-b last:border-0"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  {conn.userName ??
                    (conn.accountName ? (
                      <a
                        href={`https://github.com/${conn.accountName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{conn.accountName}
                      </a>
                    ) : null)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {conn.accountName ? (
                  <a
                    href={`https://github.com/${conn.accountName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{conn.accountName}
                  </a>
                ) : null}
                {conn.lastSyncedAt && (
                  <> &middot; synced {new Date(conn.lastSyncedAt).toLocaleDateString()}</>
                )}
              </span>
            </div>
          ))}

          {/* Unconnected founders */}
          {unconnectedFounders.map((founder) => (
            <div
              key={founder.userId}
              className="flex items-center justify-between py-1.5 border-b last:border-0"
            >
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{founder.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">Not connected</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
