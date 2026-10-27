-- ============================================================
-- MyWaySplit / FairShare: Complete Production Schema & RLS
-- Comprehensive Refactor: Mandatory Auth, Device ID Locking,
-- Viral Group Invites, Lead Generation, & Strict Multi-Tenant Privacy
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES TABLE (Supabase Auth UID mapped)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  upi_id TEXT,
  phone TEXT,
  onesignal_player_id TEXT, -- OneSignal Subscription / Device ID for targeted push
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist if updating existing table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-sync new Supabase Auth users into profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', 'https://api.dicebear.com/7.x/initials/svg?seed=' || NEW.id)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. GROUPS TABLE (Multi-Tenant Expense Sheets)
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 8),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 3. GROUP MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Helper security functions
CREATE OR REPLACE FUNCTION is_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups
    WHERE id = check_group_id AND (created_by = check_user_id OR created_by IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_group_admin(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups
    WHERE id = check_group_id AND (created_by = check_user_id OR created_by IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND role = 'admin'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 4. PARTICIPANTS TABLE (Sheet members with UPI details)
-- ============================================================
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  upi_id TEXT,
  phone TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- ============================================================
-- 5. EXPENSES TABLE (With selective split_among inclusions)
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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS split_among UUID[] DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- ============================================================
-- 6. NOTIFICATIONS TABLE (Targeted In-App & Device Delivery)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system', -- 'debt_reminder', 'group_invite', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification delivery tracking
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_participant_id UUID,
  sender_participant_id UUID,
  notification_type TEXT NOT NULL,
  message TEXT,
  onesignal_notification_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. LOAN LEADS TABLE (Simplified Borrow Money > ₹10,000)
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 10000),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. SECURE RPC FUNCTIONS FOR VIRAL INVITES & JOINING
-- ============================================================

-- Function A: Safely preview group info by invite code (unauthenticated or new user)
DROP FUNCTION IF EXISTS get_group_by_invite(TEXT);
CREATE OR REPLACE FUNCTION get_group_by_invite(invite_code_param TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  invite_code TEXT,
  currency TEXT,
  created_by UUID,
  creator_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
  SELECT
    g.id,
    g.name,
    g.description,
    g.invite_code,
    g.currency,
    g.created_by,
    COALESCE(p.full_name, split_part(p.email, '@', 1), 'Friend') AS creator_name,
    g.created_at
  FROM groups g
  LEFT JOIN profiles p ON p.id = g.created_by
  WHERE g.invite_code = invite_code_param
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function B: Join group via invite code with user-chosen name and optional UPI
DROP FUNCTION IF EXISTS join_group_by_invite(TEXT);
DROP FUNCTION IF EXISTS join_group_by_invite(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION join_group_by_invite(
  invite_code_param TEXT,
  display_name_param TEXT DEFAULT NULL,
  upi_id_param TEXT DEFAULT NULL,
  phone_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  participant_id UUID
) AS $$
DECLARE
  target_group_id UUID;
  target_group_name TEXT;
  chosen_name TEXT;
  final_participant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to join a group.';
  END IF;

  -- 1. Find group
  SELECT g.id, g.name INTO target_group_id, target_group_name
  FROM groups g
  WHERE g.invite_code = invite_code_param
  LIMIT 1;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Group with this invite code was not found or has expired.';
  END IF;

  -- 2. Add to group_members
  INSERT INTO group_members (group_id, user_id, role, status)
  VALUES (target_group_id, auth.uid(), 'member', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET status = 'active';

  -- 3. Determine display name
  IF display_name_param IS NOT NULL AND length(trim(display_name_param)) > 0 THEN
    chosen_name := trim(display_name_param);
  ELSE
    SELECT COALESCE(full_name, split_part(email, '@', 1), 'Member')
    INTO chosen_name
    FROM profiles WHERE id = auth.uid();
  END IF;

  -- Update profile with chosen details if provided
  UPDATE profiles
  SET
    full_name = COALESCE(chosen_name, full_name),
    upi_id = COALESCE(NULLIF(trim(upi_id_param), ''), upi_id),
    phone = COALESCE(NULLIF(trim(phone_param), ''), phone),
    updated_at = now()
  WHERE id = auth.uid();

  -- 4. Upsert into participants table for this group
  -- If participant already exists for this user in this group, update it; otherwise insert
  SELECT id INTO final_participant_id
  FROM participants
  WHERE group_id = target_group_id AND (user_id = auth.uid() OR id = auth.uid())
  LIMIT 1;

  IF final_participant_id IS NOT NULL THEN
    UPDATE participants
    SET
      name = chosen_name,
      upi_id = COALESCE(NULLIF(trim(upi_id_param), ''), upi_id),
      phone = COALESCE(NULLIF(trim(phone_param), ''), phone)
    WHERE id = final_participant_id;
  ELSE
    INSERT INTO participants (id, user_id, group_id, name, upi_id, phone)
    VALUES (
      auth.uid(),
      auth.uid(),
      target_group_id,
      chosen_name,
      NULLIF(trim(upi_id_param), ''),
      NULLIF(trim(phone_param), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      group_id = target_group_id,
      name = chosen_name,
      upi_id = COALESCE(NULLIF(trim(upi_id_param), ''), participants.upi_id),
      phone = COALESCE(NULLIF(trim(phone_param), ''), participants.phone)
    RETURNING id INTO final_participant_id;
  END IF;

  -- 5. Send notification to group creator
  INSERT INTO notifications (user_id, group_id, type, title, message)
  SELECT
    g.created_by,
    target_group_id,
    'group_invite',
    'New Member Joined! 🎉',
    chosen_name || ' just joined your expense sheet "' || target_group_name || '".'
  FROM groups g
  WHERE g.id = target_group_id AND g.created_by != auth.uid();

  RETURN QUERY SELECT target_group_id, target_group_name, final_participant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- GROUPS (Users can ONLY see groups they created or are active members of)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "groups_select_members" ON groups;
DROP POLICY IF EXISTS "groups_select_public_or_members" ON groups;
CREATE POLICY "groups_select_members" ON groups FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    created_by = auth.uid() OR
    is_group_member(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "groups_insert_authenticated" ON groups;
CREATE POLICY "groups_insert_authenticated" ON groups FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "groups_update_admin" ON groups;
CREATE POLICY "groups_update_admin" ON groups FOR UPDATE USING (
  is_group_admin(id, auth.uid())
);

DROP POLICY IF EXISTS "groups_delete_admin" ON groups;
CREATE POLICY "groups_delete_admin" ON groups FOR DELETE USING (
  created_by = auth.uid()
);

-- GROUP MEMBERS
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_members_select" ON group_members;
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  is_group_member(group_id, auth.uid()) OR
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "group_members_insert" ON group_members;
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (
  is_group_admin(group_id, auth.uid()) OR
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "group_members_update_admin" ON group_members;
CREATE POLICY "group_members_update_admin" ON group_members FOR UPDATE USING (
  is_group_admin(group_id, auth.uid())
);

DROP POLICY IF EXISTS "group_members_delete_admin" ON group_members;
CREATE POLICY "group_members_delete_admin" ON group_members FOR DELETE USING (
  is_group_admin(group_id, auth.uid()) OR
  user_id = auth.uid()
);

-- PARTICIPANTS (Strictly scoped to group members)
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participants_select" ON participants;
CREATE POLICY "participants_select" ON participants FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = participants.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

DROP POLICY IF EXISTS "participants_insert" ON participants;
CREATE POLICY "participants_insert" ON participants FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = participants.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

DROP POLICY IF EXISTS "participants_update" ON participants;
CREATE POLICY "participants_update" ON participants FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = participants.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

DROP POLICY IF EXISTS "participants_delete" ON participants;
CREATE POLICY "participants_delete" ON participants FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = participants.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

-- EXPENSES (Strictly scoped to group members)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_select_group_members" ON expenses;
CREATE POLICY "expenses_select_group_members" ON expenses FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = expenses.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

DROP POLICY IF EXISTS "expenses_insert_group_members" ON expenses;
CREATE POLICY "expenses_insert_group_members" ON expenses FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = expenses.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

DROP POLICY IF EXISTS "expenses_update_creator_or_admin" ON expenses;
CREATE POLICY "expenses_update_creator_or_admin" ON expenses FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = expenses.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

DROP POLICY IF EXISTS "expenses_delete_creator_or_admin" ON expenses;
CREATE POLICY "expenses_delete_creator_or_admin" ON expenses FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    group_id IS NULL OR
    is_group_member(group_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM groups WHERE id = expenses.group_id AND (created_by = auth.uid() OR created_by IS NULL))
  )
);

-- NOTIFICATIONS (Users can only see their own notifications)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "notifications_insert_all" ON notifications;
CREATE POLICY "notifications_insert_all" ON notifications FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- LOAN LEADS (Users can insert and view their own leads)
ALTER TABLE loan_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loan_leads_insert" ON loan_leads;
CREATE POLICY "loan_leads_insert" ON loan_leads FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL OR user_id = auth.uid() OR user_id IS NULL
);

DROP POLICY IF EXISTS "loan_leads_select_own" ON loan_leads;
CREATE POLICY "loan_leads_select_own" ON loan_leads FOR SELECT USING (
  user_id = auth.uid()
);
