-- ============================================================
-- MyWaySplit: Run this in your Supabase SQL Editor
-- Dashboard URL: https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. ADD onesignal_player_id TO PROFILES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. CREATE LOAN LEADS TABLE
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

ALTER TABLE loan_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loan_leads_insert" ON loan_leads;
CREATE POLICY "loan_leads_insert" ON loan_leads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "loan_leads_select_own" ON loan_leads;
CREATE POLICY "loan_leads_select_own" ON loan_leads FOR SELECT USING (user_id = auth.uid());

-- 3. ENSURE PARTICIPANTS HAS ALL COLUMNS
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

-- 4. RPC: GET GROUP BY INVITE CODE (SECURITY DEFINER)
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

-- 5. RPC: JOIN GROUP BY INVITE CODE WITH DISPLAY NAME
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

  SELECT g.id, g.name INTO target_group_id, target_group_name
  FROM groups g
  WHERE g.invite_code = invite_code_param
  LIMIT 1;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Group with this invite code was not found or has expired.';
  END IF;

  -- Add to group_members
  INSERT INTO group_members (group_id, user_id, role, status)
  VALUES (target_group_id, auth.uid(), 'member', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET status = 'active';

  -- Determine display name
  IF display_name_param IS NOT NULL AND length(trim(display_name_param)) > 0 THEN
    chosen_name := trim(display_name_param);
  ELSE
    SELECT COALESCE(full_name, split_part(email, '@', 1), 'Member')
    INTO chosen_name
    FROM profiles WHERE id = auth.uid();
  END IF;

  UPDATE profiles
  SET
    full_name = COALESCE(chosen_name, full_name),
    upi_id = COALESCE(NULLIF(trim(upi_id_param), ''), upi_id),
    phone = COALESCE(NULLIF(trim(phone_param), ''), phone),
    updated_at = now()
  WHERE id = auth.uid();

  -- Upsert participant
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

  -- Creator notification
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

-- 6. SECURITY HELPER FUNCTIONS
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

-- 7. STRICT MULTI-TENANT RLS POLICIES
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "groups_select_members" ON groups;
DROP POLICY IF EXISTS "groups_select_public_or_members" ON groups;
CREATE POLICY "groups_select_members" ON groups FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    created_by = auth.uid() OR
    created_by IS NULL OR
    is_group_member(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "groups_insert_auth" ON groups;
CREATE POLICY "groups_insert_auth" ON groups FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "groups_update_admin" ON groups;
CREATE POLICY "groups_update_admin" ON groups FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    created_by = auth.uid() OR
    created_by IS NULL OR
    is_group_admin(id, auth.uid())
  )
);

-- GROUP MEMBERS POLICIES
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_members_select" ON group_members;
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "group_members_insert" ON group_members;
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "group_members_update" ON group_members;
CREATE POLICY "group_members_update" ON group_members FOR UPDATE USING (
  auth.uid() IS NOT NULL
);

-- PARTICIPANTS POLICIES
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

-- EXPENSES POLICIES
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

-- 8. AUTO-BACKFILL LEGACY GROUPS & ASSIGN ADMIN
-- Assign any groups with null creator to the first active user profile
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM profiles ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE groups SET created_by = first_user_id WHERE created_by IS NULL;

    -- Ensure admin membership in group_members
    INSERT INTO group_members (group_id, user_id, role, status)
    SELECT g.id, first_user_id, 'admin', 'active'
    FROM groups g
    ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';

    -- Ensure admin participant row
    INSERT INTO participants (group_id, user_id, name, upi_id, phone)
    SELECT g.id, p.id, COALESCE(p.full_name, split_part(p.email, '@', 1), 'Admin'), p.upi_id, p.phone
    FROM groups g
    CROSS JOIN profiles p
    WHERE p.id = first_user_id
      AND NOT EXISTS (
        SELECT 1 FROM participants pt 
        WHERE pt.group_id = g.id AND (pt.user_id = p.id OR pt.id = p.id)
      );
  END IF;
END $$;

