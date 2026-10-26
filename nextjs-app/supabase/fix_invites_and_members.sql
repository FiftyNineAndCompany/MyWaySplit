-- ============================================================
-- MyWaySplit: Fix Invites, RLS Policies & Member Addition
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. FIX GROUPS RLS POLICY
-- Anyone with a valid invite code or any member/creator must be able to select the group!
DROP POLICY IF EXISTS "groups_select_members" ON groups;
DROP POLICY IF EXISTS "groups_select_public_or_members" ON groups;

CREATE POLICY "groups_select_public_or_members" ON groups FOR SELECT USING (
  invite_code IS NOT NULL OR
  (auth.uid() IS NOT NULL AND (
    is_group_member(id, auth.uid()) OR
    created_by = auth.uid()
  ))
);

-- 2. SECURE RPC FUNCTION: GET GROUP BY INVITE CODE
-- Runs with SECURITY DEFINER so anyone (even unauthenticated) can preview the group details
CREATE OR REPLACE FUNCTION get_group_by_invite(invite_code_param TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  invite_code TEXT,
  currency TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
) AS $$
  SELECT g.id, g.name, g.description, g.invite_code, g.currency, g.created_by, g.created_at
  FROM groups g
  WHERE g.invite_code = invite_code_param
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. SECURE RPC FUNCTION: JOIN GROUP BY INVITE CODE
-- Authenticated user joins the group via invite code
CREATE OR REPLACE FUNCTION join_group_by_invite(invite_code_param TEXT)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT
) AS $$
DECLARE
  target_group_id UUID;
  target_group_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to join a group.';
  END IF;

  SELECT g.id, g.name INTO target_group_id, target_group_name
  FROM groups g
  WHERE g.invite_code = invite_code_param
  LIMIT 1;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Group with this invite code was not found or has expired.';
  END IF;

  INSERT INTO group_members (group_id, user_id, role, status)
  VALUES (target_group_id, auth.uid(), 'member', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET status = 'active';

  RETURN QUERY SELECT target_group_id, target_group_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FIX GROUP ADMIN CHECK FUNCTION
-- Group creator is ALWAYS an admin, even before explicit group_members sync
CREATE OR REPLACE FUNCTION is_group_admin(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups
    WHERE id = check_group_id AND created_by = check_user_id
  ) OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND role = 'admin'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. FIX GROUP MEMBERS POLICIES
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
  is_group_admin(group_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid())
);

-- 6. ENSURE PARTICIPANTS TABLE EXISTS & HAS group_id
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  upi_id TEXT,
  phone TEXT,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE participants ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Allow reading and writing participants for group members
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participants_select" ON participants;
CREATE POLICY "participants_select" ON participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "participants_all" ON participants;
CREATE POLICY "participants_all" ON participants FOR ALL USING (true) WITH CHECK (true);

-- 7. RE-CHECK PROFILES RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
