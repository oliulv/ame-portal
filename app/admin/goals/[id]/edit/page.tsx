'use client'

import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { goalTemplateSchema, type GoalTemplateFormData } from '@/lib/schemas'
import {
  extractConditionsFromDescription,
  formatDescriptionWithConditions,
} from '@/lib/goalUtils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

const GOAL_CATEGORIES = [
  { value: 'launch', label: 'Launch' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'users', label: 'Users/Traffic' },
  { value: 'product', label: 'Product' },
  { value: 'fundraising', label: 'Fundraising' },
] as const

interface GoalEditPageProps {
  params: Promise<{
    id: string
  }>
}

export default function GoalEditPage({ params }: GoalEditPageProps) {
  const router = useRouter()
  const [goalId, setGoalId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unwrap params
  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params
      setGoalId(resolvedParams.id)
    }
    loadParams()
  }, [params])

  const goal = useQuery(
    api.goalTemplates.getById,
    goalId ? { id: goalId as Id<'goalTemplates'> } : 'skip'
  )

  // Look up the cohort for display purposes
  const cohort = useQuery(
    api.cohorts.getBySlug,
    // We don't have a slug here, so we skip this query.
    // The cohort info will be shown from the goal's cohortId if available.
    'skip'
  )

  const updateGoalMutation = useMutation(api.goalTemplates.update)

  const form = useForm<GoalTemplateFormData>({
    resolver: zodResolver(goalTemplateSchema),
    defaultValues: {
      cohortId: '',
      title: '',
      description: '',
      category: 'launch',
      deadline: undefined,
      isActive: true,
      conditions: [
        {
          dataSource: 'stripe',
          metric: '',
          operator: '>=',
          targetValue: undefined,
          unit: '',
        },
      ],
      fundingUnlocked: undefined,
    },
  })

  // Reset form when goal data loads
  useEffect(() => {
    if (goal) {
      const { cleanDescription, conditions } = extractConditionsFromDescription(goal.description)

      // Parse category - handle both old and new categories
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
        cohortId: goal.cohortId,
        title: goal.title,
        description: cleanDescription,
        category,
        deadline: goal.defaultDeadline || undefined,
        isActive: goal.isActive,
        conditions: conditions || [
          {
            dataSource: 'stripe' as const,
            metric: '',
            operator: '>=' as const,
            targetValue: goal.defaultTargetValue || undefined,
            unit: '',
          },
        ],
        fundingUnlocked: goal.defaultFundingAmount || undefined,
      })
    }
  }, [goal, form])

  async function onSubmit(data: GoalTemplateFormData) {
    if (!goalId || !goal) return

    setIsSubmitting(true)
    setError(null)
    try {
      const description = data.conditions
        ? formatDescriptionWithConditions(data.description, data.conditions)
        : data.description

      await updateGoalMutation({
        id: goalId as Id<'goalTemplates'>,
        cohortId: goal.cohortId,
        title: data.title,
        description,
        category: data.category,
        defaultDeadline: data.deadline,
        isActive: data.isActive,
        defaultFundingAmount: data.fundingUnlocked,
        defaultTargetValue: data.conditions?.[0]?.targetValue,
      })
      toast.success('Goal template updated successfully')
      router.push('/admin/goals')
    } catch (err) {
      console.error('Failed to update goal template:', err)
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (goal === undefined || !goalId) {
    return (
      <div className="container max-w-2xl py-8">
        <Skeleton className="mb-6 h-10 w-32" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (goal === null) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="mb-6">
          <Link href="/admin/goals">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Goal Templates
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-destructive">Goal template not found</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link href="/admin/goals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Goal Templates
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Goal Template</CardTitle>
          <CardDescription>Update goal template information</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {goal && (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm font-medium">Cohort</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Goal Template ID: {goal._id}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    This goal template belongs to the cohort shown above. The cohort cannot be
                    changed after creation.
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Launch MVP" {...field} />
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
                        placeholder="Detailed description of the goal..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GOAL_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deadline (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          field.onChange(
                            e.target.value ? new Date(e.target.value).toISOString() : undefined
                          )
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fundingUnlocked"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Funding Unlocked on Completion (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 5000"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value === '' ? undefined : parseFloat(value))
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Amount in GBP that this goal contributes when marked as completed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Active templates are assigned to new startups
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Link href="/admin/goals">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
