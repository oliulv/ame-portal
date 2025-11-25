'use client'

import { useState, useEffect } from 'react'
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
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { z } from 'zod'
import {
  ArrowLeft,
  CreditCard,
  Code,
  Copy,
  Check,
  Trash2,
  Plus,
  BookOpen,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { TrackerWebsite } from '@/lib/types'

const stripeConnectSchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  account_id: z.string().optional(),
})

const trackerWebsiteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().optional(),
})

type StripeConnectFormData = z.infer<typeof stripeConnectSchema>
type TrackerWebsiteFormData = z.infer<typeof trackerWebsiteSchema>

export default function IntegrationsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'stripe' | 'tracker'>('stripe')
  const [trackerWebsites, setTrackerWebsites] = useState<TrackerWebsite[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const stripeForm = useForm<StripeConnectFormData>({
    resolver: zodResolver(stripeConnectSchema),
    defaultValues: {
      api_key: '',
      account_id: '',
    },
  })

  const trackerForm = useForm<TrackerWebsiteFormData>({
    resolver: zodResolver(trackerWebsiteSchema),
    defaultValues: {
      name: '',
      domain: '',
    },
  })

  // Fetch tracker websites
  useEffect(() => {
    fetch('/api/founder/tracker-websites')
      .then((res) => res.json())
      .then((data) => {
        if (data.websites) {
          setTrackerWebsites(data.websites)
        }
      })
      .catch((err) => console.error('Failed to fetch tracker websites:', err))
  }, [])

  const createTrackerWebsiteMutation = useAppMutation({
    mutationFn: async (data: TrackerWebsiteFormData) => {
      const response = await fetch('/api/founder/tracker-websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create tracker website')
      }
      return response.json()
    },
    onSuccess: (data) => {
      setTrackerWebsites([data.website, ...trackerWebsites])
      trackerForm.reset()
      router.refresh()
    },
  })

  const deleteTrackerWebsiteMutation = useAppMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/founder/tracker-websites/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete tracker website')
      }
      return response.json()
    },
    onSuccess: () => {
      router.refresh()
      // Refetch websites
      fetch('/api/founder/tracker-websites')
        .then((res) => res.json())
        .then((data) => {
          if (data.websites) {
            setTrackerWebsites(data.websites)
          }
        })
    },
  })

  const getTrackerSnippet = (websiteId: string) => {
    // Use environment variable for production URL, fallback to window.location.origin for development
    // Set NEXT_PUBLIC_TRACKER_BASE_URL to your production URL (e.g., https://app.accelerateme.com)
    const baseUrl =
      typeof window !== 'undefined' && process.env.NEXT_PUBLIC_TRACKER_BASE_URL
        ? process.env.NEXT_PUBLIC_TRACKER_BASE_URL
        : typeof window !== 'undefined'
          ? window.location.origin
          : ''
    return `<script defer src="${baseUrl}/tracker.js" data-website-id="${websiteId}"></script>`
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const connectStripeMutation = useAppMutation({
    mutationFn: async (data: StripeConnectFormData) => {
      const response = await fetch('/api/integrations/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to connect Stripe')
      }
      return response.json()
    },
    onSuccess: () => {
      router.push('/founder/settings?tab=integrations')
      router.refresh()
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/founder/settings?tab=integrations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connect Integration</h1>
          <p className="text-muted-foreground">
            Connect your external services to track metrics automatically
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('stripe')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'stripe'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Stripe
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'tracker'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="h-4 w-4" />
            AccelerateMe Tracker
          </button>
        </nav>
      </div>

      {/* Stripe Form */}
      {activeTab === 'stripe' && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Stripe</CardTitle>
            <CardDescription>
              Enter your Stripe API key to automatically track revenue, customers, and MRR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...stripeForm}>
              <form
                onSubmit={stripeForm.handleSubmit((data) => connectStripeMutation.mutate(data))}
                className="space-y-6"
                autoComplete="off"
              >
                <FormField
                  control={stripeForm.control}
                  name="api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stripe Secret Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="sk_live_..."
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Your Stripe secret key (starts with sk_live_ or sk_test_)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={stripeForm.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account ID (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="acct_..." autoComplete="off" {...field} />
                      </FormControl>
                      <FormDescription>
                        Your Stripe account ID (optional, will be auto-detected)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={connectStripeMutation.isPending}>
                    {connectStripeMutation.isPending ? 'Connecting...' : 'Connect Stripe'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Tracker Form */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          {/* Installation Guide */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>How to Install the Tracker</CardTitle>
              </div>
              <CardDescription>
                Follow these simple steps to add the AccelerateMe Tracker to your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium">Create a Tracker Website</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fill out the form below to create a new tracker website. Give it a name and
                      optionally specify the domain.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium">Copy Your Tracking Script</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      After creating a tracker website, you'll see a tracking script. Click the copy
                      button to copy it to your clipboard.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium">Paste Into Your Website</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Paste the script into the{' '}
                      <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                        &lt;head&gt;
                      </code>{' '}
                      section of your HTML, or before the closing{' '}
                      <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                        &lt;/body&gt;
                      </code>{' '}
                      tag.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    4
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-medium">View Your Analytics</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Once installed, visit your{' '}
                      <Link
                        href="/founder/analytics"
                        className="underline font-medium text-primary hover:text-primary/80"
                      >
                        Analytics page
                      </Link>{' '}
                      to see pageviews, sessions, and user metrics appear within a few minutes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium flex items-center gap-2 hover:text-foreground">
                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90 text-muted-foreground" />
                    Advanced: Track Custom Events
                  </summary>
                  <div className="mt-3 ml-6 space-y-2 text-sm text-muted-foreground">
                    <p>You can track custom events by adding attributes to HTML elements:</p>
                    <code className="block px-3 py-2 bg-muted rounded text-xs mt-2 font-mono">
                      {`<button data-accelerate-event="signup-button" data-accelerate-event-button-type="primary">`}
                      <br />
                      {`  Sign Up`}
                      <br />
                      {`</button>`}
                    </code>
                    <p className="mt-2">Or use JavaScript:</p>
                    <code className="block px-3 py-2 bg-muted rounded text-xs mt-2 font-mono">
                      {`window.accelerateTracker.track('event-name', { custom: 'data' });`}
                    </code>
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Tracker Website</CardTitle>
              <CardDescription>
                Create a new tracker website to get a tracking script you can add to your site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...trackerForm}>
                <form
                  onSubmit={trackerForm.handleSubmit((data) =>
                    createTrackerWebsiteMutation.mutate(data)
                  )}
                  className="space-y-6"
                >
                  <FormField
                    control={trackerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My Marketing Site" {...field} />
                        </FormControl>
                        <FormDescription>A friendly name to identify this website</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={trackerForm.control}
                    name="domain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Domain (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          The domain where you'll install the tracker (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={createTrackerWebsiteMutation.isPending}>
                      <Plus className="h-4 w-4 mr-2" />
                      {createTrackerWebsiteMutation.isPending
                        ? 'Creating...'
                        : 'Create Tracker Website'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Existing Tracker Websites */}
          {trackerWebsites.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Your Tracker Websites</h2>
              {trackerWebsites.map((website) => {
                const snippet = getTrackerSnippet(website.id)
                return (
                  <Card key={website.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{website.name}</CardTitle>
                          {website.domain && <CardDescription>{website.domain}</CardDescription>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTrackerWebsiteMutation.mutate(website.id)}
                          disabled={deleteTrackerWebsiteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Tracking Script</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm break-all">
                            {snippet}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(snippet, website.id)}
                          >
                            {copiedId === website.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium">Installation Instructions:</p>
                          <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                            <li>Copy the script above</li>
                            <li>Open your website's HTML file or content management system</li>
                            <li>
                              Paste the script in the{' '}
                              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                                &lt;head&gt;
                              </code>{' '}
                              section, or before the closing{' '}
                              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                                &lt;/body&gt;
                              </code>{' '}
                              tag
                            </li>
                            <li>Save and publish your website</li>
                            <li>
                              Visit your{' '}
                              <Link href="/founder/analytics" className="underline">
                                Analytics page
                              </Link>{' '}
                              to see metrics appear
                            </li>
                          </ol>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
