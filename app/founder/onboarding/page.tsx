'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
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
  founderPersonalInfoSchema,
  startupProfileSchema,
  bankDetailsSchema,
  type FounderPersonalInfoFormData,
  type StartupProfileFormData,
  type BankDetailsFormData,
} from '@/lib/schemas'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type OnboardingStep = 'personal' | 'startup' | 'bank'

/** Map snake_case form fields to camelCase for Convex. */
function mapPersonalInfo(data: FounderPersonalInfoFormData) {
  return {
    addressLine1: data.address_line1,
    addressLine2: data.address_line2 || undefined,
    city: data.city,
    postcode: data.postcode,
    country: data.country,
    phone: data.phone,
    bio: data.bio || undefined,
    linkedinUrl: data.linkedin_url || undefined,
    xUrl: data.x_url || undefined,
  }
}

function mapStartupProfile(data: StartupProfileFormData) {
  return {
    oneLiner: data.one_liner,
    description: data.description,
    companyUrl: data.company_url || undefined,
    productUrl: data.product_url || undefined,
    industry: data.industry,
    location: data.location,
    initialCustomers: data.initial_customers,
    initialRevenue: data.initial_revenue,
  }
}

function mapBankDetails(data: BankDetailsFormData) {
  return {
    accountHolderName: data.account_holder_name,
    sortCode: data.sort_code,
    accountNumber: data.account_number,
    bankName: data.bank_name || undefined,
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('personal')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBankSkipWarning, setShowBankSkipWarning] = useState(false)

  // Store completed step data
  const [personalData, setPersonalData] = useState<FounderPersonalInfoFormData | null>(null)
  const [startupData, setStartupData] = useState<StartupProfileFormData | null>(null)

  // Convex queries and mutations
  const bankStatusResult = useQuery(api.founderOnboarding.bankStatus)
  const completeOnboarding = useMutation(api.founderOnboarding.complete)

  const hasBankDetails = bankStatusResult?.hasBankDetails ?? null
  const isCheckingBankStatus = bankStatusResult === undefined

  // Forms for each step
  const personalForm = useForm<FounderPersonalInfoFormData>({
    resolver: zodResolver(founderPersonalInfoSchema),
    defaultValues: {
      address_line1: '',
      address_line2: '',
      city: '',
      postcode: '',
      country: 'United Kingdom',
      phone: '',
      bio: '',
      linkedin_url: '',
      x_url: '',
    },
  })

  const startupForm = useForm<StartupProfileFormData>({
    resolver: zodResolver(startupProfileSchema),
    defaultValues: {
      one_liner: '',
      description: '',
      company_url: '',
      product_url: '',
      industry: '',
      location: 'Manchester, UK',
      initial_customers: undefined,
      initial_revenue: undefined,
    },
  })

  const bankForm = useForm<BankDetailsFormData>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: {
      account_holder_name: '',
      sort_code: '',
      account_number: '',
      bank_name: '',
    },
  })

  const steps: Array<{ key: OnboardingStep; title: string; description: string }> = [
    { key: 'personal', title: 'Personal Information', description: 'Tell us about yourself' },
    { key: 'startup', title: 'Startup Profile', description: 'Tell us about your startup' },
    { key: 'bank', title: 'Bank Details', description: 'Add your payment information' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep)

  // Determine step states
  const getStepState = (index: number) => {
    if (index < currentStepIndex) return 'completed'
    if (index === currentStepIndex) return 'current'
    // Bank step is pre-completed if startup already has bank details
    if (steps[index].key === 'bank' && hasBankDetails === true) return 'completed'
    return 'upcoming'
  }

  async function handlePersonalNext(data: FounderPersonalInfoFormData) {
    setPersonalData(data)
    setCurrentStep('startup')
  }

  async function handleStartupNext(data: StartupProfileFormData) {
    setStartupData(data)
    // Skip bank step if bank details already exist
    if (hasBankDetails === true) {
      await submitOnboarding(data, undefined)
    } else {
      setCurrentStep('bank')
    }
  }

  async function submitOnboarding(
    startup: StartupProfileFormData,
    bank: BankDetailsFormData | undefined
  ) {
    if (!personalData) {
      setError('Please complete all previous steps')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await completeOnboarding({
        founderInfo: mapPersonalInfo(personalData),
        startupProfile: mapStartupProfile(startup),
        bankDetails: bank ? mapBankDetails(bank) : undefined,
      })

      toast.success('Onboarding completed!')
      router.push('/founder/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleBankSubmit(data: BankDetailsFormData) {
    if (!startupData) {
      setError('Please complete all previous steps')
      return
    }
    await submitOnboarding(startupData, data)
  }

  function handleSkipBank() {
    if (!startupData) {
      setError('Please complete all previous steps')
      return
    }
    setShowBankSkipWarning(true)
  }

  async function confirmSkipBank() {
    if (!startupData) return
    setShowBankSkipWarning(false)
    await submitOnboarding(startupData, undefined)
  }

  function handleBack() {
    if (currentStep === 'startup') {
      setCurrentStep('personal')
    } else if (currentStep === 'bank') {
      setCurrentStep('startup')
    }
  }

  return (
    <div className="py-6">
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display mb-2">Welcome to Accelerate ME!</h1>
          <p className="text-muted-foreground">
            Let's get you set up. This should only take a few minutes.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="relative flex items-start justify-between">
            {/* Connecting Lines Background */}
            <div className="absolute top-5 left-[16.67%] right-[16.67%] h-0.5 bg-muted-foreground/20" />

            {/* Completed Progress Line */}
            {currentStepIndex > 0 && (
              <div
                className="absolute top-5 left-[16.67%] h-0.5 bg-primary transition-all duration-300"
                style={{
                  width: `${(currentStepIndex / (steps.length - 1)) * 66.66}%`,
                }}
              />
            )}

            {/* Steps */}
            {steps.map((step, index) => {
              const state = getStepState(index)
              const isCompleted = state === 'completed'
              const isCurrent = state === 'current'

              return (
                <div key={step.key} className="relative z-10 flex flex-col items-center flex-1">
                  {/* Step Circle */}
                  <div className="bg-background p-1">
                    <div
                      className={`flex h-10 w-10 items-center justify-center border-2 transition-all ${
                        isCompleted
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isCurrent
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground/50'
                      }`}
                    >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span
                        className={`text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-muted-foreground/50'}`}
                      >
                        {index + 1}
                      </span>
                    )}
                    </div>
                  </div>

                  {/* Step Label */}
                  <div className="mt-3 text-center max-w-[140px]">
                    <div
                      className={`text-sm font-medium ${
                        isCompleted || isCurrent ? 'text-primary' : 'text-muted-foreground/50'
                      }`}
                    >
                      {step.title}
                    </div>
                    <div
                      className={`mt-1 text-xs ${
                        isCompleted || isCurrent
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/40'
                      }`}
                    >
                      {step.description}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        )}

        {/* Step 1: Personal Information */}
        {currentStep === 'personal' && (
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>We need your contact details and address</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...personalForm}>
                <form
                  onSubmit={personalForm.handleSubmit(handlePersonalNext)}
                  className="space-y-6"
                >
                  <FormField
                    control={personalForm.control}
                    name="address_line1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} />
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
                          <Input placeholder="Apartment, suite, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={personalForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="London" {...field} />
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
                            <Input placeholder="SW1A 1AA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={personalForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="United Kingdom" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+44 7700 900000" {...field} />
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
                          <Textarea
                            placeholder="Tell us a bit about yourself..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Share your background, expertise, or what you're passionate about
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={personalForm.control}
                    name="linkedin_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://linkedin.com/in/yourprofile" {...field} />
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
                          <Input placeholder="https://x.com/yourhandle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit">
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Startup Profile */}
        {currentStep === 'startup' && (
          <Card>
            <CardHeader>
              <CardTitle>Startup Profile</CardTitle>
              <CardDescription>Tell us about your startup</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...startupForm}>
                <form onSubmit={startupForm.handleSubmit(handleStartupNext)} className="space-y-6">
                  <FormField
                    control={startupForm.control}
                    name="one_liner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>One-Liner</FormLabel>
                        <FormControl>
                          <Input placeholder="We help X do Y by Z" maxLength={100} {...field} />
                        </FormControl>
                        <FormDescription>
                          A short, punchy description of what your startup does (max 100 characters)
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
                          <Textarea
                            placeholder="Provide a detailed description of your startup, the problem you're solving, and your solution..."
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={startupForm.control}
                      name="company_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Website (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://yourcompany.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={startupForm.control}
                      name="product_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product URL (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://app.yourproduct.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={startupForm.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., FinTech, HealthTech, SaaS" {...field} />
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
                            <Input placeholder="e.g., London, UK" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={startupForm.control}
                      name="initial_customers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Customers (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const value = e.target.value
                                field.onChange(value === '' ? undefined : parseInt(value))
                              }}
                            />
                          </FormControl>
                          <FormDescription>Number of customers at program start</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={startupForm.control}
                      name="initial_revenue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Revenue (GBP, Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const value = e.target.value
                                field.onChange(value === '' ? undefined : parseFloat(value))
                              }}
                            />
                          </FormControl>
                          <FormDescription>Monthly revenue at program start</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={handleBack}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit">
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Bank Details */}
        {currentStep === 'bank' && !isCheckingBankStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <CardDescription>
                Add your bank account details to receive funding disbursements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasBankDetails === false && (
                <div className="mb-6 bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm text-amber-900">
                      <p className="font-medium mb-1">Bank details not set up yet</p>
                      <p className="text-amber-800">
                        You haven't set up bank details for your startup. Only one founder needs to
                        complete this step - once one founder adds the bank details, other founders
                        won't need to.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <Form {...bankForm}>
                <form onSubmit={bankForm.handleSubmit(handleBankSubmit)} className="space-y-6">
                  <FormField
                    control={bankForm.control}
                    name="account_holder_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Holder Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormDescription>Name as it appears on the bank account</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={bankForm.control}
                      name="sort_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sort Code</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="12-34-56"
                              {...field}
                              onChange={(e) => {
                                // Auto-format sort code
                                let value = e.target.value.replace(/\D/g, '')
                                if (value.length > 2)
                                  value = value.slice(0, 2) + '-' + value.slice(2)
                                if (value.length > 5)
                                  value = value.slice(0, 5) + '-' + value.slice(5, 7)
                                field.onChange(value)
                              }}
                            />
                          </FormControl>
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
                                // Only allow digits
                                const value = e.target.value.replace(/\D/g, '').slice(0, 8)
                                field.onChange(value)
                              }}
                            />
                          </FormControl>
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
                          <Input placeholder="e.g., Barclays, HSBC, Lloyds" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-blue-50 p-4 text-sm text-blue-900">
                    <p className="font-medium mb-1">Your data is secure</p>
                    <p className="text-blue-800">
                      Your bank details are encrypted and stored securely. They will only be used
                      for legitimate funding disbursements.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={handleBack}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSkipBank}
                      disabled={isSubmitting}
                    >
                      Skip for Now
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Completing...' : 'Complete Onboarding'}
                      {!isSubmitting && <Check className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
        {/* Bank Skip Warning Dialog */}
        <Dialog open={showBankSkipWarning} onOpenChange={setShowBankSkipWarning}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bank details required for funding</DialogTitle>
              <DialogDescription>
                You can complete onboarding without bank details, but you won&apos;t be able to
                receive any funding disbursements until you set them up in Settings.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBankSkipWarning(false)}>
                Go Back
              </Button>
              <Button onClick={confirmSkipBank} disabled={isSubmitting}>
                {isSubmitting ? 'Completing...' : 'Continue Without Bank Details'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
