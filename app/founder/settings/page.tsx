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
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  founderPersonalInfoUpdateSchema,
  startupUpdateSchema,
  bankDetailsSchema,
  type FounderPersonalInfoUpdateFormData,
  type StartupUpdateFormData,
  type BankDetailsFormData,
} from '@/lib/schemas'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { User, Building2, CreditCard, Save, AlertCircle } from 'lucide-react'

type SettingsTab = 'personal' | 'startup' | 'bank'

interface FounderProfileData {
  founderProfile: {
    id: string
    full_name: string
    personal_email: string
    address_line1?: string
    address_line2?: string
    city?: string
    postcode?: string
    country?: string
    phone?: string
    bio?: string
    linkedin_url?: string
    x_url?: string
  }
  startup: {
    id: string
    name: string
    website_url?: string
  }
  startupProfile: {
    one_liner?: string
    description?: string
    company_url?: string
    product_url?: string
    industry?: string
    location?: string
    initial_customers?: number
    initial_revenue?: number
  } | null
  bankDetails: {
    account_holder_name: string
    sort_code: string
    account_number: string
    bank_name?: string
  } | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>('personal')
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<FounderProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/founder/profile')
        if (!response.ok) {
          throw new Error('Failed to load profile data')
        }
        const profileData = await response.json()
        setData(profileData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Personal info form
  const personalForm = useForm<FounderPersonalInfoUpdateFormData>({
    resolver: zodResolver(founderPersonalInfoUpdateSchema),
    defaultValues: {
      full_name: '',
      personal_email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      postcode: '',
      country: '',
      phone: '',
      bio: '',
      linkedin_url: '',
      x_url: '',
    },
  })

  // Startup form
  const startupForm = useForm<StartupUpdateFormData>({
    resolver: zodResolver(startupUpdateSchema),
    defaultValues: {
      name: '',
      website_url: '',
      one_liner: '',
      description: '',
      industry: '',
      location: '',
      initial_customers: undefined,
      initial_revenue: undefined,
    },
  })

  // Bank form
  const bankForm = useForm<BankDetailsFormData>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: {
      account_holder_name: '',
      sort_code: '',
      account_number: '',
      bank_name: '',
    },
  })

  // Populate forms when data loads
  useEffect(() => {
    if (data) {
      personalForm.reset({
        full_name: data.founderProfile.full_name,
        personal_email: data.founderProfile.personal_email,
        address_line1: data.founderProfile.address_line1 || '',
        address_line2: data.founderProfile.address_line2 || '',
        city: data.founderProfile.city || '',
        postcode: data.founderProfile.postcode || '',
        country: data.founderProfile.country || '',
        phone: data.founderProfile.phone || '',
        bio: data.founderProfile.bio || '',
        linkedin_url: data.founderProfile.linkedin_url || '',
        x_url: data.founderProfile.x_url || '',
      })

      startupForm.reset({
        name: data.startup.name,
        website_url: data.startup.website_url || '',
        one_liner: data.startupProfile?.one_liner || '',
        description: data.startupProfile?.description || '',
        industry: data.startupProfile?.industry || '',
        location: data.startupProfile?.location || '',
        initial_customers: data.startupProfile?.initial_customers,
        initial_revenue: data.startupProfile?.initial_revenue,
      })

      if (data.bankDetails) {
        bankForm.reset({
          account_holder_name: data.bankDetails.account_holder_name,
          sort_code: data.bankDetails.sort_code,
          account_number: data.bankDetails.account_number,
          bank_name: data.bankDetails.bank_name || '',
        })
      }
    }
  }, [data, personalForm, startupForm, bankForm])

  // Mutation hooks
  const updatePersonalMutation = useAppMutation({
    mutationFn: async (formData: FounderPersonalInfoUpdateFormData) => {
      const response = await fetch('/api/founder/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update personal information')
      }
      return response.json()
    },
    onSuccess: () => {
      router.refresh()
      // Refetch data
      fetch('/api/founder/profile')
        .then(res => res.json())
        .then(newData => setData(newData))
    },
  })

  const updateStartupMutation = useAppMutation({
    mutationFn: async (formData: StartupUpdateFormData) => {
      const response = await fetch('/api/founder/startup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update startup details')
      }
      return response.json()
    },
    onSuccess: () => {
      router.refresh()
      // Refetch data
      fetch('/api/founder/profile')
        .then(res => res.json())
        .then(newData => setData(newData))
    },
  })

  const updateBankMutation = useAppMutation({
    mutationFn: async (formData: BankDetailsFormData) => {
      const response = await fetch('/api/founder/bank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update bank details')
      }
      return response.json()
    },
    onSuccess: () => {
      router.refresh()
      // Refetch data
      fetch('/api/founder/profile')
        .then(res => res.json())
        .then(newData => setData(newData))
    },
  })

  const tabs: Array<{ key: SettingsTab; title: string; icon: typeof User }> = [
    { key: 'personal', title: 'Personal Information', icon: User },
    { key: 'startup', title: 'Startup Details', icon: Building2 },
    { key: 'bank', title: 'Bank Details', icon: CreditCard },
  ]

  if (isLoading) {
    return (
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
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your personal and business information</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error || 'Failed to load settings data'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your personal and business information</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.title}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Personal Information Tab */}
      {activeTab === 'personal' && (
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details and contact information</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...personalForm}>
              <form
                onSubmit={personalForm.handleSubmit((data) => updatePersonalMutation.mutate(data))}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={personalForm.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="personal_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={personalForm.control}
                  name="address_line1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={personalForm.control}
                  name="address_line2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2 (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={personalForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="postcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postcode</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={personalForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={personalForm.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={personalForm.control}
                    name="linkedin_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn URL (Optional)</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://linkedin.com/in/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="x_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>X (Twitter) URL (Optional)</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://x.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={updatePersonalMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updatePersonalMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Startup Details Tab */}
      {activeTab === 'startup' && (
        <Card>
          <CardHeader>
            <CardTitle>Startup Details</CardTitle>
            <CardDescription>Update your startup information and business details</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...startupForm}>
              <form
                onSubmit={startupForm.handleSubmit((data) => updateStartupMutation.mutate(data))}
                className="space-y-6"
              >
                <FormField
                  control={startupForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Startup Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>
                        The name of your startup or business
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={startupForm.control}
                  name="website_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={startupForm.control}
                  name="one_liner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>One-Liner</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={100} />
                      </FormControl>
                      <FormDescription>
                        A brief description of your startup (max 100 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={startupForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={6} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={startupForm.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={startupForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={startupForm.control}
                    name="initial_customers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Customers (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={startupForm.control}
                    name="initial_revenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Revenue (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateStartupMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateStartupMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Bank Details Tab */}
      {activeTab === 'bank' && (
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
            <CardDescription>Update your business bank account information</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...bankForm}>
              <form
                onSubmit={bankForm.handleSubmit((data) => updateBankMutation.mutate(data))}
                className="space-y-6"
              >
                <FormField
                  control={bankForm.control}
                  name="account_holder_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={bankForm.control}
                    name="sort_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="XX-XX-XX"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '')
                              if (value.length <= 6) {
                                const formatted = value.match(/.{1,2}/g)?.join('-') || value
                                field.onChange(formatted)
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>Format: XX-XX-XX</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={bankForm.control}
                    name="account_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="12345678"
                            maxLength={8}
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 8)
                              field.onChange(value)
                            }}
                          />
                        </FormControl>
                        <FormDescription>8 digits</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={bankForm.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateBankMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateBankMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

