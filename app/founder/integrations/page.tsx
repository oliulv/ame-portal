'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
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
import { z } from 'zod'
import {
  CreditCard,
  Code,
  Copy,
  Check,
  Trash2,
  Plus,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

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

type IntegrationTab = 'stripe' | 'tracker'
const validIntegrationTabs: IntegrationTab[] = ['stripe', 'tracker']

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <IntegrationsPageInner />
    </Suspense>
  )
}

function IntegrationsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = validIntegrationTabs.includes(tabParam as IntegrationTab)
    ? (tabParam as IntegrationTab)
    : 'stripe'
  const [activeTab, setActiveTab] = useState<IntegrationTab>(initialTab)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)
  const [isCreatingTracker, setIsCreatingTracker] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newTrackerId, setNewTrackerId] = useState<string | null>(null)
  const newTrackerRef = useRef<HTMLDivElement>(null)

  // Convex queries
  const trackerWebsites = useQuery(api.trackerWebsites.list)

  // Convex mutations and actions
  const createTrackerWebsite = useMutation(api.trackerWebsites.create)
  const removeTrackerWebsite = useMutation(api.trackerWebsites.remove)
  const connectStripe = useAction(api.integrations.connectStripe)

  // Auto-scroll to newly created tracker
  useEffect(() => {
    if (newTrackerId && trackerWebsites?.some((w) => w._id === newTrackerId)) {
      newTrackerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNewTrackerId(null)
    }
  }, [newTrackerId, trackerWebsites])

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

  const handleCreateTracker = async (data: TrackerWebsiteFormData) => {
    setIsCreatingTracker(true)
    try {
      const id = await createTrackerWebsite({
        name: data.name,
        domain: data.domain || undefined,
      })
      setNewTrackerId(id)
      trackerForm.reset()
      toast.success('Tracker website created successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tracker website')
    } finally {
      setIsCreatingTracker(false)
    }
  }

  const handleDeleteTracker = async (id: string) => {
    setDeletingId(id)
    try {
      await removeTrackerWebsite({ id: id as any })
      toast.success('Tracker website removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete tracker website')
    } finally {
      setDeletingId(null)
    }
  }

  const trackerBaseUrl = (
    process.env.NEXT_PUBLIC_TRACKER_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/+$/, '')

  const getTrackerSnippet = (websiteId: string) => {
    const src = trackerBaseUrl ? `${trackerBaseUrl}/tracker.js` : 'https://YOUR_DOMAIN/tracker.js'
    return `<script defer src="${src}" data-website-id="${websiteId}"></script>`
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleConnectStripe = async (data: StripeConnectFormData) => {
    setIsConnectingStripe(true)
    try {
      await connectStripe({
        apiKey: data.api_key,
      })
      toast.success('Stripe connected successfully')
      router.push('/founder/integrations?tab=stripe')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect Stripe')
    } finally {
      setIsConnectingStripe(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your external services to track metrics automatically
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('stripe')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors cursor-pointer ${
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
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'tracker'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="h-4 w-4" />
            Accelerate ME Tracker
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
                onSubmit={stripeForm.handleSubmit(handleConnectStripe)}
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
                  <Button type="submit" disabled={isConnectingStripe}>
                    {isConnectingStripe ? 'Connecting...' : 'Connect Stripe'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Tracker Tab */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          {/* Existing Tracker Websites (shown first) */}
          {trackerWebsites && trackerWebsites.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Your Tracker Websites</h2>
              {trackerWebsites.map((website) => {
                const snippet = getTrackerSnippet(website._id)
                const isNew = website._id === newTrackerId
                return (
                  <Card
                    key={website._id}
                    id={`tracker-${website._id}`}
                    ref={isNew ? newTrackerRef : undefined}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <CardTitle>{website.name}</CardTitle>
                            {website.domain && <CardDescription>{website.domain}</CardDescription>}
                          </div>
                          {website.lastEventAt ? (
                            <div className="flex items-center gap-1.5 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs font-medium">
                                Last event {formatRelativeTime(website.lastEventAt)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-600">
                              <Clock className="h-4 w-4" />
                              <span className="text-xs font-medium">
                                Waiting for first event...
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTracker(website._id)}
                          disabled={deletingId === website._id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Tracking Script</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-muted  text-sm break-all">
                            {snippet}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(snippet, website._id)}
                          >
                            {copiedId === website._id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {!trackerBaseUrl && (
                          <div className="mt-2 flex items-center gap-2 text-amber-600 text-xs">
                            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>
                              Replace <code className="font-mono">YOUR_DOMAIN</code> with your
                              production URL, or set{' '}
                              <code className="font-mono">NEXT_PUBLIC_APP_URL</code> in your
                              environment variables.
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Create Tracker Website */}
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
                  onSubmit={trackerForm.handleSubmit(handleCreateTracker)}
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
                          The domain where you&apos;ll install the tracker (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isCreatingTracker}>
                      <Plus className="h-4 w-4 mr-2" />
                      {isCreatingTracker ? 'Creating...' : 'Create Tracker Website'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Installation Guide */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>How to Install the Tracker</CardTitle>
              </div>
              <CardDescription>
                Follow these simple steps to add the Accelerate ME Tracker to your website
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
                      Fill out the form above to create a new tracker website. Give it a name and
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
                      After creating a tracker website, you&apos;ll see a tracking script. Click the
                      copy button to copy it to your clipboard.
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
        </div>
      )}
    </div>
  )
}
