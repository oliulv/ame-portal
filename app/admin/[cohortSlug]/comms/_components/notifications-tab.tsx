'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Send, AlertTriangle, Ban, CheckCircle2, XCircle, Phone } from 'lucide-react'
import { toast } from 'sonner'
import {
  NOTIFICATION_TYPES,
  ACTIVE_NOTIFICATION_TYPES,
  type NotificationType,
} from '@/convex/lib/notificationTypes'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Id } from '@/convex/_generated/dataModel'

function groupByAudience(types: NotificationType[]) {
  const groups: Record<string, NotificationType[]> = {
    admins: [],
    founders: [],
    all: [],
  }
  for (const t of types) {
    groups[t.audience].push(t)
  }
  return groups
}

const audienceLabel: Record<string, string> = {
  admins: 'Admins',
  founders: 'Founders',
  all: 'Everyone',
}

export function NotificationsTab({
  cohortSlug,
  cohortId,
}: {
  cohortSlug: string
  cohortId: Id<'cohorts'>
}) {
  const stats = useQuery(api.notificationAdmin.getNotificationStats, { cohortId })
  const globalSettings = useQuery(api.notificationAdmin.getGlobalSettings, { cohortId })
  const userStatus = useQuery(api.notificationAdmin.getUserNotificationStatus, { cohortId })
  const setGlobalToggle = useMutation(api.notificationAdmin.setGlobalToggle)

  const handleToggle = async (notificationType: string, enabled: boolean) => {
    try {
      await setGlobalToggle({ cohortId, notificationType, enabled })
      toast.success(enabled ? 'Notification enabled' : 'Notification disabled')
    } catch {
      toast.error('Failed to update setting')
    }
  }

  if (stats === undefined || globalSettings === undefined || userStatus === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const grouped = groupByAudience(NOTIFICATION_TYPES)

  return (
    <div className="space-y-6">
      {/* Section 1: Delivery Analytics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
            </div>
            <p className="mt-1 text-2xl font-bold font-display text-green-600">
              {stats.totals.sent.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm font-medium text-muted-foreground">Failed</p>
            </div>
            <p className="mt-1 text-2xl font-bold font-display text-red-600">
              {stats.totals.failed.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Skipped</p>
            </div>
            <p className="mt-1 text-2xl font-bold font-display">
              {stats.totals.skipped.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-type breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Breakdown</CardTitle>
          <CardDescription>Delivery stats per notification type</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACTIVE_NOTIFICATION_TYPES.map((t) => {
                const s = stats.perType[t.key] || { sent: 0, failed: 0, skipped: 0 }
                return (
                  <TableRow key={t.key}>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{audienceLabel[t.audience]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{s.sent}</TableCell>
                    <TableCell className="text-right">{s.failed}</TableCell>
                    <TableCell className="text-right">{s.skipped}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Time series chart */}
      {stats.timeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Over Time</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d)
                    return `${date.getDate()}/${date.getMonth() + 1}`
                  }}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  labelFormatter={(d: string) =>
                    new Date(d).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })
                  }
                />
                <Legend />
                <Bar dataKey="sent" fill="hsl(142, 71%, 45%)" name="Sent" stackId="a" />
                <Bar dataKey="failed" fill="hsl(0, 72%, 51%)" name="Failed" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Section 2: Global Notification Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Enable or disable notification types for this cohort. Disabling prevents SMS dispatch
            regardless of individual preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(grouped).map(([audience, types]) =>
            types.length > 0 ? (
              <div key={audience}>
                <h4 className="text-sm font-semibold mb-3">{audienceLabel[audience]}</h4>
                <div className="space-y-2">
                  {types.map((t) => {
                    const isActive = t.status === 'active'
                    const enabled = isActive ? (globalSettings[t.key] ?? true) : false

                    return (
                      <div
                        key={t.key}
                        className={`flex items-center justify-between border p-3 ${!isActive ? 'opacity-50' : ''}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{t.label}</p>
                            {!isActive && (
                              <Badge variant="outline" className="text-xs">
                                Coming soon
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        </div>
                        <Switch
                          checked={enabled}
                          disabled={!isActive}
                          onCheckedChange={(checked) => handleToggle(t.key, checked)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null
          )}
        </CardContent>
      </Card>

      {/* Section 3: User SMS Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            User Notification Status
          </CardTitle>
          <CardDescription>
            {userStatus.smsEnabledCount} of {userStatus.totalCount} users have SMS notifications
            enabled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Preferences</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...userStatus.admins, ...userStatus.founders].map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? 'Admin' : 'Founder'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.phone ? `****${user.phone.slice(-4)}` : '—'}
                  </TableCell>
                  <TableCell>
                    {user.isVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    {user.isVerified && user.notificationsEnabled ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{user.enabledPreferenceCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
