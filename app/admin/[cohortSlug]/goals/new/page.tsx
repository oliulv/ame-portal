'use client'

import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { goalTemplateSchema, type GoalTemplateFormData } from '@/lib/schemas'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { useSelectedCohort } from '@/lib/hooks/useSelectedCohort'
import { queryKeys } from '@/lib/queryKeys'
import { GoalBasicsForm } from '@/components/goal-template/GoalBasicsForm'
import { ConditionBuilder } from '@/components/goal-template/ConditionBuilder'
import { FundingInput } from '@/components/goal-template/FundingInput'
import { SubmitBar } from '@/components/goal-template/SubmitBar'
import { goalsApi } from '@/lib/api/goals'

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
    invalidateQueries: [
      queryKeys.goals.list('admin', { cohortId }),
      queryKeys.goals.list('admin'), // Also invalidate the general list
    ],
    successMessage: 'Goal template created successfully',
    onSuccess: () => {
      // Navigate back to the cohort-specific goals page
      if (cohortSlug) {
        router.push(`/admin/${cohortSlug}/goals`)
      } else {
        router.push('/admin/goals')
      }
    },
  })

  async function onSubmit(data: GoalTemplateFormData) {
    createGoal.mutate(data)
  }

  return (
    <div className="container max-w-4xl py-8">
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
            Create a goal template with data-bound success conditions that will be assigned to new
            startups in the selected cohort
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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

              {/* Section A: Goal Basics */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Goal Basics</h2>
                <GoalBasicsForm form={form} />
              </div>

              {/* Section B: Success Condition */}
              <div className="space-y-4 border-t pt-6">
                <ConditionBuilder form={form} />
              </div>

              {/* Section C: Reward */}
              <div className="space-y-4 border-t pt-6">
                <h2 className="text-lg font-semibold">Reward</h2>
                <FundingInput form={form} />
              </div>

              {/* Section D: Submit Controls */}
              <div className="border-t pt-6">
                <SubmitBar
                  form={form}
                  isLoading={createGoal.isPending}
                  cohortSlug={cohortSlug ?? undefined}
                />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
