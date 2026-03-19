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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Send,
  AlertTriangle,
  Ban,
  CheckCircle2,
  XCircle,
  Phone,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  NOTIFICATION_TYPES,
  ACTIVE_NOTIFICATION_TYPES,
  GROUP_ORDER,
  GROUP_LABELS,
  groupByCategory,
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
import { useState } from 'react'
import type { Id } from '@/convex/_generated/dataModel'

const INITIAL_VISIBLE = 5

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

  const [breakdownExpanded, setBreakdownExpanded] = useState(false)
  const [breakdownSearch, setBreakdownSearch] = useState('')
  const [breakdownCategory, setBreakdownCategory] = useState<string>('all')
  const [breakdownAudience, setBreakdownAudience] = useState<string>('all')
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [settingsSearch, setSettingsSearch] = useState('')
  const [settingsCategory, setSettingsCategory] = useState<string>('all')
  const [settingsAudience, setSettingsAudience] = useState<string>('all')
  const [usersExpanded, setUsersExpanded] = useState(false)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersStatus, setUsersStatus] = useState<string>('all')

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
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_150px_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={breakdownSearch}
                onChange={(e) => {
                  setBreakdownSearch(e.target.value)
                  setBreakdownExpanded(true)
                }}
                placeholder="Search types"
                className="pl-9"
              />
            </div>
            <Select value={breakdownCategory} onValueChange={setBreakdownCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {GROUP_ORDER.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={breakdownAudience} onValueChange={setBreakdownAudience}>
              <SelectTrigger>
                <SelectValue placeholder="Recipient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recipients</SelectItem>
                <SelectItem value="admins">Admins</SelectItem>
                <SelectItem value="founders">Founders</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(() => {
            const normalizedQuery = breakdownSearch.trim().toLowerCase()
            const filtered = ACTIVE_NOTIFICATION_TYPES.filter((t) => {
              if (
                normalizedQuery.length > 0 &&
                !t.label.toLowerCase().includes(normalizedQuery) &&
                !t.description.toLowerCase().includes(normalizedQuery)
              )
                return false
              if (breakdownCategory !== 'all' && t.group !== breakdownCategory) return false
              if (breakdownAudience !== 'all' && t.audience !== breakdownAudience) return false
              return true
            })
            const hasFilters =
              normalizedQuery.length > 0 ||
              breakdownCategory !== 'all' ||
              breakdownAudience !== 'all'
            const visible =
              breakdownExpanded || hasFilters ? filtered : filtered.slice(0, INITIAL_VISIBLE)
            const hiddenCount = filtered.length - visible.length

            return (
              <>
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
                    {visible.map((t) => {
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
                {hiddenCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setBreakdownExpanded(true)}
                  >
                    <ChevronDown className="mr-1.5 h-4 w-4" />
                    Show {hiddenCount} more
                  </Button>
                )}
                {breakdownExpanded && !hasFilters && filtered.length > INITIAL_VISIBLE && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setBreakdownExpanded(false)}
                  >
                    <ChevronUp className="mr-1.5 h-4 w-4" />
                    Show less
                  </Button>
                )}
              </>
            )
          })()}
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
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={stats.timeSeries}
                margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d + 'T00:00:00')
                    return date.getDate().toString()
                  }}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                  labelFormatter={(d: string) =>
                    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  }
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                />
                <Bar
                  dataKey="sent"
                  fill="hsl(var(--chart-1))"
                  name="Sent"
                  stackId="a"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  fill="hsl(var(--chart-4))"
                  name="Failed"
                  stackId="a"
                  radius={[3, 3, 0, 0]}
                />
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
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_150px_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={settingsSearch}
                onChange={(e) => {
                  setSettingsSearch(e.target.value)
                  setSettingsExpanded(true)
                }}
                placeholder="Search settings"
                className="pl-9"
              />
            </div>
            <Select value={settingsCategory} onValueChange={setSettingsCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {GROUP_ORDER.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={settingsAudience} onValueChange={setSettingsAudience}>
              <SelectTrigger>
                <SelectValue placeholder="Recipient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recipients</SelectItem>
                <SelectItem value="admins">Admins</SelectItem>
                <SelectItem value="founders">Founders</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(() => {
            const normalizedQuery = settingsSearch.trim().toLowerCase()
            const allTypes = NOTIFICATION_TYPES.filter((t) => {
              if (
                normalizedQuery.length > 0 &&
                !t.label.toLowerCase().includes(normalizedQuery) &&
                !t.description.toLowerCase().includes(normalizedQuery)
              )
                return false
              if (settingsCategory !== 'all' && t.group !== settingsCategory) return false
              if (settingsAudience !== 'all' && t.audience !== settingsAudience) return false
              return true
            })
            const groups = groupByCategory(allTypes)
            const totalCount = allTypes.length
            const hasFilters =
              normalizedQuery.length > 0 || settingsCategory !== 'all' || settingsAudience !== 'all'

            // Pre-compute visible types per group with a global limit
            const limit = settingsExpanded || hasFilters ? Infinity : INITIAL_VISIBLE
            const visibleGroups: { group: string; label: string; types: typeof allTypes }[] = []
            {
              let used = 0
              for (const { group, label, types } of groups) {
                const take = Math.min(types.length, limit - used)
                if (take <= 0) break
                used += take
                visibleGroups.push({ group, label, types: types.slice(0, take) })
              }
            }

            return (
              <>
                <div className="space-y-6">
                  {visibleGroups.map(({ group, label, types }) => (
                    <div key={group}>
                      <h4 className="text-sm font-semibold mb-3">{label}</h4>
                      <div className="space-y-2">
                        {types.map((t) => {
                          const enabled = globalSettings[t.key] ?? true

                          return (
                            <div
                              key={t.key}
                              className="flex items-center justify-between border p-3"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{t.label}</p>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {audienceLabel[t.audience]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{t.description}</p>
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={(checked) => handleToggle(t.key, checked)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {!settingsExpanded && !hasFilters && totalCount > INITIAL_VISIBLE && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setSettingsExpanded(true)}
                  >
                    <ChevronDown className="mr-1.5 h-4 w-4" />
                    Show {totalCount - INITIAL_VISIBLE} more
                  </Button>
                )}
                {settingsExpanded && !hasFilters && totalCount > INITIAL_VISIBLE && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setSettingsExpanded(false)}
                  >
                    <ChevronUp className="mr-1.5 h-4 w-4" />
                    Show less
                  </Button>
                )}
              </>
            )
          })()}
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
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={usersSearch}
                onChange={(e) => {
                  setUsersSearch(e.target.value)
                  setUsersExpanded(true)
                }}
                placeholder="Search users"
                className="pl-9"
              />
            </div>
            <Select value={usersStatus} onValueChange={setUsersStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(() => {
            const normalizedQuery = usersSearch.trim().toLowerCase()
            const allUsers = [...userStatus.admins, ...userStatus.founders]
            const filtered = allUsers.filter((u) => {
              if (
                normalizedQuery.length > 0 &&
                !u.name.toLowerCase().includes(normalizedQuery) &&
                !u.role.toLowerCase().includes(normalizedQuery)
              )
                return false
              if (usersStatus === 'active' && !(u.isVerified && u.notificationsEnabled))
                return false
              if (usersStatus === 'inactive' && u.isVerified && u.notificationsEnabled) return false
              return true
            })
            const hasFilters = normalizedQuery.length > 0 || usersStatus !== 'all'
            const visible =
              usersExpanded || hasFilters ? filtered : filtered.slice(0, INITIAL_VISIBLE)
            const hiddenCount = filtered.length - visible.length

            return (
              <>
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
                    {visible.map((user) => (
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
                {hiddenCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setUsersExpanded(true)}
                  >
                    <ChevronDown className="mr-1.5 h-4 w-4" />
                    Show {hiddenCount} more
                  </Button>
                )}
                {usersExpanded && !hasFilters && filtered.length > INITIAL_VISIBLE && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setUsersExpanded(false)}
                  >
                    <ChevronUp className="mr-1.5 h-4 w-4" />
                    Show less
                  </Button>
                )}
              </>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
