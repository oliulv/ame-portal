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
import { Switch } from '@/components/ui/switch'
import { cohortSchema, type CohortFormData } from '@/lib/schemas'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { cohortsApi } from '@/lib/api/cohorts'
import { queryKeys } from '@/lib/queryKeys'

export default function NewCohortPage() {
  const router = useRouter()

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

  const createCohort = useAppMutation({
    mutationFn: (data: CohortFormData) => cohortsApi.create(data),
    invalidateQueries: [queryKeys.cohorts.lists()],
    successMessage: 'Cohort created successfully',
    onSuccess: () => {
      router.push('/admin/cohorts')
    },
  })

  async function onSubmit(data: CohortFormData) {
    createCohort.mutate(data)
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link href="/admin/cohorts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cohorts
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Cohort</CardTitle>
          <CardDescription>Add a new cohort to organize startups by program year</CardDescription>
        </CardHeader>
        <CardContent>
          {createCohort.isError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {createCohort.error?.message || 'An error occurred'}
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
                <Button type="submit" disabled={createCohort.isPending}>
                  {createCohort.isPending ? 'Creating...' : 'Create Cohort'}
                </Button>
                <Link href="/admin/cohorts">
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
