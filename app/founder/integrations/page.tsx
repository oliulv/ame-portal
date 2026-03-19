'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
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
import { Badge } from '@/components/ui/badge'
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
  Github,
  Share2,
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

type IntegrationTab = 'stripe' | 'tracker' | 'github' | 'social'
const validIntegrationTabs: IntegrationTab[] = ['stripe', 'tracker', 'github', 'social']

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
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-64 w-full" />
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
  const [savingSocial, setSavingSocial] = useState<string | null>(null)
  const [savedSocial, setSavedSocial] = useState<string | null>(null)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const socialInputs = useRef<Record<string, string>>({})

  // Convex queries
  const trackerWebsites = useQuery(api.trackerWebsites.list)
  const fullStatus = useQuery(api.integrations.fullStatus)

  // Convex mutations and actions
  const createTrackerWebsite = useMutation(api.trackerWebsites.create)
  const removeTrackerWebsite = useMutation(api.trackerWebsites.remove)
  const connectStripe = useAction(api.integrations.connectStripe)
  const disconnectGithub = useMutation(api.integrations.disconnectGithub)
  const saveSocialProfile = useMutation(api.integrations.saveSocialProfile)

  useEffect(() => {
    if (newTrackerId && trackerWebsites?.some((w) => w._id === newTrackerId)) {
      newTrackerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNewTrackerId(null)
    }
  }, [newTrackerId, trackerWebsites])

  const stripeForm = useForm<StripeConnectFormData>({
    resolver: zodResolver(stripeConnectSchema),
    defaultValues: { api_key: '', account_id: '' },
  })

  const trackerForm = useForm<TrackerWebsiteFormData>({
    resolver: zodResolver(trackerWebsiteSchema),
    defaultValues: { name: '', domain: '' },
  })

  // Populate social inputs from existing data
  useEffect(() => {
    if (fullStatus?.social) {
      for (const profile of fullStatus.social) {
        socialInputs.current[profile.platform] = profile.handle
      }
    }
  }, [fullStatus?.social])

  // Cleanup debounce timers
  useEffect(() => {
    const timers = debounceTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  const handleCreateTracker = async (data: TrackerWebsiteFormData) => {
    setIsCreatingTracker(true)
    try {
      const id = await createTrackerWebsite({ name: data.name, domain: data.domain || undefined })
      setNewTrackerId(id)
      trackerForm.reset()
      toast.success('Tracker website created')
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
      await connectStripe({ apiKey: data.api_key })
      toast.success('Stripe connected')
      router.push('/founder/integrations?tab=stripe')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect Stripe')
    } finally {
      setIsConnectingStripe(false)
    }
  }

  const handleSocialBlur = useCallback(
    (platform: 'twitter' | 'linkedin' | 'instagram', rawValue: string) => {
      const handle = rawValue.replace(/^@/, '').trim()
      const prev = fullStatus?.social?.find((p) => p.platform === platform)?.handle ?? ''
      if (!handle || handle === prev) return

      // Clear any pending debounce for this platform
      if (debounceTimers.current[platform]) {
        clearTimeout(debounceTimers.current[platform])
      }

      debounceTimers.current[platform] = setTimeout(async () => {
        setSavingSocial(platform)
        setSavedSocial(null)
        try {
          await saveSocialProfile({ platform, handle })
          setSavedSocial(platform)
          setTimeout(() => setSavedSocial((s) => (s === platform ? null : s)), 2000)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to save')
        } finally {
          setSavingSocial((s) => (s === platform ? null : s))
        }
      }, 800)
    },
    [saveSocialProfile, fullStatus?.social]
  )

  const tabItems: {
    key: IntegrationTab
    label: string
    icon: React.ReactNode
    connected: boolean
  }[] = [
    {
      key: 'stripe',
      label: 'Stripe',
      icon: <CreditCard className="h-4 w-4" />,
      connected: fullStatus?.stripe?.status === 'active',
    },
    {
      key: 'tracker',
      label: 'Tracker',
      icon: <Code className="h-4 w-4" />,
      connected: (trackerWebsites?.length ?? 0) > 0,
    },
    {
      key: 'github',
      label: 'GitHub',
      icon: <Github className="h-4 w-4" />,
      connected: fullStatus?.github?.status === 'active',
    },
    {
      key: 'social',
      label: 'Social',
      icon: <Share2 className="h-4 w-4" />,
      connected: (fullStatus?.social?.length ?? 0) > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Integrations</h1>
        <p className="text-muted-foreground">Connect your tools to track metrics automatically</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.connected && <span className="h-2 w-2 rounded-full bg-green-500" />}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Stripe Tab ────────────────────────────────────── */}
      {activeTab === 'stripe' && (
        <div className="space-y-4">
          {fullStatus?.stripe ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">
                        Connected
                        {fullStatus.stripe.accountName ? ` — ${fullStatus.stripe.accountName}` : ''}
                      </p>
                      {fullStatus.stripe.lastSyncedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last synced {formatRelativeTime(fullStatus.stripe.lastSyncedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Connect Stripe</CardTitle>
                <CardDescription>
                  Enter your Stripe API key to track revenue, MRR, and customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...stripeForm}>
                  <form
                    onSubmit={stripeForm.handleSubmit(handleConnectStripe)}
                    className="space-y-4"
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
                          <FormDescription>Starts with sk_live_ or sk_test_</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isConnectingStripe}>
                      {isConnectingStripe ? 'Connecting...' : 'Connect Stripe'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tracker Tab ───────────────────────────────────── */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          {trackerWebsites && trackerWebsites.length > 0 && (
            <div className="space-y-4">
              {trackerWebsites.map((website) => {
                const snippet = getTrackerSnippet(website._id)
                const isNew = website._id === newTrackerId
                return (
                  <Card key={website._id} ref={isNew ? newTrackerRef : undefined}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <CardTitle className="text-base">{website.name}</CardTitle>
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
                              <span className="text-xs font-medium">Waiting for first event</span>
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
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-muted text-sm break-all">
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
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Add Tracker Website</CardTitle>
              <CardDescription>Get a tracking script to add to your site</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...trackerForm}>
                <form
                  onSubmit={trackerForm.handleSubmit(handleCreateTracker)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={trackerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Marketing Site" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={trackerForm.control}
                      name="domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Domain (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={isCreatingTracker}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isCreatingTracker ? 'Creating...' : 'Create'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Installation guide */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>Installation Guide</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Create a tracker website above to get your tracking script.</p>
              <p>
                2. Paste the script into your website&apos;s{' '}
                <code className="px-1 py-0.5 bg-muted text-xs font-mono">&lt;head&gt;</code> tag.
              </p>
              <p>
                3. Visit your{' '}
                <Link href="/founder/analytics" className="underline text-primary">
                  Analytics page
                </Link>{' '}
                to see data within minutes.
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer font-medium text-foreground flex items-center gap-1">
                  <ChevronRight className="h-4 w-4" />
                  Track custom events
                </summary>
                <code className="block px-3 py-2 bg-muted text-xs mt-2 font-mono">
                  {`window.accelerateTracker.track('event-name', { key: 'value' })`}
                </code>
              </details>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── GitHub Tab ────────────────────────────────────── */}
      {activeTab === 'github' && (
        <div className="space-y-4">
          {fullStatus?.github ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Connected — @{fullStatus.github.accountName}</p>
                      {fullStatus.github.lastSyncedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last synced {formatRelativeTime(fullStatus.github.lastSyncedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-8 px-3">
                      Active
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={async () => {
                        await disconnectGithub()
                        toast.success('GitHub disconnected')
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Connect GitHub</CardTitle>
                <CardDescription>
                  Track development velocity — commits, PRs, and code reviews are scored on the
                  leaderboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Each founder on your team should connect their own GitHub account. Contributions
                  are averaged per founder for fair scoring.
                </p>
                <a
                  href="/api/integrations/github/authorize"
                  className="inline-flex items-center gap-2 rounded-md bg-[#24292f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#24292f]/90 transition-colors"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </a>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How GitHub Scoring Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Your Git Velocity score is calculated from the last 4 weeks of activity:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between bg-muted px-3 py-2">
                  <span>Commit</span>
                  <span className="font-mono font-medium">10 pts</span>
                </div>
                <div className="flex justify-between bg-muted px-3 py-2">
                  <span>PR opened</span>
                  <span className="font-mono font-medium">25 pts</span>
                </div>
                <div className="flex justify-between bg-muted px-3 py-2">
                  <span>PR merged</span>
                  <span className="font-mono font-medium">50 pts</span>
                </div>
                <div className="flex justify-between bg-muted px-3 py-2">
                  <span>PR review</span>
                  <span className="font-mono font-medium">30 pts</span>
                </div>
              </div>
              <p>For startups with multiple founders, the velocity score is averaged per person.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Social Tab ────────────────────────────────────── */}
      {activeTab === 'social' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Profiles</CardTitle>
              <CardDescription>
                Add your handles — follower growth and engagement are tracked daily for the
                leaderboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Twitter / X */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">X (Twitter)</h3>
                  {savingSocial === 'twitter' && (
                    <span className="text-xs text-muted-foreground">Saving...</span>
                  )}
                  {savedSocial === 'twitter' && (
                    <span className="text-xs text-green-600">Saved</span>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="flex h-9 items-center border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    placeholder="yourhandle"
                    className="border-l-0"
                    defaultValue={
                      fullStatus?.social?.find((p) => p.platform === 'twitter')?.handle ?? ''
                    }
                    onBlur={(e) => handleSocialBlur('twitter', e.target.value)}
                  />
                </div>
                {fullStatus?.social?.find((p) => p.platform === 'twitter') && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Tracking @{fullStatus.social.find((p) => p.platform === 'twitter')?.handle}
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">LinkedIn</h3>
                  {savingSocial === 'linkedin' && (
                    <span className="text-xs text-muted-foreground">Saving...</span>
                  )}
                  {savedSocial === 'linkedin' && (
                    <span className="text-xs text-green-600">Saved</span>
                  )}
                </div>
                <Input
                  placeholder="company-slug or full URL"
                  defaultValue={
                    fullStatus?.social?.find((p) => p.platform === 'linkedin')?.handle ?? ''
                  }
                  onBlur={(e) => handleSocialBlur('linkedin', e.target.value)}
                />
                {fullStatus?.social?.find((p) => p.platform === 'linkedin') && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Tracking {fullStatus.social.find((p) => p.platform === 'linkedin')?.handle}
                  </div>
                )}
              </div>

              {/* Instagram */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Instagram</h3>
                  {savingSocial === 'instagram' && (
                    <span className="text-xs text-muted-foreground">Saving...</span>
                  )}
                  {savedSocial === 'instagram' && (
                    <span className="text-xs text-green-600">Saved</span>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="flex h-9 items-center border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    placeholder="yourhandle"
                    className="border-l-0"
                    defaultValue={
                      fullStatus?.social?.find((p) => p.platform === 'instagram')?.handle ?? ''
                    }
                    onBlur={(e) => handleSocialBlur('instagram', e.target.value)}
                  />
                </div>
                {fullStatus?.social?.find((p) => p.platform === 'instagram') && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Tracking @{fullStatus.social.find((p) => p.platform === 'instagram')?.handle}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              <p>
                No login required — we scrape public profile data daily using Apify. Follower growth
                and engagement rate are tracked week-over-week for the leaderboard.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
