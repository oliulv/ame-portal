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
import { formatDescriptionWithConditions } from '@/lib/goalUtils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { GoalBasicsForm } from '@/components/goal-template/GoalBasicsForm'
import { ConditionBuilder } from '@/components/goal-template/ConditionBuilder'
import { FundingInput } from '@/components/goal-template/FundingInput'
import { SubmitBar } from '@/components/goal-template/SubmitBar'
import type { Id } from '@/convex/_generated/dataModel'

export default function NewGoalTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const createGoal = useMutation(api.goalTemplates.create)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLoadingCohort = cohort === undefined

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

  // Update form when cohort is loaded
  useEffect(() => {
    if (cohort?._id) {
      form.setValue('cohortId', cohort._id)
    }
  }, [cohort?._id, form])

  async function onSubmit(data: GoalTemplateFormData) {
    if (!cohort?._id) return

    setIsSubmitting(true)
    setError(null)
    try {
      const description = data.conditions
        ? formatDescriptionWithConditions(data.description, data.conditions)
        : data.description

      await createGoal({
        cohortId: cohort._id as Id<'cohorts'>,
        title: data.title,
        description,
        category: data.category,
        defaultDeadline: data.deadline,
        isActive: data.isActive,
        defaultFundingAmount: data.fundingUnlocked,
        defaultWeight: 1,
        defaultTargetValue: data.conditions?.[0]?.targetValue,
      })
      toast.success('Goal template created successfully')
      router.push(`/admin/${cohortSlug}/goals`)
    } catch (err) {
      console.error('Failed to create goal template:', err)
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
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
          <CardTitle>Create New Goal Template</CardTitle>
          <CardDescription>
            Create a goal template with data-bound success conditions that will be assigned to new
            startups in the selected cohort
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoadingCohort ? (
            <div className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Loading cohort information...
            </div>
          ) : !cohort ? (
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
                    {cohort.label} ({cohort.yearStart} - {cohort.yearEnd})
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
                  isLoading={isSubmitting}
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
