'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { goalTemplateSchema, type GoalTemplateFormData } from '@/lib/schemas'
import { extractConditionsFromDescription, formatDescriptionWithConditions } from '@/lib/goalUtils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { GoalBasicsForm } from '@/components/goal-template/GoalBasicsForm'
import { ConditionBuilder } from '@/components/goal-template/ConditionBuilder'
import { FundingInput } from '@/components/goal-template/FundingInput'
import { SubmitBar } from '@/components/goal-template/SubmitBar'
import type { Id } from '@/convex/_generated/dataModel'

export default function GoalEditPage() {
  const router = useRouter()
  const params = useParams()
  const goalId = params.id as string
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const goal = useQuery(
    api.goalTemplates.getById,
    goalId ? { id: goalId as Id<'goalTemplates'> } : 'skip'
  )

  const updateGoalMutation = useMutation(api.goalTemplates.update)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLoading = goal === undefined

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

  // Update cohortId when cohort changes
  useEffect(() => {
    if (cohort?._id) {
      form.setValue('cohortId', cohort._id)
    }
  }, [cohort?._id, form])

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
      router.push(`/admin/${cohortSlug}/goals`)
    } catch (err) {
      console.error('Failed to update goal template:', err)
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
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

  if (!goal) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="mb-6">
          <Link href={`/admin/${cohortSlug}/goals`}>
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
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Link href={`/admin/${cohortSlug}/goals`}>
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
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {cohort && (
            <div className="mb-6 rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">Cohort</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cohort.label} ({cohort.yearStart} - {cohort.yearEnd})
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
                <SubmitBar form={form} isLoading={isSubmitting} cohortSlug={cohortSlug} />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
