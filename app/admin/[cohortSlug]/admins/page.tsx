'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Mail, UserPlus, RotateCw, X } from 'lucide-react'
import { adminInvitationsApi } from '@/lib/api/admin-invitations'
import { cohortsApi } from '@/lib/api/cohorts'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { AdminInvitation } from '@/lib/types'

interface AdminUserWithDetails {
  id: string
  role: 'super_admin' | 'admin'
  created_at: string
  updated_at: string
  email: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  cohort_ids?: string[]
}

const adminInvitationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  invited_name: z.string().min(1, 'Name is required'),
  expires_in_days: z.number().min(1).max(30).default(14),
})

type AdminInvitationFormData = z.infer<typeof adminInvitationSchema>

export default function AdminsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Fetch cohort details to get cohort_id
  const { data: cohort, isLoading: isLoadingCohort } = useQuery({
    queryKey: ['cohort', cohortSlug],
    queryFn: () => cohortsApi.getBySlug(cohortSlug),
    enabled: !!cohortSlug,
  })

  // Fetch admin users with Clerk data, filtered by cohort
  const { data: adminUsers, isLoading: isLoadingUsers } = useQuery<AdminUserWithDetails[]>({
    queryKey: ['admin-users', cohort?.id],
    queryFn: async () => {
      const url = cohort?.id ? `/api/admin/users?cohort_id=${cohort.id}` : '/api/admin/users'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch admin users')
      return response.json()
    },
    enabled: !!cohort?.id,
  })

  // Fetch admin invitations for this cohort
  const {
    data: invitations = [],
    isLoading: isLoadingInvitations,
    error: invitationsError,
  } = useQuery<AdminInvitation[]>({
    queryKey: queryKeys.adminInvitations.list(cohort?.id),
    queryFn: () => adminInvitationsApi.list(cohort?.id),
    enabled: !!cohort?.id,
  })

  const form = useForm({
    resolver: zodResolver(adminInvitationSchema),
    defaultValues: {
      email: '',
      invited_name: '',
      expires_in_days: 14,
    },
    mode: 'onChange',
  })

  const createInvitation = useAppMutation({
    mutationFn: (data: AdminInvitationFormData) => {
      if (!cohort?.id) {
        throw new Error('Cohort not found')
      }
      return adminInvitationsApi.create({
        ...data,
        cohort_id: cohort.id,
      })
    },
    invalidateQueries: [],
    successMessage: 'Admin invitation created and email sent successfully',
    onSuccess: () => {
      // Invalidate queries with the actual cohort ID
      if (cohort?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.adminInvitations.list(cohort.id) })
        // Also invalidate the broader pattern to catch any variations
        queryClient.invalidateQueries({ queryKey: queryKeys.adminInvitations.lists() })
      }
      form.reset()
      setShowCreateForm(false)
    },
  })

  const resendInvitation = useAppMutation({
    mutationFn: (invitationId: string) => adminInvitationsApi.resend(invitationId),
    invalidateQueries: [],
    successMessage: 'Invitation email resent successfully',
    onSuccess: () => {
      // Invalidate queries with the actual cohort ID
      if (cohort?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.adminInvitations.list(cohort.id) })
        // Also invalidate the broader pattern to catch any variations
        queryClient.invalidateQueries({ queryKey: queryKeys.adminInvitations.lists() })
      }
    },
  })

  const revokeInvitation = useAppMutation({
    mutationFn: (invitationId: string) => adminInvitationsApi.revoke(invitationId),
    invalidateQueries: [],
    successMessage: 'Invitation revoked successfully',
    onSuccess: () => {
      // Invalidate queries with the actual cohort ID
      if (cohort?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.adminInvitations.list(cohort.id) })
        // Also invalidate the broader pattern to catch any variations
        queryClient.invalidateQueries({ queryKey: queryKeys.adminInvitations.lists() })
      }
    },
  })

  function onSubmit(data: AdminInvitationFormData) {
    createInvitation.mutate(data)
  }

  function getInvitationStatus(invitation: AdminInvitation): 'pending' | 'accepted' | 'expired' {
    if (invitation.accepted_at) return 'accepted'
    if (new Date(invitation.expires_at) < new Date()) return 'expired'
    return 'pending'
  }

  const isLoading = isLoadingCohort || isLoadingUsers || isLoadingInvitations

  if (isLoadingCohort) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 mt-2" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!cohort) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cohort Not Found</h1>
          <p className="text-muted-foreground">The requested cohort could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administrators</h1>
        <p className="text-muted-foreground">
          Manage admins for <strong>{cohort.label}</strong>. Super admins appear in all cohorts.
        </p>
      </div>

      {/* Admin Users Section */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Accounts</CardTitle>
          <CardDescription>
            Users with access to this cohort. Super admins can manage other admins and appear in all
            cohorts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : adminUsers && adminUsers.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || user.first_name || user.last_name || (
                          <span className="text-muted-foreground italic">No name set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.email || (
                          <span className="text-muted-foreground italic">No email</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'super_admin' ? 'destructive' : 'default'}>
                          {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : 'Unknown'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No admin users found"
              description="You can invite new admins to this cohort using the invitation form below."
              noCard
            />
          )}
        </CardContent>
      </Card>

      {/* Admin Invitations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Admin Invitations</CardTitle>
              <CardDescription>
                Invite new admins to join this cohort. They will receive an email with a link to
                accept the invitation.
              </CardDescription>
            </div>
            {!showCreateForm && (
              <Button onClick={() => setShowCreateForm(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Admin
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create Invitation Form */}
          {showCreateForm && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <div>
                <h3 className="text-lg font-semibold">Create Admin Invitation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This invitation will be for <strong>{cohort.label}</strong>
                </p>
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="admin@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          The email address of the person you want to invite as an admin.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invited_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormDescription>Name to include in the invitation email.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expires_in_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expires In (Days)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 14)}
                          />
                        </FormControl>
                        <FormDescription>
                          Number of days until the invitation expires (1-30 days, default: 14).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button type="submit" disabled={createInvitation.isPending}>
                      {createInvitation.isPending ? 'Creating...' : 'Create Invitation'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        form.reset()
                        setShowCreateForm(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Invitations Table */}
          {isLoadingInvitations ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : invitationsError ? (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load invitations. Please refresh the page.
            </div>
          ) : invitations.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => {
                    const status = getInvitationStatus(invitation)
                    const isPending = status === 'pending'

                    return (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{invitation.invited_name || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              status === 'accepted'
                                ? 'success'
                                : status === 'expired'
                                  ? 'secondary'
                                  : 'default'
                            }
                          >
                            {status === 'accepted'
                              ? 'Accepted'
                              : status === 'expired'
                                ? 'Expired'
                                : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isPending && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resendInvitation.mutate(invitation.id)}
                                  disabled={resendInvitation.isPending}
                                >
                                  <RotateCw className="mr-1 h-3 w-3" />
                                  Resend
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => revokeInvitation.mutate(invitation.id)}
                                  disabled={revokeInvitation.isPending}
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Revoke
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="No admin invitations"
              description="Create an invitation to invite a new admin to this cohort."
              action={
                <Button onClick={() => setShowCreateForm(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create First Invitation
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
