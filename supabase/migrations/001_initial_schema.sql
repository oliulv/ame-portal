-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (maps to Clerk user IDs)
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- Clerk user ID
  role TEXT NOT NULL CHECK (role IN ('admin', 'founder')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cohorts table
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,
  label TEXT NOT NULL, -- e.g. "Cohort 12"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Startups table
CREATE TABLE startups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  logo_url TEXT,
  stage TEXT,
  sector TEXT,
  website_url TEXT,
  notes TEXT,
  onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Founder profiles table
CREATE TABLE founder_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  personal_email TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT,
  phone TEXT,
  bio TEXT,
  linkedin_url TEXT,
  x_url TEXT,
  onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, startup_id)
);

-- Startup profiles table
CREATE TABLE startup_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID NOT NULL UNIQUE REFERENCES startups(id) ON DELETE CASCADE,
  one_liner TEXT,
  description TEXT,
  company_url TEXT,
  product_url TEXT,
  industry TEXT,
  location TEXT,
  initial_customers INTEGER,
  initial_revenue DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank details table
CREATE TABLE bank_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID NOT NULL UNIQUE REFERENCES startups(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  sort_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'founder' CHECK (role = 'founder'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by_admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);

-- Goal templates table
CREATE TABLE goal_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  default_target_value DECIMAL(12, 2),
  default_deadline DATE,
  default_weight INTEGER DEFAULT 1,
  default_funding_amount DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Startup goals table
CREATE TABLE startup_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  goal_template_id UUID REFERENCES goal_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  target_value DECIMAL(12, 2),
  deadline DATE,
  weight INTEGER DEFAULT 1,
  funding_amount DECIMAL(12, 2),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'waived')),
  progress_value DECIMAL(12, 2) DEFAULT 0,
  manually_overridden BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_startup_goals_startup_id ON startup_goals(startup_id);

-- Goal updates table (audit log)
CREATE TABLE goal_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_goal_id UUID NOT NULL REFERENCES startup_goals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_status TEXT,
  new_status TEXT,
  previous_progress DECIMAL(12, 2),
  new_progress DECIMAL(12, 2),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_goal_updates_startup_goal_id ON goal_updates(startup_goal_id);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vendor_name TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount_gbp DECIMAL(12, 2) NOT NULL,
  category TEXT,
  description TEXT,
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'paid')),
  approved_by_admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  admin_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invoices_startup_id ON invoices(startup_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Manual metrics table (for Phase 1 leaderboard)
CREATE TABLE startup_metrics_manual (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL, -- e.g. 'manual_revenue', 'manual_visitors'
  metric_value DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(startup_id, metric_name)
);

CREATE INDEX idx_startup_metrics_manual_startup_id ON startup_metrics_manual(startup_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cohorts_updated_at BEFORE UPDATE ON cohorts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_startups_updated_at BEFORE UPDATE ON startups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_founder_profiles_updated_at BEFORE UPDATE ON founder_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_startup_profiles_updated_at BEFORE UPDATE ON startup_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_details_updated_at BEFORE UPDATE ON bank_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goal_templates_updated_at BEFORE UPDATE ON goal_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_startup_goals_updated_at BEFORE UPDATE ON startup_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_startup_metrics_manual_updated_at BEFORE UPDATE ON startup_metrics_manual
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

