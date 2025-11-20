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

const GOAL_CATEGORIES = [
  { value: 'launch', label: 'Launch' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'users', label: 'Users/Traffic' },
  { value: 'product', label: 'Product' },
  { value: 'fundraising', label: 'Fundraising' },
] as const

export default function NewGoalTemplatePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cohorts, setCohorts] = useState<Array<{ id: string; label: string }>>([])
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(true)

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

  // Fetch cohorts for dropdown
  useEffect(() => {
    async function fetchCohorts() {
      try {
        const response = await fetch('/api/admin/cohorts')
        if (response.ok) {
          const data = await response.json()
          setCohorts(data)
        }
      } catch (err) {
        console.error('Failed to fetch cohorts:', err)
      } finally {
        setIsLoadingCohorts(false)
      }
    }

    fetchCohorts()
  }, [])

  async function onSubmit(data: GoalTemplateFormData) {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create goal template')
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
          <CardTitle>Create New Goal Template</CardTitle>
          <CardDescription>
            Create a default goal template that will be assigned to new startups in the selected cohort
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
                      disabled={isLoadingCohorts}
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
                    <FormDescription>
                      Short, descriptive title for the goal
                    </FormDescription>
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
                    <FormDescription>
                      Full description explaining what needs to be achieved
                    </FormDescription>
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
                    <FormDescription>
                      Type of goal to help with organization
                    </FormDescription>
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
                    <FormDescription>
                      Target completion date
                    </FormDescription>
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
                  {isSubmitting ? 'Creating...' : 'Create Goal Template'}
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
