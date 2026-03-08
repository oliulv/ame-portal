'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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

export default function CreateMilestonePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const cohortSlug = params.cohortSlug as string

  const isTemplateMode = searchParams.get('template') === 'true'
  const preselectedStartupSlug = searchParams.get('startup') || ''

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const startups = useQuery(api.startups.list, cohort ? { cohortId: cohort._id } : 'skip')

  const createMilestone = useMutation(api.milestones.create)
  const createTemplate = useMutation(api.milestoneTemplates.create)

  const [isTemplate, setIsTemplate] = useState(isTemplateMode)
  const [selectedStartupSlug, setSelectedStartupSlug] = useState(preselectedStartupSlug)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formStatus, setFormStatus] = useState<
    'waiting' | 'submitted' | 'approved' | 'changes_requested'
  >('waiting')
  const [formDueDate, setFormDueDate] = useState('')
  const [formRequireLink, setFormRequireLink] = useState(true)
  const [formRequireFile, setFormRequireFile] = useState(true)
  const [formIsActive, setFormIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const isLoading = cohort === undefined || startups === undefined

  if (isLoading) {
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

  if (!cohort) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Cohort not found"
        description="The selected cohort could not be found."
      />
    )
  }

  const selectedStartup = startups?.find((s) => (s.slug ?? s._id) === selectedStartupSlug)

  async function handleSave() {
    const amount = parseFloat(formAmount)
    if (!formTitle || !formDescription || isNaN(amount)) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!isTemplate && !selectedStartup) {
      toast.error('Please select a startup')
      return
    }

    setIsSaving(true)
    try {
      if (isTemplate) {
        await createTemplate({
          cohortId: cohort!._id,
          title: formTitle,
          description: formDescription,
          amount,
          dueDate: formDueDate || undefined,
          isActive: formIsActive,
          requireLink: formRequireLink,
          requireFile: formRequireFile,
        })
        toast.success(
          formIsActive
            ? 'Template created and milestones assigned to existing startups'
            : 'Template created'
        )
        router.push(`/admin/${cohortSlug}/milestones?tab=templates`)
      } else {
        const milestoneId = await createMilestone({
          startupId: selectedStartup!._id,
          title: formTitle,
          description: formDescription,
          amount,
          status: formStatus,
          dueDate: formDueDate || undefined,
          requireLink: formRequireLink,
          requireFile: formRequireFile,
        })
        toast.success('Milestone created')
        router.push(`/admin/${cohortSlug}/milestones/${milestoneId}`)
      }
    } catch (error) {
      logClientError('Failed to create:', error)
      toast.error(isTemplate ? 'Failed to create template' : 'Failed to create milestone')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link href={`/admin/${cohortSlug}/milestones`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Milestones
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight font-display">
          {isTemplate ? 'Create Milestone Template' : 'Create Milestone'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isTemplate ? 'Template Details' : 'Milestone Details'}</CardTitle>
          <CardDescription>
            {isTemplate
              ? 'Active templates are auto-assigned to all startups in the cohort.'
              : 'Add a new milestone for a startup.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Save as template toggle */}
          <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
            <Switch id="template-toggle" checked={isTemplate} onCheckedChange={setIsTemplate} />
            <Label htmlFor="template-toggle" className="font-medium">
              Save as template
            </Label>
            <p className="text-xs text-muted-foreground">
              Templates apply to all startups in the cohort
            </p>
          </div>

          {/* Startup selector (only for milestones, not templates) */}
          {!isTemplate && (
            <div className="space-y-2">
              <Label htmlFor="ms-startup">Startup</Label>
              <Select value={selectedStartupSlug} onValueChange={setSelectedStartupSlug}>
                <SelectTrigger id="ms-startup">
                  <SelectValue placeholder="Select a startup" />
                </SelectTrigger>
                <SelectContent>
                  {startups?.map((s) => (
                    <SelectItem key={s._id} value={s.slug ?? s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {!isTemplate ? (
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="ms-due">Due Date (optional)</Label>
                <Input
                  id="ms-due"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {!isTemplate && (
            <div className="space-y-2">
              <Label htmlFor="ms-due-m">Due Date (optional)</Label>
              <Input
                id="ms-due-m"
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </div>
          )}

          {isTemplate && (
            <div className="flex items-center gap-2">
              <Switch id="tpl-active" checked={formIsActive} onCheckedChange={setFormIsActive} />
              <Label htmlFor="tpl-active">Active (auto-assign to all startups in cohort)</Label>
            </div>
          )}

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
            <Link href={`/admin/${cohortSlug}/milestones`}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Creating...' : isTemplate ? 'Create Template' : 'Create Milestone'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
