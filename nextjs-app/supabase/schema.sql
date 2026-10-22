-- ============================================================
-- MyWaySplit Multi-Tenant SaaS Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- If you want a 100% fresh clean setup (wipes any old single-user test tables),
-- you can uncomment the line below:
-- DROP TABLE IF EXISTS expenses, group_members, groups, profiles, notifications, notification_log, participants, loan_applications, loan_products, lenders CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USER PROFILES (Linked to Supabase Auth)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  upi_id TEXT,               -- e.g. "rahul@okhdfcbank"
  phone TEXT,                -- e.g. "+919876543210"
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to auto-create profile on Supabase auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/initials/svg?seed=' || NEW.id)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. MULTI-TENANT GROUPS (Expense Sheets)
-- ============================================================

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 8),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);

-- ============================================================
-- 3. GROUP MEMBERS (Roles: admin, member)
-- ============================================================

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

-- ============================================================
-- 4. EXPENSES (With Selective Inclusion/Exclusion & Categories)
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_by UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  split_among UUID[] DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Self-healing migration for existing databases:
-- Add columns if expenses table was already created in earlier versions
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS split_among UUID[] DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_expenses_group_created ON expenses(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_group_active ON expenses(group_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ============================================================
-- 5. IN-APP NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration columns for notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Notification log table for delivery tracking
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_participant_id UUID,
  sender_participant_id UUID,
  notification_type TEXT,
  message TEXT,
  onesignal_notification_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. LOAN MARKETPLACE
-- ============================================================

CREATE TABLE IF NOT EXISTS lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  description TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  registration_number TEXT,
  password_hash TEXT NOT NULL DEFAULT 'hash_placeholder',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  min_amount NUMERIC(12, 2) NOT NULL DEFAULT 10000,
  max_amount NUMERIC(12, 2) NOT NULL DEFAULT 500000,
  interest_rate_annual NUMERIC(5, 2) NOT NULL DEFAULT 12.0,
  tenure_months_min INTEGER DEFAULT 3,
  tenure_months_max INTEGER DEFAULT 36,
  processing_fee_percent NUMERIC(5, 2) DEFAULT 1.5,
  description TEXT,
  eligibility_criteria TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id UUID,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  loan_product_id UUID NOT NULL REFERENCES loan_products(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  applicant_email TEXT,
  requested_amount NUMERIC(12, 2) NOT NULL CHECK (requested_amount >= 10000),
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. 30-DAY EXPENSE RETENTION & ARCHIVING LOGIC
-- ============================================================

CREATE OR REPLACE FUNCTION archive_old_expenses()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE expenses
  SET is_archived = true,
      archived_at = now()
  WHERE is_archived = false
    AND created_at < (now() - INTERVAL '30 days');

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if user is active member of group
CREATE OR REPLACE FUNCTION is_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper security function: Check if user is group admin
CREATE OR REPLACE FUNCTION is_group_admin(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND role = 'admin'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- GROUPS POLICIES
DROP POLICY IF EXISTS "groups_select_members" ON groups;
CREATE POLICY "groups_select_members" ON groups FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    is_group_member(id, auth.uid()) OR
    created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "groups_insert_auth" ON groups;
CREATE POLICY "groups_insert_auth" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "groups_update_admin" ON groups;
CREATE POLICY "groups_update_admin" ON groups FOR UPDATE USING (is_group_admin(id, auth.uid()));

DROP POLICY IF EXISTS "groups_delete_admin" ON groups;
CREATE POLICY "groups_delete_admin" ON groups FOR DELETE USING (is_group_admin(id, auth.uid()));

-- GROUP MEMBERS POLICIES
DROP POLICY IF EXISTS "group_members_select" ON group_members;
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  is_group_member(group_id, auth.uid()) OR
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "group_members_insert" ON group_members;
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (
  is_group_admin(group_id, auth.uid()) OR
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "group_members_update_admin" ON group_members;
CREATE POLICY "group_members_update_admin" ON group_members FOR UPDATE USING (is_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "group_members_delete_admin_or_self" ON group_members;
CREATE POLICY "group_members_delete_admin_or_self" ON group_members FOR DELETE USING (
  is_group_admin(group_id, auth.uid()) OR
  user_id = auth.uid()
);

-- EXPENSES POLICIES (Strictly Multi-Tenant)
DROP POLICY IF EXISTS "expenses_select_group_members" ON expenses;
CREATE POLICY "expenses_select_group_members" ON expenses FOR SELECT USING (
  group_id IS NULL OR is_group_member(group_id, auth.uid())
);

DROP POLICY IF EXISTS "expenses_insert_group_members" ON expenses;
CREATE POLICY "expenses_insert_group_members" ON expenses FOR INSERT WITH CHECK (
  group_id IS NULL OR is_group_member(group_id, auth.uid())
);

DROP POLICY IF EXISTS "expenses_update_creator_or_admin" ON expenses;
CREATE POLICY "expenses_update_creator_or_admin" ON expenses FOR UPDATE USING (
  group_id IS NULL OR is_group_member(group_id, auth.uid())
);

DROP POLICY IF EXISTS "expenses_delete_creator_or_admin" ON expenses;
CREATE POLICY "expenses_delete_creator_or_admin" ON expenses FOR DELETE USING (
  group_id IS NULL OR is_group_member(group_id, auth.uid())
);

-- NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_all" ON notifications;
CREATE POLICY "notifications_insert_all" ON notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NOTIFICATION LOG POLICY
DROP POLICY IF EXISTS "notification_log_public" ON notification_log;
CREATE POLICY "notification_log_public" ON notification_log FOR ALL USING (true) WITH CHECK (true);

-- LOANS POLICIES
DROP POLICY IF EXISTS "lenders_select" ON lenders;
CREATE POLICY "lenders_select" ON lenders FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "loan_products_select" ON loan_products;
CREATE POLICY "loan_products_select" ON loan_products FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "loan_apps_insert" ON loan_applications;
CREATE POLICY "loan_apps_insert" ON loan_applications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "loan_apps_select_own" ON loan_applications;
CREATE POLICY "loan_apps_select_own" ON loan_applications FOR SELECT USING (
  applicant_user_id = auth.uid() OR applicant_user_id IS NULL
);
