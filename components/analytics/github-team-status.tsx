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
  if (founders.length === 0) return null

  const connectedCount = founders.filter((f) => f.hasGithub).length

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            Team GitHub Connections
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {connectedCount}/{founders.length} connected
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {founders.map((founder) => {
            const connection = githubConnections.find((c) => c.connectedByUserId === founder.userId)
            return (
              <div
                key={founder.userId}
                className="flex items-center justify-between py-1.5 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  {founder.hasGithub ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{founder.name}</span>
                </div>
                {connection ? (
                  <span className="text-xs text-muted-foreground">
                    @{connection.accountName}
                    {connection.lastSyncedAt && (
                      <> &middot; synced {new Date(connection.lastSyncedAt).toLocaleDateString()}</>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not connected</span>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
