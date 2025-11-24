'use client'

import { useRouter, useParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { goalTemplateSchema, type GoalTemplateFormData } from '@/lib/schemas'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { useSelectedCohort } from '@/lib/hooks/useSelectedCohort'
import { goalsApi } from '@/lib/api/goals'
import { queryKeys } from '@/lib/queryKeys'
import { GoalBasicsForm } from '@/components/goal-template/GoalBasicsForm'
import { ConditionBuilder } from '@/components/goal-template/ConditionBuilder'
import { FundingInput } from '@/components/goal-template/FundingInput'
import { SubmitBar } from '@/components/goal-template/SubmitBar'
import { extractConditionsFromDescription } from '@/lib/goalUtils'

export default function GoalEditPage() {
  const router = useRouter()
  const params = useParams()
  const goalId = params.id as string
  const { cohortId, cohort, cohortSlug } = useSelectedCohort()

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

  // Fetch goal template data
  const { data: goal, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.goals.detail(goalId),
    queryFn: () => goalsApi.getById(goalId),
    enabled: !!goalId,
  })

  // Reset form when goal data loads
  useEffect(() => {
    if (goal) {
      const { cleanDescription, conditions } = extractConditionsFromDescription(goal.description)
      
      // Parse category - handle both old and new categories
      const validCategories = ['launch', 'revenue', 'users', 'product', 'fundraising', 'growth', 'hiring'] as const
      const category = (goal.category && validCategories.includes(goal.category as any))
        ? goal.category as typeof validCategories[number]
        : 'launch'
      
      form.reset({
        cohortId: goal.cohort_id,
        title: goal.title,
        description: cleanDescription,
        category,
        deadline: goal.default_deadline || undefined,
        isActive: goal.is_active,
        conditions: conditions || [
          {
            dataSource: 'stripe' as const,
            metric: '',
            operator: '>=' as const,
            targetValue: goal.default_target_value || undefined,
            unit: '',
          },
        ],
        fundingUnlocked: goal.default_funding_amount || undefined,
      })
    }
  }, [goal, form])

  // Update cohortId when cohort changes
  useEffect(() => {
    if (cohortId) {
      form.setValue('cohortId', cohortId)
    }
  }, [cohortId, form])

  const updateGoal = useAppMutation({
    mutationFn: (data: GoalTemplateFormData) => {
      if (!goalId) throw new Error('Goal ID is required')
      return goalsApi.updateTemplate(goalId, data)
    },
    invalidateQueries: [
      queryKeys.goals.detail(goalId),
      queryKeys.goals.list('admin', { cohortId }),
      queryKeys.goals.list('admin'),
    ],
    successMessage: 'Goal template updated successfully',
    onSuccess: () => {
      if (cohortSlug) {
        router.push(`/admin/${cohortSlug}/goals`)
      } else {
        router.push('/admin/goals')
      }
    },
  })

  async function onSubmit(data: GoalTemplateFormData) {
    updateGoal.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="mb-6">
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (queryError || !goal) {
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
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-destructive">
                {queryError?.message || 'Goal template not found'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
          <CardTitle>Edit Goal Template</CardTitle>
          <CardDescription>
            Update goal template with condition-based success criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {updateGoal.isError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {updateGoal.error?.message || 'An error occurred'}
            </div>
          )}

          {cohort && (
            <div className="mb-6 rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">Cohort</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cohort.label} ({cohort.year_start} - {cohort.year_end})
              </p>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                  isLoading={updateGoal.isPending} 
                  cohortSlug={cohortSlug} 
                />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

