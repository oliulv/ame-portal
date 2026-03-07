'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Edit,
  UserPlus,
  Target,
  Users,
  Mail,
  ExternalLink,
  Plug,
  RotateCw,
  Trash2,
  Send,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'

export default function StartupDetailPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const slug = params.slug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const startup = useQuery(api.startups.getBySlug, { slug })
  const milestones = useQuery(
    api.milestones.listByStartup,
    startup ? { startupId: startup._id } : 'skip'
  )
  const teamData = useQuery(
    api.invitations.listTeamAndPending,
    startup ? { startupId: startup._id } : 'skip'
  )
  const startupProfile = useQuery(
    api.startups.getProfileByStartupId,
    startup ? { startupId: startup._id } : 'skip'
  )
  const founderProfiles = useQuery(
    api.startups.getFounderProfilesByStartupId,
    startup ? { startupId: startup._id } : 'skip'
  )

  const createInvitation = useMutation(api.invitations.create)
  const resendInvitation = useMutation(api.invitations.resend)
  const removeFounder = useMutation(api.invitations.removeFounder)
  const removeTeamMember = useMutation(api.invitations.removeTeamMember)

  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteFullName, setInviteFullName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleInvite() {
    if (!inviteFullName.trim() || !inviteEmail.trim() || !startup) return
    const expiresInDays = Number.parseInt(inviteExpiresInDays, 10)
    if (Number.isNaN(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
      toast.error('Expires In must be between 1 and 30 days')
      return
    }

    setIsInviting(true)
    try {
      await createInvitation({
        startupId: startup._id,
        email: inviteEmail.trim(),
        fullName: inviteFullName.trim(),
        expiresInDays,
        appUrl: window.location.origin,
      })
      toast.success('Invitation sent successfully')
      setShowInviteDialog(false)
      setInviteFullName('')
      setInviteEmail('')
      setInviteExpiresInDays('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  async function handleResend(invitationId: string) {
    setResendingId(invitationId)
    try {
      await resendInvitation({ id: invitationId as any, appUrl: window.location.origin })
      toast.success('Invitation resent')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  async function handleRemoveTeamMember(profileId: string, name: string) {
    if (!confirm(`Remove ${name}? This deletes their founder profile and invitation.`)) return
    setRemovingId(profileId)
    try {
      await removeTeamMember({ id: profileId as any })
      toast.success(`${name} removed`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove founder')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleCancelInvitation(invitationId: string, name: string) {
    if (!confirm(`Cancel invitation for ${name}?`)) return
    setRemovingId(invitationId)
    try {
      await removeFounder({ id: invitationId as any })
      toast.success(`Invitation for ${name} cancelled`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel invitation')
    } finally {
      setRemovingId(null)
    }
  }

  // Loading state
  if (startup === undefined || cohort === undefined) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-9 w-36" />
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-9 w-64" />
              <Skeleton className="mt-1 h-5 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Not found
  if (startup === null || cohort === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h1 className="text-2xl font-bold font-display">Startup not found</h1>
        <p className="mt-2 text-muted-foreground">
          The startup you are looking for does not exist or does not belong to this cohort.
        </p>
        <Link href={`/admin/${cohortSlug}/startups`} className="mt-4">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startups
          </Button>
        </Link>
      </div>
    )
  }

  const potential = milestones?.reduce((sum, m) => sum + m.amount, 0) ?? 0
  const unlocked =
    milestones?.filter((m) => m.status === 'approved').reduce((sum, m) => sum + m.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <Link href={`/admin/${cohortSlug}/startups`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Startups
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{startup.name}</h1>
            <p className="text-muted-foreground">{cohort?.label || 'No cohort'}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/${cohortSlug}/startups/${slug}/analytics`}>
              <Button variant="outline">
                <Plug className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </Link>
            <Button variant="default" onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Founder
            </Button>
            <Link href={`/admin/${cohortSlug}/startups/${slug}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Funding</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">
              {'\u00A3'}
              {potential.toLocaleString('en-GB')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unlocked</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-green-600">
              {'\u00A3'}
              {unlocked.toLocaleString('en-GB')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Founders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">
              {teamData?.teamMembers.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">
              {teamData?.pendingInvitations.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Startup Details */}
      <Card>
        <CardHeader>
          <CardTitle>Startup Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {startupProfile?.oneLiner && (
            <div className="md:col-span-2">
              <span className="text-sm font-medium text-muted-foreground">One Liner</span>
              <p className="mt-1">{startupProfile.oneLiner}</p>
            </div>
          )}
          {startupProfile?.description && (
            <div className="md:col-span-2">
              <span className="text-sm font-medium text-muted-foreground">Description</span>
              <p className="mt-1 text-sm whitespace-pre-wrap">{startupProfile.description}</p>
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-muted-foreground">Sector</span>
            <p className="mt-1">{startupProfile?.industry || startup.sector || '-'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Location</span>
            <p className="mt-1">{startupProfile?.location || '-'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Website</span>
            <p className="mt-1">
              {startupProfile?.companyUrl || startup.websiteUrl ? (
                <a
                  href={startupProfile?.companyUrl || startup.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  {startupProfile?.companyUrl || startup.websiteUrl}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              ) : (
                '-'
              )}
            </p>
          </div>
          {startupProfile?.productUrl && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">Product URL</span>
              <p className="mt-1">
                <a
                  href={startupProfile.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  {startupProfile.productUrl}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </p>
            </div>
          )}
          {startupProfile?.initialCustomers !== undefined &&
            startupProfile.initialCustomers !== null && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Initial Customers</span>
                <p className="mt-1">{startupProfile.initialCustomers.toLocaleString('en-GB')}</p>
              </div>
            )}
          {startupProfile?.initialRevenue !== undefined &&
            startupProfile.initialRevenue !== null && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Initial Revenue</span>
                <p className="mt-1">
                  {'\u00A3'}
                  {startupProfile.initialRevenue.toLocaleString('en-GB')}
                </p>
              </div>
            )}
          {startup.notes && (
            <div className="md:col-span-2 border-t pt-4">
              <span className="text-sm font-medium text-muted-foreground">Internal Notes</span>
              <p className="mt-1 text-sm">{startup.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Founder Profiles */}
      {founderProfiles && founderProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Founder Profiles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {founderProfiles.map((fp) => (
              <div key={fp._id} className="border p-4 space-y-2">
                <p className="font-medium">{fp.fullName}</p>
                {fp.bio && <p className="text-sm text-muted-foreground">{fp.bio}</p>}
                <div className="grid gap-1 text-sm">
                  {fp.linkedinUrl && (
                    <a
                      href={fp.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center"
                    >
                      LinkedIn
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                  {fp.xUrl && (
                    <a
                      href={fp.xUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center"
                    >
                      X / Twitter
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                  {(fp.city || fp.country) && (
                    <p className="text-muted-foreground">
                      {[fp.city, fp.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {fp.phone && <p className="text-muted-foreground">{fp.phone}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Founders & Invitations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Founders & Invitations</CardTitle>
              <CardDescription>Team members and pending invitations</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Founder
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Team Members */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Team Members</h3>
            {teamData?.teamMembers && teamData.teamMembers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamData.teamMembers.map((member) => (
                    <TableRow key={member._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {member.imageUrl ? (
                            <Image
                              src={member.imageUrl}
                              alt={member.fullName}
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                              {member.fullName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          {member.fullName}
                        </div>
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTeamMember(member._id, member.fullName)}
                          disabled={removingId === member._id}
                          title="Remove founder"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No team members yet</p>
            )}
          </div>

          {/* Pending Invitations */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Pending Invitations</h3>
            {teamData?.pendingInvitations && teamData.pendingInvitations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamData.pendingInvitations.map((invitation) => (
                    <TableRow key={invitation._id}>
                      <TableCell className="font-medium">{invitation.fullName}</TableCell>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(invitation.expiresAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResend(invitation._id)}
                            disabled={resendingId === invitation._id}
                          >
                            <RotateCw
                              className={`h-4 w-4 mr-1 ${resendingId === invitation._id ? 'animate-spin' : ''}`}
                            />
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleCancelInvitation(invitation._id, invitation.fullName)
                            }
                            disabled={removingId === invitation._id}
                            title="Cancel invitation"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No pending invitations
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Milestones summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Milestones</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {milestones && milestones.length > 0 ? (
            <>
              <div className="space-y-2">
                {[...milestones].reverse().map((milestone) => (
                  <div key={milestone._id} className="flex items-center gap-3  border px-3 py-2.5">
                    <div className="flex-shrink-0">
                      {milestone.status === 'approved' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : milestone.status === 'submitted' ? (
                        <Clock className="h-4 w-4 text-amber-600" />
                      ) : milestone.status === 'changes_requested' ? (
                        <RotateCw className="h-4 w-4 text-orange-600" />
                      ) : (
                        <Send className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{milestone.title}</p>
                        <Badge
                          variant={
                            milestone.status === 'approved'
                              ? 'success'
                              : milestone.status === 'submitted' ||
                                  milestone.status === 'changes_requested'
                                ? 'warning'
                                : 'secondary'
                          }
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {milestone.status === 'changes_requested'
                            ? 'changes requested'
                            : milestone.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {'\u00A3'}
                        {milestone.amount.toLocaleString('en-GB')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href={`/admin/${cohortSlug}/funding/${slug}`} className="mt-3 inline-block">
                <Button variant="link" size="sm" className="h-auto p-0">
                  Manage milestones →
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3  border px-3 py-2.5">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">No milestones</p>
                    <p className="text-xs text-muted-foreground">No milestones assigned yet.</p>
                  </div>
                </div>
              </div>
              <Link href={`/admin/${cohortSlug}/funding/${slug}`} className="mt-3 inline-block">
                <Button variant="link" size="sm" className="h-auto p-0">
                  Manage milestones →
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invite Founder Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Founder</DialogTitle>
            <DialogDescription>
              Send an invitation to join {startup.name} as a founder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input
                id="invite-name"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-expires">Expires In (Days)</Label>
              <Input
                id="invite-expires"
                type="number"
                min={1}
                max={30}
                placeholder="14"
                value={inviteExpiresInDays}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setInviteExpiresInDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">1-30 days, default: 14</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteDialog(false)
                setInviteFullName('')
                setInviteEmail('')
                setInviteExpiresInDays('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isInviting || !inviteFullName.trim() || !inviteEmail.trim()}
            >
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
