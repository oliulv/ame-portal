import { z } from 'zod'

/**
 * Validation schema for cohorts
 */
export const cohortSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens only'),
    label: z.string().min(1, 'Label is required'),
    year_start: z.number().int().min(2020, 'Start year must be 2020 or later'),
    year_end: z.number().int().min(2020, 'End year must be 2020 or later'),
    is_active: z.boolean(),
  })
  .refine((data) => data.year_start <= data.year_end, {
    message: 'Start year must be before or equal to end year',
    path: ['year_end'],
  })

export type CohortFormData = z.infer<typeof cohortSchema>

/**
 * Validation schema for goal template success conditions
 */
const conditionSchema = z
  .object({
    dataSource: z.enum(['stripe', 'other']),
    metric: z.string().min(1, 'Metric is required'),
    operator: z.enum(['>=', '>', '=', '<=', '<', 'increased_by', 'decreased_by']),
    targetValue: z.number({ message: 'Target value is required' }),
    unit: z.string().min(1, 'Unit is required'),
  })
  .refine(
    (data) => {
      // For 'other' data source, allow any metric/unit
      if (data.dataSource === 'other') {
        return true
      }
      // For stripe, metric should be a valid identifier (alphanumeric with underscores)
      return /^[a-z0-9_]+$/.test(data.metric)
    },
    {
      message: 'Metric must be a valid identifier (lowercase letters, numbers, underscores)',
      path: ['metric'],
    }
  )

/**
 * Validation schema for goal templates with condition-based success criteria
 */
export const goalTemplateSchema = z.object({
  cohortId: z.string().uuid('Invalid cohort ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.enum(['launch', 'revenue', 'users', 'product', 'fundraising', 'growth', 'hiring']),
  deadline: z.string().optional(), // ISO date string
  isActive: z.boolean(),
  conditions: z.array(conditionSchema).min(1, 'At least one success condition is required'),
  fundingUnlocked: z.number().min(0).optional(),
})

export type GoalTemplateFormData = z.infer<typeof goalTemplateSchema>
export type GoalTemplateCondition = z.infer<typeof conditionSchema>

/**
 * Validation schema for startups
 */
export const startupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cohort_id: z.string().uuid('Invalid cohort ID'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only')
    .optional(),
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
  bankDetails: bankDetailsSchema.optional(),
})

export type CompleteOnboardingFormData = z.infer<typeof completeOnboardingSchema>

/**
 * Validation schema for updating founder personal info
 * Required fields must be provided, optional fields can be empty strings
 */
export const founderPersonalInfoUpdateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  personal_email: z.string().email('Invalid email address'),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  x_url: z.string().url('Invalid URL').optional().or(z.literal('')),
})

export type FounderPersonalInfoUpdateFormData = z.infer<typeof founderPersonalInfoUpdateSchema>

/**
 * Validation schema for updating startup details
 * Required fields must be provided, optional fields can be empty strings
 */
export const startupUpdateSchema = z.object({
  name: z.string().min(1, 'Startup name is required'),
  website_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  one_liner: z.string().max(100, 'Maximum 100 characters').optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  initial_customers: z.number().int().min(0, 'Must be 0 or greater').optional(),
  initial_revenue: z.number().min(0, 'Must be 0 or greater').optional(),
})

export type StartupUpdateFormData = z.infer<typeof startupUpdateSchema>

/**
 * Validation schema for founder invoice upload
 */
export const founderInvoiceUploadSchema = z.object({
  vendor_name: z.string().min(1, 'Vendor name is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  amount_gbp: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().optional(),
})

export type FounderInvoiceUploadFormData = z.infer<typeof founderInvoiceUploadSchema>

/**
 * Validation schema for integration connections
 */
export const integrationConnectionSchema = z.object({
  startup_id: z.string().uuid('Invalid startup ID'),
  provider: z.enum(['stripe']),
  account_id: z.string().optional(),
  account_name: z.string().optional(),
  status: z.enum(['active', 'error', 'disconnected']).default('active'),
  scopes: z.array(z.string()).optional(),
  is_active: z.boolean().default(true),
})

export type IntegrationConnectionFormData = z.infer<typeof integrationConnectionSchema>

/**
 * Validation schema for metrics data
 */
export const metricsDataSchema = z.object({
  startup_id: z.string().uuid('Invalid startup ID'),
  provider: z.enum(['stripe', 'manual', 'tracker']),
  metric_key: z.string().min(1, 'Metric key is required'),
  value: z.number(),
  timestamp: z.string().datetime(),
  window: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export type MetricsDataFormData = z.infer<typeof metricsDataSchema>

/**
 * Validation schema for metric-based goal updates
 */
export const metricGoalUpdateSchema = z.object({
  data_source: z.enum(['stripe', 'tracker']).optional(),
  metric_key: z.string().optional(),
  aggregation_window: z.enum(['daily', 'weekly', 'monthly']).optional(),
  target_value_metric: z.number().optional(),
  comparison_operator: z
    .enum(['>=', '>', '=', '<=', '<', 'increased_by', 'decreased_by'])
    .optional(),
  direction: z.enum(['up', 'down']).optional(),
})

export type MetricGoalUpdateFormData = z.infer<typeof metricGoalUpdateSchema>
