'use client'

import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
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
import { Switch } from '@/components/ui/switch'
import { cohortSchema, type CohortFormData } from '@/lib/schemas'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { cohortsApi } from '@/lib/api/cohorts'
import { queryKeys } from '@/lib/queryKeys'

interface CohortEditPageProps {
  params: Promise<{
    slug: string
  }>
}

export default function CohortEditPage({ params }: CohortEditPageProps) {
  const router = useRouter()
  const [cohortSlug, setCohortSlug] = useState<string | null>(null)

  const form = useForm<CohortFormData>({
    resolver: zodResolver(cohortSchema),
    defaultValues: {
      name: '',
      label: '',
      year_start: new Date().getFullYear(),
      year_end: new Date().getFullYear() + 1,
      is_active: true,
    },
  })

  // Unwrap params
  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params
      setCohortSlug(resolvedParams.slug)
    }
    loadParams()
  }, [params])

  // Fetch cohort data using TanStack Query
  const {
    data: cohort,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.cohorts.detail(cohortSlug || ''),
    queryFn: () => cohortsApi.getBySlug(cohortSlug!),
    enabled: !!cohortSlug,
  })

  // Reset form when cohort data loads
  useEffect(() => {
    if (cohort) {
      form.reset({
        name: cohort.name,
        label: cohort.label,
        year_start: cohort.year_start,
        year_end: cohort.year_end,
        is_active: cohort.is_active,
      })
    }
  }, [cohort, form])

  const updateCohort = useAppMutation({
    mutationFn: (data: CohortFormData) => {
      if (!cohortSlug) throw new Error('Cohort slug is required')
      return cohortsApi.update(cohortSlug, data)
    },
    invalidateQueries: [queryKeys.cohorts.lists(), queryKeys.cohorts.detail(cohortSlug || '')],
    successMessage: 'Cohort updated successfully',
    onSuccess: () => {
      router.push('/admin/startups')
    },
  })

  async function onSubmit(data: CohortFormData) {
    if (!cohortSlug) return
    updateCohort.mutate(data)
  }

  if (isLoading || !cohortSlug) {
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
        <Link href="/admin/startups">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startups
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Cohort</CardTitle>
          <CardDescription>Update cohort information</CardDescription>
        </CardHeader>
        <CardContent>
          {(queryError || updateCohort.isError) && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {queryError?.message || updateCohort.error?.message || 'An error occurred'}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Name</FormLabel>
                    <FormControl>
                      <Input placeholder="accelerateme-2025" {...field} />
                    </FormControl>
                    <FormDescription>
                      Lowercase alphanumeric with hyphens (e.g., accelerateme-2025)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Cohort 12" {...field} />
                    </FormControl>
                    <FormDescription>User-friendly name shown in the interface</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="year_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>Active cohorts are displayed in the system</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button type="submit" disabled={updateCohort.isPending}>
                  {updateCohort.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Link href="/admin/startups">
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
