'use client'

import { useState, useEffect } from 'react'
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
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function EditStartupPage() {
  const router = useRouter()
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const slug = params.slug as string

  const startup = useQuery(api.startups.getBySlug, { slug })
  const updateStartup = useMutation(api.startups.update)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<StartupFormData>({
    resolver: zodResolver(startupSchema),
    defaultValues: {
      name: '',
      logo_url: '',
      sector: '',
      stage: '',
      website_url: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (startup) {
      form.reset({
        name: startup.name,
        logo_url: startup.logoUrl || '',
        sector: startup.sector || '',
        stage: startup.stage || '',
        website_url: startup.websiteUrl || '',
        notes: startup.notes || '',
      })
    }
  }, [startup, form])

  async function onSubmit(data: StartupFormData) {
    if (!startup) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await updateStartup({
        id: startup._id,
        name: data.name,
        sector: data.sector || undefined,
        stage: data.stage || undefined,
        websiteUrl: data.website_url || undefined,
        logoUrl: data.logo_url || undefined,
        notes: data.notes || undefined,
      })

      toast.success('Startup updated successfully')
      router.push(`/admin/${cohortSlug}/startups/${result.slug || slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (startup === undefined) {
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

  if (startup === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h1 className="text-2xl font-bold font-display">Startup not found</h1>
        <p className="mt-2 text-muted-foreground">
          The startup you are looking for does not exist.
        </p>
        <Link href={`/admin/${cohortSlug}/startups`} className="mt-4">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startups
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/${cohortSlug}/startups/${slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startup
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Startup</CardTitle>
          <CardDescription>Update startup details for {startup.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4  bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
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
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Pre-seed, Seed, Series A" {...field} />
                    </FormControl>
                    <FormDescription>Current funding stage (optional)</FormDescription>
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
                <Link href={`/admin/${cohortSlug}/startups/${slug}`}>
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
