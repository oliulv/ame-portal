'use client'

import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { invitationSchema, type InvitationFormData } from '@/lib/schemas'
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface InviteFounderPageProps {
  params: Promise<{
    slug: string
  }>
}

interface Invitation {
  id: string
  full_name: string
  personal_email: string
  status: string
  created_at: string
  expires_at: string
}

export default function InviteFounderPage({ params }: InviteFounderPageProps) {
  const router = useRouter()
  const [startupSlug, setStartupSlug] = useState<string | null>(null)
  const [startupId, setStartupId] = useState<string | null>(null)
  const [startupName, setStartupName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [resendingId, setResendingId] = useState<string | null>(null)

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      startup_id: '',
      full_name: '',
      personal_email: '',
    },
  })

  // Load startup and invitations
  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params
      setStartupSlug(resolvedParams.slug)

      try {
        // Fetch startup by slug
        const startupResponse = await fetch(`/api/admin/startups/${resolvedParams.slug}`)
        if (startupResponse.ok) {
          const startup = await startupResponse.json()
          setStartupId(startup.id)
          setStartupName(startup.name)
          form.setValue('startup_id', startup.id)
        }

        // Note: We'd need a separate endpoint to fetch invitations by startup_id
        // For now, we'll set empty array
        setInvitations([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [params, form])

  async function onSubmit(data: InvitationFormData) {
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send invitation')
      }

      setSuccessMessage(`Invitation sent successfully to ${data.personal_email}`)

      // Reset form
      form.reset({
        startup_id: data.startup_id,
        full_name: '',
        personal_email: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend(invitationId: string) {
    setResendingId(invitationId)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to resend invitation')
      }

      setSuccessMessage('Invitation resent successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="mb-6 h-10 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Link href={`/admin/startups/${startupSlug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startup
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Invitation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Invite Founder</CardTitle>
            <CardDescription>
              Send an invitation email to a founder to join {startupName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
                {successMessage}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John Smith"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The founder's full name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="personal_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="founder@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The email address where the invitation will be sent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                  </Button>
                  <Link href={`/admin/startups/${startupSlug}`}>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Existing Invitations */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Invitations</CardTitle>
            <CardDescription>
              View and manage invitations for this startup
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => {
                    const isExpired = new Date(invitation.expires_at) < new Date()
                    const canResend = invitation.status !== 'accepted'

                    return (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.full_name}</TableCell>
                        <TableCell>{invitation.personal_email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invitation.status === 'accepted'
                                ? 'success'
                                : invitation.status === 'sent'
                                ? 'info'
                                : invitation.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {invitation.status}
                          </Badge>
                          {isExpired && invitation.status !== 'accepted' && (
                            <Badge variant="destructive" className="ml-2">
                              Expired
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {canResend && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResend(invitation.id)}
                              disabled={resendingId === invitation.id}
                            >
                              <RefreshCw
                                className={`mr-2 h-3 w-3 ${
                                  resendingId === invitation.id ? 'animate-spin' : ''
                                }`}
                              />
                              Resend
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No invitations sent yet. Send your first invitation above.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
