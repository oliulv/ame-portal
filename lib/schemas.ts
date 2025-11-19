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
