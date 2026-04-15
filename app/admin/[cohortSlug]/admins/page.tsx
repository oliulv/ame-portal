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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Check, ChevronsUpDown, Users, UserPlus, RotateCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const adminInvitationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  invitedName: z.string().min(1, 'Name is required'),
  expiresInDays: z.number().int().min(1).max(30),
  role: z.enum(['admin', 'super_admin']),
})

type AdminInvitationFormData = z.infer<typeof adminInvitationSchema>

type PermissionType =
  | 'approve_milestones'
  | 'approve_invoices'
  | 'send_announcements'
  | 'manage_notifications'

export default function AdminsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<NonNullable<typeof adminUsers>[number] | null>(
    null
  )
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
  const [isRemoving, setIsRemoving] = useState(false)
  const [invitationToDelete, setInvitationToDelete] = useState<{
    _id: string
    email: string
    invitedName?: string
  } | null>(null)
  const [isDeletingInvitation, setIsDeletingInvitation] = useState(false)

  // Fetch current user to determine role
  const currentUser = useQuery(api.users.current)

  // Fetch cohort details to get cohort _id
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })

  // Fetch admin users filtered by cohort (skip if cohort not loaded yet)
  const adminUsers = useQuery(api.adminUsers.list, cohort ? { cohortId: cohort._id } : 'skip')

  // Startups in this cohort (needed for startup-scoped permission grants)
  const startups = useQuery(api.startups.list, cohort ? { cohortId: cohort._id } : 'skip')

  // Fetch admin invitations for this cohort
  const invitations = useQuery(
    api.adminInvitations.list,
    cohort ? { cohortId: cohort._id } : 'skip'
  )

  // Permissions (super_admin only)
  const permissions = useQuery(
    api.adminPermissions.list,
    currentUser?.role === 'super_admin' && cohort ? { cohortId: cohort._id } : 'skip'
  )
  const grantPermission = useMutation(api.adminPermissions.grant)
  const revokePermission = useMutation(api.adminPermissions.revoke)

  // Mutations
  const createInvitation = useMutation(api.adminInvitations.create)
  const resendInvitation = useMutation(api.adminInvitations.resend)
  const removeAdminFromCohort = useMutation(api.adminCohorts.remove)
  const deleteInvitation = useMutation(api.adminInvitations.remove)

  const form = useForm<AdminInvitationFormData>({
    resolver: zodResolver(adminInvitationSchema),
    defaultValues: {
      email: '',
      invitedName: '',
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
        appUrl: window.location.origin,
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
      await resendInvitation({ id: invitationId as any, appUrl: window.location.origin })
      toast.success('Invitation email resent successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  async function handleConfirmDeleteInvitation() {
    if (!invitationToDelete) return
    setIsDeletingInvitation(true)
    try {
      await deleteInvitation({ id: invitationToDelete._id as any })
      toast.success('Invitation deleted successfully')
      setInvitationToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete invitation')
    } finally {
      setIsDeletingInvitation(false)
    }
  }

  function hasCohortWidePermission(userId: string, permission: PermissionType) {
    return (
      permissions?.some(
        (p) => p.userId === userId && p.permission === permission && p.startupId == null
      ) ?? false
    )
  }

  function scopedStartupIdsForPermission(userId: string, permission: PermissionType): string[] {
    return (
      permissions
        ?.filter((p) => p.userId === userId && p.permission === permission && p.startupId != null)
        .map((p) => p.startupId as string) ?? []
    )
  }

  async function handleToggleCohortWide(
    userId: string,
    permission: PermissionType,
    currentlyGranted: boolean
  ) {
    if (!cohort) return
    try {
      if (currentlyGranted) {
        await revokePermission({
          userId: userId as any,
          cohortId: cohort._id,
          permission,
        })
      } else {
        await grantPermission({
          userId: userId as any,
          cohortId: cohort._id,
          permission,
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update permission')
    }
  }

  async function handleToggleStartupScoped(
    userId: string,
    permission: PermissionType,
    startupId: string,
    currentlyGranted: boolean
  ) {
    if (!cohort) return
    try {
      if (currentlyGranted) {
        await revokePermission({
          userId: userId as any,
          cohortId: cohort._id,
          permission,
          startupId: startupId as any,
        })
      } else {
        await grantPermission({
          userId: userId as any,
          cohortId: cohort._id,
          permission,
          startupId: startupId as any,
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update permission')
    }
  }

  const isSuperAdmin = currentUser?.role === 'super_admin'

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
          <h1 className="text-3xl font-bold tracking-tight font-display">Cohort Not Found</h1>
          <p className="text-muted-foreground">The requested cohort could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Administrators</h1>
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
            <div className="border">
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
                    <TableRow
                      key={user._id}
                      className="cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
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
                          placeholder="14"
                          {...field}
                          value={field.value ?? ''}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? undefined : Number.parseInt(value, 10))
                          }}
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

          {/* Invitations Table (only pending/expired, not accepted) */}
          {invitations === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : invitations && invitations.filter((inv) => !inv.acceptedAt).length > 0 ? (
            <div className="border ">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations
                    .filter((inv) => !inv.acceptedAt)
                    .map((invitation) => {
                      const isExpired = new Date(invitation.expiresAt) < new Date()
                      const isPending = !isExpired

                      return (
                        <TableRow key={invitation._id}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>{invitation.invitedName || '-'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invitation.role === 'super_admin' ? 'destructive' : 'default'
                              }
                            >
                              {invitation.role === 'super_admin' ? 'Super Admin' : 'Admin'}
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResend(invitation._id)}
                                  disabled={resendingId === invitation._id}
                                >
                                  <RotateCw className="mr-1 h-3 w-3" />
                                  Resend
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInvitationToDelete(invitation)}
                                disabled={isDeletingInvitation}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>
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

      {/* Admin Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.fullName || selectedUser?.email || 'Admin Details'}
            </DialogTitle>
            <DialogDescription>
              View details and manage permissions for this admin.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedUser.fullName || 'No name set'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.email || 'No email'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <Badge
                    variant={selectedUser.role === 'super_admin' ? 'destructive' : 'default'}
                    className="mt-0.5"
                  >
                    {selectedUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(selectedUser._creationTime).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Permissions section */}
              {isSuperAdmin && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Permissions</p>
                  {selectedUser.role === 'super_admin' ? (
                    <Badge variant="secondary">All permissions</Badge>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Cohort-wide, non-scopable permissions */}
                      <div className="flex flex-col gap-2.5">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={hasCohortWidePermission(
                              selectedUser._id,
                              'send_announcements'
                            )}
                            onChange={() =>
                              handleToggleCohortWide(
                                selectedUser._id,
                                'send_announcements',
                                hasCohortWidePermission(selectedUser._id, 'send_announcements')
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          Send announcements
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={hasCohortWidePermission(
                              selectedUser._id,
                              'manage_notifications'
                            )}
                            onChange={() =>
                              handleToggleCohortWide(
                                selectedUser._id,
                                'manage_notifications',
                                hasCohortWidePermission(selectedUser._id, 'manage_notifications')
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          Manage notifications
                        </label>
                      </div>

                      {/* Scopable permissions: cohort-wide OR per-startup */}
                      {(['approve_milestones', 'approve_invoices'] as const).map((permission) => {
                        const cohortWide = hasCohortWidePermission(selectedUser._id, permission)
                        const scopedIds = scopedStartupIdsForPermission(
                          selectedUser._id,
                          permission
                        )
                        const label =
                          permission === 'approve_milestones'
                            ? 'Approve milestones'
                            : 'Approve invoices'
                        const triggerText = cohortWide
                          ? 'All startups'
                          : scopedIds.length === 0
                            ? 'No startups selected'
                            : scopedIds.length === 1
                              ? (startups?.find((s) => s._id === scopedIds[0])?.name ?? '1 startup')
                              : `${scopedIds.length} startups`
                        return (
                          <div key={permission} className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">{label}</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 min-w-[180px] justify-between font-normal"
                                >
                                  <span
                                    className={cn(
                                      'truncate text-xs',
                                      !cohortWide &&
                                        scopedIds.length === 0 &&
                                        'text-muted-foreground'
                                    )}
                                  >
                                    {triggerText}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[260px] p-0" align="end">
                                <Command>
                                  <CommandInput placeholder="Search startups…" className="h-9" />
                                  <CommandList className="max-h-[240px]">
                                    <CommandEmpty>No startups found.</CommandEmpty>
                                    <CommandGroup heading="Scope">
                                      <CommandItem
                                        onSelect={() =>
                                          handleToggleCohortWide(
                                            selectedUser._id,
                                            permission,
                                            cohortWide
                                          )
                                        }
                                      >
                                        <Check
                                          className={cn(
                                            'mr-2 h-4 w-4',
                                            cohortWide ? 'opacity-100' : 'opacity-0'
                                          )}
                                        />
                                        All startups in cohort
                                      </CommandItem>
                                    </CommandGroup>
                                    {!cohortWide && startups && startups.length > 0 && (
                                      <CommandGroup heading="Or specific startups">
                                        {startups.map((s) => {
                                          const granted = scopedIds.includes(s._id)
                                          return (
                                            <CommandItem
                                              key={s._id}
                                              value={s.name}
                                              onSelect={() =>
                                                handleToggleStartupScoped(
                                                  selectedUser._id,
                                                  permission,
                                                  s._id,
                                                  granted
                                                )
                                              }
                                            >
                                              <Check
                                                className={cn(
                                                  'mr-2 h-4 w-4',
                                                  granted ? 'opacity-100' : 'opacity-0'
                                                )}
                                              />
                                              {s.name}
                                            </CommandItem>
                                          )
                                        })}
                                      </CommandGroup>
                                    )}
                                    {startups === undefined && (
                                      <div className="py-6 text-center text-xs text-muted-foreground">
                                        Loading startups…
                                      </div>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedUser &&
              selectedUser.role === 'admin' &&
              selectedUser.cohortIds?.includes(cohort._id) && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDeleteClick(selectedUser)
                    setSelectedUser(null)
                  }}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove from Cohort
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Admin Confirmation Dialog */}
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

      {/* Delete Invitation Confirmation Dialog */}
      <Dialog
        open={!!invitationToDelete}
        onOpenChange={(open) => !open && setInvitationToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the invitation for{' '}
              <strong>
                {invitationToDelete?.invitedName || invitationToDelete?.email || 'this admin'}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInvitationToDelete(null)}
              disabled={isDeletingInvitation}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteInvitation}
              disabled={isDeletingInvitation}
            >
              {isDeletingInvitation ? 'Deleting...' : 'Delete Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
