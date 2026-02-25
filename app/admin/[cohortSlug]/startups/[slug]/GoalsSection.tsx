'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Edit, Trash2 } from 'lucide-react'

const goalUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.enum(['launch', 'revenue', 'users', 'product', 'fundraising', 'growth', 'hiring']),
  targetValue: z.number().optional(),
  deadline: z.string().optional(),
  weight: z.number().min(0).optional(),
  fundingAmount: z.number().min(0).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  progressValue: z.number().min(0).max(100).optional(),
})

type GoalUpdateFormData = z.infer<typeof goalUpdateSchema>

type Goal = Doc<'startupGoals'> & { templateSortOrder: number | null }

interface GoalsSectionProps {
  goals: Goal[]
}

export function GoalsSection({ goals }: GoalsSectionProps) {
  const updateGoal = useMutation(api.startupGoals.update)
  const removeGoal = useMutation(api.startupGoals.remove)

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [deletingGoalId, setDeletingGoalId] = useState<Id<'startupGoals'> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<GoalUpdateFormData>({
    resolver: zodResolver(goalUpdateSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'launch',
      targetValue: undefined,
      deadline: '',
      weight: 1,
      fundingAmount: undefined,
      status: 'not_started',
      progressValue: 0,
    },
  })

  const handleEditClick = (goal: Goal) => {
    setEditingGoal(goal)
    const formStatus = goal.status === 'waived' ? 'not_started' : goal.status
    const validCategories = [
      'launch',
      'revenue',
      'users',
      'product',
      'fundraising',
      'growth',
      'hiring',
    ] as const
    const category =
      goal.category && validCategories.includes(goal.category as (typeof validCategories)[number])
        ? (goal.category as (typeof validCategories)[number])
        : 'launch'
    form.reset({
      title: goal.title,
      description: goal.description || '',
      category,
      targetValue: goal.targetValue || undefined,
      deadline: goal.deadline || '',
      weight: goal.weight || 1,
      fundingAmount: goal.fundingAmount || undefined,
      status: formStatus as 'not_started' | 'in_progress' | 'completed',
      progressValue: goal.progressValue || 0,
    })
    setError(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingGoalId) return

    try {
      await removeGoal({ id: deletingGoalId })
      setDeletingGoalId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const onSubmit = async (data: GoalUpdateFormData) => {
    if (!editingGoal) return

    setIsSubmitting(true)
    setError(null)

    try {
      await updateGoal({
        id: editingGoal._id,
        title: data.title,
        description: data.description,
        category: data.category,
        targetValue: data.targetValue,
        deadline: data.deadline,
        weight: data.weight,
        fundingAmount: data.fundingAmount,
        status: data.status,
        progressValue: data.progressValue,
      })
      setEditingGoal(null)
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <CardDescription>Assigned goals and progress</CardDescription>
        </CardHeader>
        <CardContent>
          {goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div
                  key={goal._id}
                  className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{goal.title}</span>
                      <Badge variant="outline" className="capitalize">
                        {goal.category}
                      </Badge>
                      <Badge
                        variant={
                          goal.status === 'completed'
                            ? 'success'
                            : goal.status === 'in_progress'
                              ? 'info'
                              : 'secondary'
                        }
                      >
                        {goal.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                    )}
                    {goal.targetValue && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Target: {goal.targetValue}
                      </p>
                    )}
                    {goal.deadline && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Deadline:{' '}
                        {new Date(goal.deadline).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {goal.fundingAmount && (
                      <div className="text-right mr-4">
                        <div className="text-sm font-medium">
                          £{goal.fundingAmount.toLocaleString('en-GB')}
                        </div>
                        <div className="text-xs text-muted-foreground">Funding</div>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(goal)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeletingGoalId(goal._id)
                        setError(null)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No goals assigned yet</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Goal Dialog */}
      <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>Update the goal details for this startup</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Goal title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Goal description"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="launch">Launch</SelectItem>
                          <SelectItem value="revenue">Revenue</SelectItem>
                          <SelectItem value="users">Users</SelectItem>
                          <SelectItem value="product">Product</SelectItem>
                          <SelectItem value="fundraising">Fundraising</SelectItem>
                          <SelectItem value="growth">Growth</SelectItem>
                          <SelectItem value="hiring">Hiring</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Target value"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="progressValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progress (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0-100"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={
                            field.value ? new Date(field.value).toISOString().split('T')[0] : ''
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? new Date(e.target.value).toISOString() : ''
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fundingAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funding Amount (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="1"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : 1)
                        }
                      />
                    </FormControl>
                    <FormDescription>Relative importance of this goal</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingGoal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingGoalId} onOpenChange={(open) => !open && setDeletingGoalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this goal? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingGoalId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
