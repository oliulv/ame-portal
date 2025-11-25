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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { startupSchema, type StartupFormData } from '@/lib/schemas'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface StartupEditPageProps {
  params: Promise<{
    slug: string
  }>
}

export default function StartupEditPage({ params }: StartupEditPageProps) {
  const router = useRouter()
  const [startupSlug, setStartupSlug] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cohorts, setCohorts] = useState<Array<{ id: string; label: string }>>([])

  const form = useForm<StartupFormData>({
    resolver: zodResolver(startupSchema),
    defaultValues: {
      name: '',
      cohort_id: '',
      slug: '',
      logo_url: '',
      sector: '',
      website_url: '',
      notes: '',
    },
  })

  // Fetch startup data and cohorts
  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params
      setStartupSlug(resolvedParams.slug)

      try {
        // Fetch cohorts for dropdown
        const cohortsResponse = await fetch('/api/admin/cohorts')
        if (cohortsResponse.ok) {
          const cohortsData = await cohortsResponse.json()
          setCohorts(cohortsData)
        }

        // Fetch startup by slug
        const startupResponse = await fetch(`/api/admin/startups/${resolvedParams.slug}`)
        if (!startupResponse.ok) {
          throw new Error('Failed to load startup')
        }

        const startup = await startupResponse.json()
        form.reset({
          name: startup.name,
          cohort_id: startup.cohort_id,
          slug: startup.slug || '',
          logo_url: startup.logo_url || '',
          sector: startup.sector || '',
          website_url: startup.website_url || '',
          notes: startup.notes || '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load startup')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [params, form])

  async function onSubmit(data: StartupFormData) {
    if (!startupSlug) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/startups/${startupSlug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update startup')
      }

      const result = await response.json()

      // Success! Redirect to startup detail page (using new slug if changed)
      const redirectSlug = result.new_slug || startupSlug
      router.push(`/admin/startups/${redirectSlug}`)
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
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link href={`/admin/startups/${startupSlug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startup
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Startup</CardTitle>
          <CardDescription>Update startup information</CardDescription>
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
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., acme-inc" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL-friendly identifier (lowercase letters, numbers, and hyphens only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cohort_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cohort *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormDescription>Change the cohort for this startup</FormDescription>
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Link href={`/admin/startups/${startupSlug}`}>
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
