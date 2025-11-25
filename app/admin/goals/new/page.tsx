'use client'

import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
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
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { useSelectedCohort } from '@/lib/hooks/useSelectedCohort'
import { goalsApi } from '@/lib/api/goals'
import { queryKeys } from '@/lib/queryKeys'
import { ConditionBuilder } from '@/components/goal-template/ConditionBuilder'
import { FundingInput } from '@/components/goal-template/FundingInput'

const GOAL_CATEGORIES = [
  { value: 'launch', label: 'Launch' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'users', label: 'Users/Traffic' },
  { value: 'product', label: 'Product' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'growth', label: 'Growth' },
  { value: 'hiring', label: 'Hiring' },
] as const

export default function NewGoalTemplatePage() {
  const router = useRouter()
  const { cohortId, cohort, cohortSlug, isLoading: isLoadingCohort } = useSelectedCohort()

  const form = useForm<GoalTemplateFormData>({
    resolver: zodResolver(goalTemplateSchema),
    defaultValues: {
      cohortId: cohortId || '',
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

  // Update form when cohort is loaded
  useEffect(() => {
    if (cohortId) {
      form.setValue('cohortId', cohortId)
    }
  }, [cohortId, form])

  const createGoal = useAppMutation({
    mutationFn: (data: GoalTemplateFormData) => goalsApi.createTemplate(data),
    invalidateQueries: [queryKeys.goals.list('admin')],
    successMessage: 'Goal template created successfully',
    onSuccess: () => {
      router.push('/admin/goals')
    },
  })

  async function onSubmit(data: GoalTemplateFormData) {
    createGoal.mutate(data)
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link href={cohortSlug ? `/admin/${cohortSlug}/goals` : '/admin/goals'}>
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
            Create a default goal template that will be assigned to new startups in the selected
            cohort
          </CardDescription>
        </CardHeader>
        <CardContent>
          {createGoal.isError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {createGoal.error?.message || 'An error occurred'}
            </div>
          )}

          {isLoadingCohort ? (
            <div className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Loading cohort information...
            </div>
          ) : !cohortId ? (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Please select a cohort from the sidebar to create goal templates.
            </div>
          ) : null}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {cohort && (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm font-medium">Cohort</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cohort.label} ({cohort.year_start} - {cohort.year_end})
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    This goal template will apply to new startups in this cohort
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
                    <FormDescription>Short, descriptive title for the goal</FormDescription>
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
                    <FormDescription>Type of goal to help with organization</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Deadline (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>Target completion date</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Success Conditions Section */}
              <div className="space-y-4 border-t pt-6">
                <ConditionBuilder form={form} />
              </div>

              {/* Reward Section */}
              <div className="space-y-4 border-t pt-6">
                <h2 className="text-lg font-semibold">Reward</h2>
                <FundingInput form={form} />
              </div>

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
                <Button type="submit" disabled={createGoal.isPending || !cohortId}>
                  {createGoal.isPending ? 'Creating...' : 'Create Goal Template'}
                </Button>
                <Link href={cohortSlug ? `/admin/${cohortSlug}/goals` : '/admin/goals'}>
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
