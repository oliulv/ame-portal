'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Send, RefreshCw, UserCircle } from 'lucide-react'

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  expiresInDays: z.number().min(1).max(30),
})

type InviteFormData = z.infer<typeof inviteSchema>

export function TeamTab() {
  const teamMembers = useQuery(api.founderInvitations.listTeamMembers)
  const pendingInvitations = useQuery(api.founderInvitations.listPendingInvitations)
  const createInvitation = useMutation(api.founderInvitations.create)
  const resendInvitation = useMutation(api.founderInvitations.resend)

  const [isSending, setIsSending] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', fullName: '', expiresInDays: 14 },
  })

  const handleInvite = async (data: InviteFormData) => {
    setIsSending(true)
    try {
      await createInvitation({
        email: data.email,
        fullName: data.fullName,
        expiresInDays: data.expiresInDays,
      })
      toast.success('Invitation sent successfully')
      form.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setIsSending(false)
    }
  }

  const handleResend = async (id: string) => {
    setResendingId(id)
    try {
      await resendInvitation({ id: id as any })
      toast.success('Invitation resent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  const isLoading = teamMembers === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>People with access to your startup on Accelerate ME</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {teamMembers?.map((member) => (
              <div key={member._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <UserCircle className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.personalEmail}</p>
                </div>
                {member.isCurrentUser && (
                  <Badge variant="secondary" className="shrink-0">
                    You
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>Send an invitation to a co-founder or team member</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleInvite)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jane@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                    <FormDescription>1-30 days, default: 14</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSending}>
                  <Send className="mr-2 h-4 w-4" />
                  {isSending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations that haven't been accepted yet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv._id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires{' '}
                      {new Date(inv.expiresAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResend(inv._id)}
                    disabled={resendingId === inv._id}
                  >
                    <RefreshCw
                      className={`mr-2 h-3 w-3 ${resendingId === inv._id ? 'animate-spin' : ''}`}
                    />
                    Resend
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
