'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ArrowLeft, Target } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

export default function EditMilestonePage() {
  const params = useParams<{ cohortSlug: string; id: string }>()
  const router = useRouter()
  const cohortSlug = params.cohortSlug
  const milestoneId = params.id as Id<'milestones'>

  const milestone = useQuery(api.milestones.getForAdmin, { id: milestoneId })
  const updateMilestone = useMutation(api.milestones.update)

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formStatus, setFormStatus] = useState<
    'waiting' | 'submitted' | 'approved' | 'changes_requested'
  >('waiting')
  const [formDueDate, setFormDueDate] = useState('')
  const [formRequireLink, setFormRequireLink] = useState(true)
  const [formRequireFile, setFormRequireFile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (milestone && !initialized) {
      setFormTitle(milestone.title)
      setFormDescription(milestone.description)
      setFormAmount(String(milestone.amount))
      setFormStatus(milestone.status)
      setFormDueDate(milestone.dueDate ?? '')
      setFormRequireLink(milestone.requireLink !== false)
      setFormRequireFile(milestone.requireFile !== false)
      setInitialized(true)
    }
  }, [milestone, initialized])

  if (milestone === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!milestone) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Milestone not found"
        description="This milestone does not exist or you do not have access to it."
        action={
          <Link href={`/admin/${cohortSlug}/milestones`}>
            <Button variant="outline">Back to Milestones</Button>
          </Link>
        }
      />
    )
  }

  async function handleSave() {
    const amount = parseFloat(formAmount)
    if (!formTitle || !formDescription || isNaN(amount)) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    try {
      await updateMilestone({
        id: milestoneId,
        title: formTitle,
        description: formDescription,
        amount,
        status: formStatus,
        dueDate: formDueDate || undefined,
        requireLink: formRequireLink,
        requireFile: formRequireFile,
      })
      toast.success('Milestone updated')
      router.push(`/admin/${cohortSlug}/milestones/${milestoneId}`)
    } catch (error) {
      logClientError('Failed to update milestone:', error)
      toast.error('Failed to update milestone')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link href={`/admin/${cohortSlug}/milestones/${milestoneId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Milestone
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Edit Milestone</h1>
          <p className="text-muted-foreground">
            {milestone.startupName} &mdash; {milestone.title}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Milestone Details</CardTitle>
          <CardDescription>
            Startup: <span className="font-medium text-foreground">{milestone.startupName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="ms-title">Title</Label>
            <Input
              id="ms-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Launch MVP"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ms-desc">Description</Label>
            <Textarea
              id="ms-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder='What "done" looks like'
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ms-amount">Amount (GBP)</Label>
              <Input
                id="ms-amount"
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ms-status">Status</Label>
              <Select
                value={formStatus}
                onValueChange={(v) => setFormStatus(v as typeof formStatus)}
              >
                <SelectTrigger id="ms-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="changes_requested">Changes Requested</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ms-due">Due Date (optional)</Label>
            <Input
              id="ms-due"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Submission requirements</Label>
            <div className="flex items-center gap-2">
              <Switch
                id="ms-req-link"
                checked={formRequireLink}
                onCheckedChange={setFormRequireLink}
              />
              <Label htmlFor="ms-req-link" className="font-normal">
                Accept link submission
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ms-req-file"
                checked={formRequireFile}
                onCheckedChange={setFormRequireFile}
              />
              <Label htmlFor="ms-req-file" className="font-normal">
                Accept file upload
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link href={`/admin/${cohortSlug}/milestones/${milestoneId}`}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
