'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Megaphone, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { announcementSchema, type AnnouncementFormData } from '@/lib/schemas'

export default function AnnouncementsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const announcements = useQuery(
    api.announcements.listForAdmin,
    cohort ? { cohortId: cohort._id } : 'skip'
  )
  const sendAnnouncement = useMutation(api.announcements.send)

  const [showCompose, setShowCompose] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [pendingData, setPendingData] = useState<AnnouncementFormData | null>(null)

  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', body: '' },
  })

  const handleSubmit = (data: AnnouncementFormData) => {
    setPendingData(data)
    setShowConfirm(true)
  }

  const handleConfirmSend = async () => {
    if (!pendingData || !cohort) return

    setIsSending(true)
    try {
      await sendAnnouncement({
        cohortId: cohort._id,
        title: pendingData.title,
        body: pendingData.body,
      })
      toast.success('Announcement sent to all founders')
      setShowConfirm(false)
      setShowCompose(false)
      form.reset()
      setPendingData(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send announcement')
    } finally {
      setIsSending(false)
    }
  }

  if (cohort === undefined || announcements === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!cohort) {
    return <p className="text-muted-foreground">Cohort not found</p>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Announcements</h1>
          <p className="text-muted-foreground">
            Send announcements to all founders in {cohort.label}
          </p>
        </div>
        <Button onClick={() => setShowCompose(true)}>
          <Megaphone className="mr-2 h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>
              This will be sent to all founders in {cohort.label} via WhatsApp and shown in their
              dashboard.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Important update..." {...field} maxLength={100} />
                    </FormControl>
                    <FormDescription>{field.value.length}/100 characters</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your announcement..."
                        rows={5}
                        {...field}
                        maxLength={500}
                      />
                    </FormControl>
                    <FormDescription>{field.value.length}/500 characters</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCompose(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Send className="mr-2 h-4 w-4" />
                  Review &amp; Send
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Send</DialogTitle>
            <DialogDescription>
              This announcement will be sent to all founders in {cohort.label} via WhatsApp. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {pendingData && (
            <div className="border p-4 space-y-2 bg-muted/30">
              <p className="font-semibold">{pendingData.title}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {pendingData.body}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSend} disabled={isSending}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send to All Founders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Announcements History */}
      {announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="No announcements yet"
          description="Send your first announcement to notify all founders in this cohort."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>All announcements sent to {cohort.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Sent By</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {a.body}
                    </TableCell>
                    <TableCell>{a.senderName}</TableCell>
                    <TableCell>{a.recipientCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(a.sentAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
