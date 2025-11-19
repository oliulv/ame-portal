// Database types (matching Supabase schema)

export type UserRole = 'admin' | 'founder'

export type OnboardingStatus = 'pending' | 'in_progress' | 'completed'

export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'waived'

export type InvoiceStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid'

export interface User {
  id: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Cohort {
  id: string
  name: string
  slug: string
  year_start: number
  year_end: number
  label: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Startup {
  id: string
  cohort_id: string
  name: string
  slug?: string
  logo_url?: string
  stage?: string
  sector?: string
  website_url?: string
  notes?: string
  onboarding_status: OnboardingStatus
  created_at: string
  updated_at: string
}

export interface FounderProfile {
  id: string
  user_id: string
  startup_id: string
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
  onboarding_status: OnboardingStatus
  created_at: string
  updated_at: string
}

export interface StartupProfile {
  id: string
  startup_id: string
  one_liner?: string
  description?: string
  company_url?: string
  product_url?: string
  industry?: string
  location?: string
  initial_customers?: number
  initial_revenue?: number
  created_at: string
  updated_at: string
}

export interface BankDetails {
  id: string
  startup_id: string
  account_holder_name: string
  sort_code: string
  account_number: string
  bank_name?: string
  verified: boolean
  created_at: string
  updated_at: string
}

export interface Invitation {
  id: string
  startup_id: string
  email: string
  full_name: string
  token: string
  role: 'founder'
  expires_at: string
  accepted_at?: string
  created_by_admin_id: string
  created_at: string
  updated_at: string
}

export interface GoalTemplate {
  id: string
  cohort_id: string
  title: string
  description?: string
  category?: string
  default_target_value?: number
  default_deadline?: string
  default_weight: number
  default_funding_amount?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StartupGoal {
  id: string
  startup_id: string
  goal_template_id?: string
  title: string
  description?: string
  category?: string
  target_value?: number
  deadline?: string
  weight: number
  funding_amount?: number
  status: GoalStatus
  progress_value: number
  manually_overridden: boolean
  created_at: string
  updated_at: string
}

export interface GoalUpdate {
  id: string
  startup_goal_id: string
  user_id: string
  previous_status?: GoalStatus
  new_status?: GoalStatus
  previous_progress?: number
  new_progress?: number
  comment?: string
  created_at: string
}

export interface Invoice {
  id: string
  startup_id: string
  uploaded_by_user_id: string
  vendor_name: string
  invoice_date: string
  due_date?: string
  amount_gbp: number
  category?: string
  description?: string
  file_path: string
  status: InvoiceStatus
  approved_by_admin_id?: string
  approved_at?: string
  paid_at?: string
  admin_comment?: string
  created_at: string
  updated_at: string
}

export interface StartupMetricManual {
  id: string
  startup_id: string
  metric_name: string
  metric_value: number
  created_at: string
  updated_at: string
}

