'use client'

import { useRouter, useParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
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
import { Skeleton } from '@/components/ui/skeleton'
import { startupSchema, type StartupFormData } from '@/lib/schemas'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

export default function NewStartupPage() {
  const router = useRouter()
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const createStartup = useMutation(api.startups.create)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<StartupFormData>({
    resolver: zodResolver(startupSchema),
    defaultValues: {
      name: '',
      logo_url: '',
      sector: '',
      website_url: '',
      notes: '',
    },
  })

  async function onSubmit(data: StartupFormData) {
    if (!cohort) {
      setError('Please select a cohort from the sidebar')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await createStartup({
        cohortId: cohort._id,
        name: data.name,
        sector: data.sector,
        websiteUrl: data.website_url,
        logoUrl: data.logo_url,
        notes: data.notes,
      })

      toast.success('Startup created successfully')
      router.push(`/admin/${cohortSlug}/startups`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLoadingCohort = cohort === undefined

  if (isLoadingCohort) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <div>
        <Link href={`/admin/${cohortSlug}/startups`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startups
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Startup</CardTitle>
          <CardDescription>
            Add a new startup to the accelerator program. Milestones will be automatically assigned
            from the cohort's templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {cohort === null ? (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Cohort not found. Please select a valid cohort from the sidebar.
            </div>
          ) : null}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {cohort && (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm font-medium">Cohort</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cohort.label} ({cohort.yearStart} - {cohort.yearEnd})
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Milestones from this cohort will be automatically assigned to the new startup
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Startup Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Acme Inc" {...field} />
                    </FormControl>
                    <FormDescription>The official name of the startup</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sector</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., FinTech, HealthTech, EdTech" {...field} />
                    </FormControl>
                    <FormDescription>Industry or sector (optional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormDescription>Company website (optional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://example.com/logo.png" {...field} />
                    </FormControl>
                    <FormDescription>Direct URL to company logo (optional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes about this startup..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Private notes (not visible to founders)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting || !cohort}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Creating Startup...' : 'Create Startup'}
                </Button>
                <Link href={`/admin/${cohortSlug}/startups`}>
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
