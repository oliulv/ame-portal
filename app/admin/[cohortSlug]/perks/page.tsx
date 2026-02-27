'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Edit, Trash2, Gift } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

type PerkWithCount = {
  _id: Id<'perks'>
  _creationTime: number
  title: string
  description: string
  details?: string
  category?: string
  providerName?: string
  providerLogoUrl?: string
  url?: string
  isActive: boolean
  sortOrder: number
  claimCount: number
}

export default function AdminPerksPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const perks = useQuery(api.perks.list) as PerkWithCount[] | undefined

  const createPerk = useMutation(api.perks.create)
  const updatePerk = useMutation(api.perks.update)
  const removePerk = useMutation(api.perks.remove)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPerk, setEditingPerk] = useState<PerkWithCount | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDetails, setFormDetails] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formProviderName, setFormProviderName] = useState('')
  const [formProviderLogoUrl, setFormProviderLogoUrl] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const isLoading = perks === undefined

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

  function resetForm() {
    setFormTitle('')
    setFormDescription('')
    setFormDetails('')
    setFormCategory('')
    setFormProviderName('')
    setFormProviderLogoUrl('')
    setFormUrl('')
    setFormIsActive(true)
  }

  function openCreate() {
    resetForm()
    setIsCreateOpen(true)
  }

  function openEdit(perk: PerkWithCount) {
    setFormTitle(perk.title)
    setFormDescription(perk.description)
    setFormDetails(perk.details ?? '')
    setFormCategory(perk.category ?? '')
    setFormProviderName(perk.providerName ?? '')
    setFormProviderLogoUrl(perk.providerLogoUrl ?? '')
    setFormUrl(perk.url ?? '')
    setFormIsActive(perk.isActive)
    setEditingPerk(perk)
  }

  async function handleSave() {
    if (!formTitle || !formDescription) {
      toast.error('Please fill in title and description')
      return
    }

    setIsSaving(true)
    try {
      if (editingPerk) {
        await updatePerk({
          id: editingPerk._id,
          title: formTitle,
          description: formDescription,
          details: formDetails || undefined,
          category: formCategory || undefined,
          providerName: formProviderName || undefined,
          providerLogoUrl: formProviderLogoUrl || undefined,
          url: formUrl || undefined,
          isActive: formIsActive,
        })
        toast.success('Perk updated')
        setEditingPerk(null)
      } else {
        await createPerk({
          title: formTitle,
          description: formDescription,
          details: formDetails || undefined,
          category: formCategory || undefined,
          providerName: formProviderName || undefined,
          providerLogoUrl: formProviderLogoUrl || undefined,
          url: formUrl || undefined,
          isActive: formIsActive,
        })
        toast.success('Perk created')
        setIsCreateOpen(false)
      }
      resetForm()
    } catch (error) {
      logClientError('Failed to save perk:', error)
      toast.error('Failed to save perk')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: Id<'perks'>) {
    if (!confirm('Are you sure you want to delete this perk? All claims will also be deleted.'))
      return
    try {
      await removePerk({ id })
      toast.success('Perk deleted')
    } catch (error) {
      logClientError('Failed to delete perk:', error)
      toast.error('Failed to delete perk')
    }
  }

  const perkFormDialog = (
    <Dialog
      open={isCreateOpen || !!editingPerk}
      onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setEditingPerk(null)
          resetForm()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingPerk ? 'Edit Perk' : 'Add Perk'}</DialogTitle>
          <DialogDescription>
            {editingPerk ? 'Update perk details.' : 'Add a new perk or partner deal for founders.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="perk-title">Title</Label>
            <Input
              id="perk-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. $5,000 AWS Credits"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perk-desc">Description</Label>
            <Textarea
              id="perk-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Short description for the card"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perk-details">Details (optional)</Label>
            <Textarea
              id="perk-details"
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
              placeholder="Full details shown in expanded view"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perk-category">Category</Label>
              <Input
                id="perk-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. Cloud, Legal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perk-provider">Provider Name</Label>
              <Input
                id="perk-provider"
                value={formProviderName}
                onChange={(e) => setFormProviderName(e.target.value)}
                placeholder="e.g. AWS, Stripe"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="perk-logo">Provider Logo URL (optional)</Label>
            <Input
              id="perk-logo"
              value={formProviderLogoUrl}
              onChange={(e) => setFormProviderLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perk-url">Redemption URL (optional)</Label>
            <Input
              id="perk-url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="perk-active" checked={formIsActive} onCheckedChange={setFormIsActive} />
            <Label htmlFor="perk-active">Active (visible to founders)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false)
              setEditingPerk(null)
              resetForm()
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : editingPerk ? 'Save Changes' : 'Add Perk'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Perks</h1>
          <p className="text-muted-foreground">Partner deals and perks for founders</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Perk
        </Button>
      </div>

      {/* Perks table */}
      <Card>
        <CardHeader>
          <CardTitle>Perks</CardTitle>
          <CardDescription>Manage perks available to all founders.</CardDescription>
        </CardHeader>
        <CardContent>
          {perks && perks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perks.map((perk) => (
                  <TableRow key={perk._id}>
                    <TableCell className="font-medium">{perk.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {perk.providerName ?? '—'}
                    </TableCell>
                    <TableCell>
                      {perk.category ? (
                        <div className="flex flex-wrap gap-1">
                          {perk.category.split(',').map((cat) => (
                            <Badge key={cat.trim()} variant="outline">
                              {cat.trim()}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={perk.isActive ? 'success' : 'secondary'}>
                        {perk.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/${cohortSlug}/perks/${perk._id}`}>
                        <Button variant="ghost" size="sm" className="gap-1">
                          {perk.claimCount}
                          <span className="text-muted-foreground">claimed</span>
                        </Button>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(perk)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(perk._id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              noCard
              icon={<Gift className="h-6 w-6" />}
              title="No perks yet"
              description="Add perks and partner deals that founders can claim."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Perk
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {perkFormDialog}
    </div>
  )
}
