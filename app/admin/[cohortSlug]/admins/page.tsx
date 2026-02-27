'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserPlus, RotateCw, X, Trash2 } from 'lucide-react'

const adminInvitationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  invitedName: z.string().min(1, 'Name is required'),
  expiresInDays: z.number().min(1).max(30).default(14),
  role: z.enum(['admin', 'super_admin']).default('admin'),
})

type AdminInvitationFormData = z.infer<typeof adminInvitationSchema>

export default function AdminsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [userToDelete, setUserToDelete] = useState<{
    _id: string
    role: string
    email?: string
    fullName?: string
    cohortIds: string[]
  } | null>(null)

  // Mutation pending states
  const [isCreating, setIsCreating] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  // Fetch current user to determine role
  const currentUser = useQuery(api.users.current)

  // Fetch cohort details to get cohort _id
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })

  // Fetch admin users filtered by cohort (skip if cohort not loaded yet)
  const adminUsers = useQuery(api.adminUsers.list, cohort ? { cohortId: cohort._id } : 'skip')

  // Fetch admin invitations for this cohort
  const invitations = useQuery(
    api.adminInvitations.list,
    cohort ? { cohortId: cohort._id } : 'skip'
  )

  // Mutations
  const createInvitation = useMutation(api.adminInvitations.create)
  const resendInvitation = useMutation(api.adminInvitations.resend)
  const revokeInvitation = useMutation(api.adminInvitations.revoke)
  const removeAdminFromCohort = useMutation(api.adminCohorts.remove)

  const form = useForm({
    resolver: zodResolver(adminInvitationSchema),
    defaultValues: {
      email: '',
      invitedName: '',
      expiresInDays: 14,
      role: 'admin' as const,
    },
    mode: 'onChange',
  })

  function handleDeleteClick(user: NonNullable<typeof adminUsers>[number]) {
    setUserToDelete(user)
  }

  async function handleConfirmDelete() {
    if (!userToDelete || !cohort) return
    setIsRemoving(true)
    try {
      await removeAdminFromCohort({
        userId: userToDelete._id as any,
        cohortId: cohort._id,
      })
      toast.success('Admin removed from cohort successfully')
      setUserToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove admin')
    } finally {
      setIsRemoving(false)
    }
  }

  async function onSubmit(data: AdminInvitationFormData) {
    if (!cohort) return
    setIsCreating(true)
    try {
      await createInvitation({
        email: data.email,
        invitedName: data.invitedName,
        cohortId: cohort._id,
        expiresInDays: data.expiresInDays,
        role: data.role,
      })
      toast.success('Admin invitation created and email sent successfully')
      form.reset()
      setShowCreateForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invitation')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleResend(invitationId: string) {
    setResendingId(invitationId)
    try {
      await resendInvitation({ id: invitationId as any })
      toast.success('Invitation email resent successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  async function handleRevoke(invitationId: string) {
    setRevokingId(invitationId)
    try {
      await revokeInvitation({ id: invitationId as any })
      toast.success('Invitation revoked successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation')
    } finally {
      setRevokingId(null)
    }
  }

  function getInvitationStatus(invitation: {
    acceptedAt?: string
    expiresAt: string
  }): 'pending' | 'accepted' | 'expired' {
    if (invitation.acceptedAt) return 'accepted'
    if (new Date(invitation.expiresAt) < new Date()) return 'expired'
    return 'pending'
  }

  // Convex useQuery returns undefined while loading, null if not found
  if (cohort === undefined) {
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

  if (cohort === null) {
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
          {adminUsers === undefined ? (
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminUsers.map((user) => {
                    // Only show delete button for regular admins (not super admins)
                    // and only if they're assigned to this cohort (not just appearing because they're super admin)
                    const canDelete = user.role === 'admin' && user.cohortIds?.includes(cohort._id)

                    return (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium">
                          {user.fullName || (
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
                          {new Date(user._creationTime).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(user)}
                              disabled={isRemoving}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
                  name="invitedName"
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

                {currentUser?.role === 'super_admin' && (
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Super admins can manage other admins and appear in all cohorts.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="expiresInDays"
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
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create Invitation'}
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
          )}

          {/* Invitations Table */}
          {invitations === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
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
                      <TableRow key={invitation._id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{invitation.invitedName || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={invitation.role === 'super_admin' ? 'destructive' : 'default'}
                          >
                            {invitation.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                          </Badge>
                        </TableCell>
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
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invitation._creationTime).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isPending && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResend(invitation._id)}
                                  disabled={resendingId === invitation._id}
                                >
                                  <RotateCw className="mr-1 h-3 w-3" />
                                  Resend
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRevoke(invitation._id)}
                                  disabled={revokingId === invitation._id}
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
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Admin from Cohort</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{userToDelete?.fullName || userToDelete?.email || 'this admin'}</strong> from{' '}
              <strong>{cohort?.label}</strong>? They will lose access to this cohort but will remain
              an admin user.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)} disabled={isRemoving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isRemoving}>
              {isRemoving ? 'Removing...' : 'Remove Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
