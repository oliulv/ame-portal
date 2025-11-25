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
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function NewStartupPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cohorts, setCohorts] = useState<Array<{ id: string; label: string }>>([])
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(true)

  const form = useForm<StartupFormData>({
    resolver: zodResolver(startupSchema),
    defaultValues: {
      name: '',
      cohort_id: '',
      logo_url: '',
      sector: '',
      website_url: '',
      notes: '',
    },
  })

  // Fetch cohorts for dropdown
  useEffect(() => {
    async function fetchCohorts() {
      try {
        const response = await fetch('/api/admin/cohorts')
        if (response.ok) {
          const data = await response.json()
          setCohorts(data)
        }
      } catch (err) {
        console.error('Failed to fetch cohorts:', err)
      } finally {
        setIsLoadingCohorts(false)
      }
    }

    fetchCohorts()
  }, [])

  async function onSubmit(data: StartupFormData) {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/startups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create startup')
      }

      const startup = await response.json()

      // Success! Redirect to startup detail page using slug
      router.push(`/admin/startups/${startup.slug}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Startup</CardTitle>
          <CardDescription>
            Add a new startup to the accelerator program. Goals will be automatically assigned from
            the cohort's templates.
          </CardDescription>
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
                name="cohort_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cohort *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoadingCohorts}
                    >
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
                    <FormDescription>
                      Goals from this cohort will be automatically assigned
                    </FormDescription>
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
                  <Plus className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Creating Startup...' : 'Create Startup'}
                </Button>
                <Link href="/admin">
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
