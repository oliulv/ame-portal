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
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

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
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cohorts, setCohorts] = useState<Array<{ id: string; label: string }>>([])

  const form = useForm<GoalTemplateFormData>({
    resolver: zodResolver(goalTemplateSchema),
    defaultValues: {
      cohort_id: '',
      title: '',
      description: '',
      category: 'launch',
      default_target_value: undefined,
      default_deadline: undefined,
      default_weight: undefined,
      default_funding_amount: undefined,
      is_active: true,
    },
  })

  // Fetch goal template data and cohorts
  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params
      setGoalId(resolvedParams.id)

      try {
        // Fetch cohorts for dropdown
        const cohortsResponse = await fetch('/api/admin/cohorts')
        if (cohortsResponse.ok) {
          const cohortsData = await cohortsResponse.json()
          setCohorts(cohortsData)
        }

        // Fetch goal template
        const goalResponse = await fetch(`/api/admin/goals/${resolvedParams.id}`)
        if (!goalResponse.ok) {
          throw new Error('Failed to load goal template')
        }

        const goal = await goalResponse.json()
        form.reset({
          cohort_id: goal.cohort_id,
          title: goal.title,
          description: goal.description,
          category: goal.category,
          default_target_value: goal.default_target_value,
          default_deadline: goal.default_deadline,
          default_weight: goal.default_weight,
          default_funding_amount: goal.default_funding_amount,
          is_active: goal.is_active,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load goal template')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [params, form])

  async function onSubmit(data: GoalTemplateFormData) {
    if (!goalId) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/goals/${goalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update goal template')
      }

      // Success! Redirect to goals list
      router.push('/admin/goals')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
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
          <CardDescription>
            Update goal template information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="cohort_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cohort</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a cohort" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cohorts.map((cohort) => (
                          <SelectItem key={cohort.id} value={cohort.id}>
                            {cohort.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This goal template will apply to new startups in this cohort
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Launch MVP"
                        {...field}
                      />
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="default_target_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target (Number, Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 100"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? undefined : parseFloat(value))
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the numeric target for this goal (e.g., 100 for £100 revenue, 50 for 50 users). Units come from the goal title/description.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority (1-10, Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          placeholder="1-10"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? undefined : parseInt(value))
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Importance from 1–10 (1–3 = low, 4–7 = medium, 8–10 = high). Higher priority goals can count more in scoring later.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="default_deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Deadline (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_funding_amount"
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
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Active templates are assigned to new startups
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
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
