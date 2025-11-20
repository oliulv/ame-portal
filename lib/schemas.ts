import { z } from 'zod'

/**
 * Validation schema for cohorts
 */
export const cohortSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens only'),
  label: z.string().min(1, 'Label is required'),
  year_start: z
    .number()
    .int()
    .min(2020, 'Start year must be 2020 or later'),
  year_end: z
    .number()
    .int()
    .min(2020, 'End year must be 2020 or later'),
  is_active: z.boolean(),
}).refine(data => data.year_start <= data.year_end, {
  message: 'Start year must be before or equal to end year',
  path: ['year_end'],
})

export type CohortFormData = z.infer<typeof cohortSchema>

/**
 * Validation schema for goal templates
 */
export const goalTemplateSchema = z.object({
  cohort_id: z.string().uuid('Invalid cohort ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['launch', 'revenue', 'users', 'product', 'fundraising']),
  default_target_value: z.number().optional(),
  default_deadline: z.string().optional(), // ISO date string
  default_weight: z.number().int().min(1).max(10).optional(),
  default_funding_amount: z.number().min(0).optional(),
  is_active: z.boolean(),
})

export type GoalTemplateFormData = z.infer<typeof goalTemplateSchema>

/**
 * Validation schema for startups
 */
export const startupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cohort_id: z.string().uuid('Invalid cohort ID'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only').optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  sector: z.string().optional(),
  stage: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
})

export type StartupFormData = z.infer<typeof startupSchema>

/**
 * Validation schema for founder invitations
 */
export const invitationSchema = z.object({
  startup_id: z.string().uuid('Invalid startup ID'),
  full_name: z.string().min(1, 'Full name is required'),
  personal_email: z.string().email('Invalid email address'),
})

export type InvitationFormData = z.infer<typeof invitationSchema>

/**
 * Validation schema for founder onboarding - Personal Info
 */
export const founderPersonalInfoSchema = z.object({
  address_line1: z.string().min(1, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  postcode: z.string().min(1, 'Postcode is required'),
  country: z.string().min(1, 'Country is required'),
  phone: z.string().min(1, 'Phone number is required'),
  bio: z.string().optional(),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  x_url: z.string().url('Invalid URL').optional().or(z.literal('')),
})

export type FounderPersonalInfoFormData = z.infer<typeof founderPersonalInfoSchema>

/**
 * Validation schema for startup profile
 */
export const startupProfileSchema = z.object({
  one_liner: z.string().min(1, 'One-liner is required').max(100, 'Maximum 100 characters'),
  description: z.string().min(1, 'Description is required'),
  company_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  product_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().min(1, 'Industry is required'),
  location: z.string().min(1, 'Location is required'),
  initial_customers: z.number().int().min(0, 'Must be 0 or greater').optional(),
  initial_revenue: z.number().min(0, 'Must be 0 or greater').optional(),
})

export type StartupProfileFormData = z.infer<typeof startupProfileSchema>

/**
 * Validation schema for bank details
 */
export const bankDetailsSchema = z.object({
  account_holder_name: z.string().min(1, 'Account holder name is required'),
  sort_code: z.string().regex(/^\d{2}-\d{2}-\d{2}$/, 'Sort code must be in format XX-XX-XX'),
  account_number: z.string().regex(/^\d{8}$/, 'Account number must be 8 digits'),
  bank_name: z.string().optional(),
})

export type BankDetailsFormData = z.infer<typeof bankDetailsSchema>

/**
 * Complete onboarding schema (all steps combined)
 */
export const completeOnboardingSchema = z.object({
  founderInfo: founderPersonalInfoSchema,
  startupProfile: startupProfileSchema,
  bankDetails: bankDetailsSchema,
})

export type CompleteOnboardingFormData = z.infer<typeof completeOnboardingSchema>
