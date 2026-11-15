-- ==============================================================================
-- ElderLink - Initial Database Schema Migration (Hardened)
-- Migration: 001_initial_schema.sql
-- Description: Core tables, foreign keys, constraints, RLS policies,
--              triggers, and security definer functions for ElderLink.
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 2. Clean up previous definitions (safe migration pattern)
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. Utility Trigger Functions: Timestamp & Immutability Management
-- ------------------------------------------------------------------------------

-- 3.1. Correct TIMESTAMPTZ updated_at assignment using now()
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3.2. Record Reassignment Prevention (Guards cross-elder data boundaries)
CREATE OR REPLACE FUNCTION public.prevent_record_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.elder_profile_id <> OLD.elder_profile_id THEN
    RAISE EXCEPTION 'Immutability violation: Cannot reassign records across elder profiles.';
  END IF;

  IF TG_TABLE_NAME = 'medication_schedules' AND NEW.medication_id <> OLD.medication_id THEN
    RAISE EXCEPTION 'Immutability violation: Cannot reassign schedule to a different medication.';
  END IF;

  IF TG_TABLE_NAME = 'medication_logs' AND (NEW.medication_id <> OLD.medication_id OR NEW.schedule_id <> OLD.schedule_id) THEN
    RAISE EXCEPTION 'Immutability violation: Cannot reassign medication log references.';
  END IF;

  RETURN NEW;
END;
$$;

-- 3.3. Prevent Owner / User reassignment on core entities
CREATE OR REPLACE FUNCTION public.prevent_identity_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'elder_profiles' AND NEW.owner_user_id <> OLD.owner_user_id THEN
    RAISE EXCEPTION 'Immutability violation: Cannot transfer ownership of elder profiles directly.';
  END IF;

  IF TG_TABLE_NAME = 'care_circle_members' AND NEW.member_user_id <> OLD.member_user_id THEN
    RAISE EXCEPTION 'Immutability violation: Cannot reassign care circle member user ID.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Application Tables
-- ------------------------------------------------------------------------------

-- 4.1. PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.2. ELDER_PROFILES
CREATE TABLE IF NOT EXISTS public.elder_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
  medical_conditions TEXT[] NOT NULL DEFAULT '{}'::text[],
  allergies TEXT[] NOT NULL DEFAULT '{}'::text[],
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_dob CHECK (date_of_birth <= CURRENT_DATE),
  CONSTRAINT uq_elder_owner_composite UNIQUE (id, owner_user_id)
);

-- 4.3. CARE_CIRCLE_MEMBERS
CREATE TABLE IF NOT EXISTS public.care_circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('caretaker', 'family')),
  can_view_medical_info BOOLEAN NOT NULL DEFAULT true,
  can_manage_medications BOOLEAN NOT NULL DEFAULT false,
  can_manage_appointments BOOLEAN NOT NULL DEFAULT false,
  can_manage_members BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_elder_member UNIQUE (elder_profile_id, member_user_id)
);

-- 4.4. CARE_INVITATIONS
CREATE TABLE IF NOT EXISTS public.care_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  invited_email TEXT,
  invitation_code_hash TEXT NOT NULL,
  assigned_role TEXT NOT NULL CHECK (assigned_role IN ('caretaker', 'family')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_invitation_expiry CHECK (expires_at > created_at)
);

-- 4.5. MEDICATIONS
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  description TEXT,
  dosage TEXT NOT NULL,
  unit TEXT NOT NULL,
  instructions TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  prescribed_by TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_medication_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT uq_medication_elder_composite UNIQUE (id, elder_profile_id)
);

-- 4.6. MEDICATION_SCHEDULES
CREATE TABLE IF NOT EXISTS public.medication_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL,
  elder_profile_id UUID NOT NULL,
  scheduled_time TIME NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'custom')),
  days_of_week INTEGER[] NOT NULL DEFAULT '{}'::integer[],
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Composite foreign key guarantees medication belongs to the exact elder profile
  CONSTRAINT fk_schedule_medication_elder
    FOREIGN KEY (medication_id, elder_profile_id)
    REFERENCES public.medications(id, elder_profile_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_schedule_elder_composite UNIQUE (id, elder_profile_id)
);

-- 4.7. MEDICATION_LOGS
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL,
  schedule_id UUID NOT NULL,
  elder_profile_id UUID NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unconfirmed', 'taken', 'skipped', 'missed')),
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cross-elder consistency constraints
  CONSTRAINT fk_log_schedule_elder
    FOREIGN KEY (schedule_id, elder_profile_id)
    REFERENCES public.medication_schedules(id, elder_profile_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_log_medication_elder
    FOREIGN KEY (medication_id, elder_profile_id)
    REFERENCES public.medications(id, elder_profile_id)
    ON DELETE CASCADE,
  -- Prevent duplicate logs for the same medication schedule and scheduled dose
  CONSTRAINT unique_schedule_scheduled_for UNIQUE (schedule_id, scheduled_for)
);

-- 4.8. APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_profile_id UUID NOT NULL REFERENCES public.elder_profiles(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  hospital_name TEXT,
  appointment_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. Indexes for Query Performance and Foreign Keys
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_elder_profiles_owner ON public.elder_profiles(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_care_circle_members_elder ON public.care_circle_members(elder_profile_id);
CREATE INDEX IF NOT EXISTS idx_care_circle_members_user ON public.care_circle_members(member_user_id);
CREATE INDEX IF NOT EXISTS idx_care_circle_members_lookup ON public.care_circle_members(elder_profile_id, member_user_id);

CREATE INDEX IF NOT EXISTS idx_care_invitations_elder ON public.care_invitations(elder_profile_id);
CREATE INDEX IF NOT EXISTS idx_care_invitations_code_hash ON public.care_invitations(invitation_code_hash);
CREATE INDEX IF NOT EXISTS idx_care_invitations_expiry ON public.care_invitations(expires_at) WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_medications_elder ON public.medications(elder_profile_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON public.medications(elder_profile_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_medication_schedules_elder ON public.medication_schedules(elder_profile_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_med ON public.medication_schedules(medication_id);

CREATE INDEX IF NOT EXISTS idx_medication_logs_elder ON public.medication_logs(elder_profile_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_schedule ON public.medication_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_scheduled_for ON public.medication_logs(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_appointments_elder ON public.appointments(elder_profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(elder_profile_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(elder_profile_id, status);

-- ------------------------------------------------------------------------------
-- 6. Triggers on Mutable Tables
-- ------------------------------------------------------------------------------

-- 6.1. updated_at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_elder_profiles_updated_at ON public.elder_profiles;
CREATE TRIGGER trg_elder_profiles_updated_at
  BEFORE UPDATE ON public.elder_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_medications_updated_at ON public.medications;
CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_medication_schedules_updated_at ON public.medication_schedules;
CREATE TRIGGER trg_medication_schedules_updated_at
  BEFORE UPDATE ON public.medication_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6.2. Immutability triggers preventing elder_profile_id / key reassignment
DROP TRIGGER IF EXISTS trg_prevent_elder_reassign ON public.elder_profiles;
CREATE TRIGGER trg_prevent_elder_reassign
  BEFORE UPDATE ON public.elder_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_identity_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_member_reassign ON public.care_circle_members;
CREATE TRIGGER trg_prevent_member_reassign
  BEFORE UPDATE ON public.care_circle_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_identity_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_med_reassign ON public.medications;
CREATE TRIGGER trg_prevent_med_reassign
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_sched_reassign ON public.medication_schedules;
CREATE TRIGGER trg_prevent_sched_reassign
  BEFORE UPDATE ON public.medication_schedules
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_log_reassign ON public.medication_logs;
CREATE TRIGGER trg_prevent_log_reassign
  BEFORE UPDATE ON public.medication_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_apt_reassign ON public.appointments;
CREATE TRIGGER trg_prevent_apt_reassign
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_inv_reassign ON public.care_invitations;
CREATE TRIGGER trg_prevent_inv_reassign
  BEFORE UPDATE ON public.care_invitations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_reassignment();

-- ------------------------------------------------------------------------------
-- 7. User Registration Sync Trigger (auth.users -> public.profiles)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New Member'),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN profiles.full_name = 'New Member' AND EXCLUDED.full_name <> 'New Member' THEN EXCLUDED.full_name
      ELSE profiles.full_name
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 8. Hardened SECURITY DEFINER Authorization Helpers (Non-Recursive)
--    Note: All functions derive the identity strictly from auth.uid().
--          Arbitrary user_id parameters have been completely removed.
-- ------------------------------------------------------------------------------

-- Helper 8.1: Check if the authenticated caller is the elder owner
CREATE OR REPLACE FUNCTION public.is_elder_owner(elder_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR elder_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.elder_profiles
    WHERE id = elder_id AND owner_user_id = v_uid
  );
END;
$$;

-- Helper 8.2: Check if the authenticated caller is a care circle member
CREATE OR REPLACE FUNCTION public.is_care_circle_member(elder_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR elder_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.care_circle_members
    WHERE elder_profile_id = elder_id AND member_user_id = v_uid
  );
END;
$$;

-- Helper 8.3: Check if the authenticated caller holds a specific permission
CREATE OR REPLACE FUNCTION public.has_elder_permission(
  elder_id UUID,
  permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
  has_perm BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL OR elder_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- The owner implicitly holds all permissions
  IF public.is_elder_owner(elder_id) THEN
    RETURN TRUE;
  END IF;

  SELECT
    CASE permission_name
      WHEN 'can_view_medical_info' THEN can_view_medical_info
      WHEN 'can_manage_medications' THEN can_manage_medications
      WHEN 'can_manage_appointments' THEN can_manage_appointments
      WHEN 'can_manage_members' THEN can_manage_members
      ELSE FALSE
    END INTO has_perm
  FROM public.care_circle_members
  WHERE elder_profile_id = elder_id AND member_user_id = v_uid;

  RETURN COALESCE(has_perm, FALSE);
END;
$$;

-- Helper 8.4: Check if authenticated caller can record medication adherence
CREATE OR REPLACE FUNCTION public.can_record_medication_log(elder_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR elder_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owners have full access
  IF public.is_elder_owner(elder_id) THEN
    RETURN TRUE;
  END IF;

  -- Caretakers and members explicitly granted medication management
  RETURN EXISTS (
    SELECT 1 FROM public.care_circle_members
    WHERE elder_profile_id = elder_id
      AND member_user_id = v_uid
      AND (role = 'caretaker' OR can_manage_medications = TRUE)
  );
END;
$$;

-- Helper 8.5: Check if the authenticated caller shares a care circle with another user
CREATE OR REPLACE FUNCTION public.shares_care_circle_with(other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR other_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_uid = other_user_id THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    -- Case A: One is owner, the other is member
    SELECT 1 FROM public.elder_profiles ep
    JOIN public.care_circle_members ccm ON ccm.elder_profile_id = ep.id
    WHERE (ep.owner_user_id = v_uid AND ccm.member_user_id = other_user_id)
       OR (ep.owner_user_id = other_user_id AND ccm.member_user_id = v_uid)
    UNION
    -- Case B: Both are members of the same elder circle
    SELECT 1 FROM public.care_circle_members m1
    JOIN public.care_circle_members m2 ON m1.elder_profile_id = m2.elder_profile_id
    WHERE m1.member_user_id = v_uid AND m2.member_user_id = other_user_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. Hardened Invitation Management (RPCs)
-- ------------------------------------------------------------------------------

-- Helper 9.1: Generate a secure 128-bit cryptographically random invitation
-- Only owners or authorized member managers may create invitations.
CREATE OR REPLACE FUNCTION public.create_care_invitation(
  p_elder_id UUID,
  p_invited_email TEXT DEFAULT NULL,
  p_assigned_role TEXT DEFAULT 'family',
  p_duration_hours INT DEFAULT 168 -- default 7 days
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_raw_code TEXT;
  v_code_hash TEXT;
  v_invitation_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Validate authorization: must be elder owner or have can_manage_members permission
  IF NOT (public.is_elder_owner(p_elder_id) OR public.has_elder_permission(p_elder_id, 'can_manage_members')) THEN
    RAISE EXCEPTION 'Unauthorized to issue invitations for this elder profile.';
  END IF;

  IF p_assigned_role NOT IN ('caretaker', 'family') THEN
    RAISE EXCEPTION 'Invalid role. Must be caretaker or family.';
  END IF;

  -- Generate 128 bits (16 bytes = 32 hex chars) of cryptographically secure randomness
  v_raw_code := encode(extensions.gen_random_bytes(16), 'hex');
  v_code_hash := encode(extensions.digest(v_raw_code, 'sha256'), 'hex');
  v_expires_at := now() + (GREATEST(p_duration_hours, 1) || ' hours')::interval;

  INSERT INTO public.care_invitations (
    elder_profile_id,
    invited_email,
    invitation_code_hash,
    assigned_role,
    expires_at,
    created_by
  ) VALUES (
    p_elder_id,
    NULLIF(trim(p_invited_email), ''),
    v_code_hash,
    p_assigned_role,
    v_expires_at,
    v_uid
  )
  RETURNING id INTO v_invitation_id;

  -- Return raw code ONCE to the creator. The raw code is never persisted.
  RETURN jsonb_build_object(
    'invitation_id', v_invitation_id,
    'elder_profile_id', p_elder_id,
    'raw_invitation_code', v_raw_code,
    'assigned_role', p_assigned_role,
    'invited_email', p_invited_email,
    'expires_at', v_expires_at
  );
END;
$$;

-- Helper 9.2: Atomic, Hardened Invitation Acceptance
CREATE OR REPLACE FUNCTION public.accept_care_invitation(raw_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_email TEXT;
  v_code_hash TEXT;
  v_invitation RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept invitation.';
  END IF;

  -- Validate code format: minimum 24 chars to enforce high-entropy 128-bit secrets
  IF raw_code IS NULL OR length(trim(raw_code)) < 24 THEN
    RAISE EXCEPTION 'Invalid or malformed invitation code.';
  END IF;

  -- Retrieve caller verified email from auth context
  v_user_email := COALESCE(
    auth.jwt() ->> 'email',
    (SELECT email FROM public.profiles WHERE id = v_uid)
  );

  -- Compute deterministic SHA-256 hash of the presented code
  v_code_hash := encode(extensions.digest(trim(raw_code), 'sha256'), 'hex');

  -- Atomically lock the invitation row during acceptance
  SELECT * INTO v_invitation
  FROM public.care_invitations
  WHERE invitation_code_hash = v_code_hash
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation code is invalid, already used, or expired.';
  END IF;

  -- Case-insensitive email binding validation if invited_email was restricted
  IF v_invitation.invited_email IS NOT NULL AND length(trim(v_invitation.invited_email)) > 0 THEN
    IF v_user_email IS NULL OR lower(trim(v_invitation.invited_email)) <> lower(trim(v_user_email)) THEN
      RAISE EXCEPTION 'This invitation was issued for a different email address.';
    END IF;
  END IF;

  -- Prevent owner self-acceptance
  IF public.is_elder_owner(v_invitation.elder_profile_id) THEN
    RAISE EXCEPTION 'You are already the owner of this elder profile.';
  END IF;

  -- Prevent duplicate membership
  IF public.is_care_circle_member(v_invitation.elder_profile_id) THEN
    RAISE EXCEPTION 'You are already a member of this care circle.';
  END IF;

  -- Insert member with strict role-based permission boundaries
  INSERT INTO public.care_circle_members (
    elder_profile_id,
    member_user_id,
    role,
    can_view_medical_info,
    can_manage_medications,
    can_manage_appointments,
    can_manage_members
  ) VALUES (
    v_invitation.elder_profile_id,
    v_uid,
    v_invitation.assigned_role,
    true, -- Both roles can view medical info by default
    CASE WHEN v_invitation.assigned_role = 'caretaker' THEN true ELSE false END,
    CASE WHEN v_invitation.assigned_role = 'caretaker' THEN true ELSE false END,
    false -- Member management can NEVER be granted via invitation
  );

  -- Mark invitation as accepted atomically
  UPDATE public.care_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'elder_profile_id', v_invitation.elder_profile_id,
    'assigned_role', v_invitation.assigned_role
  );
END;
$$;

-- Helper 9.3: Dedicated Invitation Revocation
CREATE OR REPLACE FUNCTION public.revoke_care_invitation(invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_elder_id UUID;
BEGIN
  IF v_uid IS NULL OR invitation_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT elder_profile_id INTO v_elder_id
  FROM public.care_invitations
  WHERE id = invitation_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Only owner or member managers can revoke
  IF NOT (public.is_elder_owner(v_elder_id) OR public.has_elder_permission(v_elder_id, 'can_manage_members')) THEN
    RAISE EXCEPTION 'Unauthorized to revoke this invitation.';
  END IF;

  DELETE FROM public.care_invitations WHERE id = invitation_id;
  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------

-- Enable RLS on every application table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 10.1. PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR public.shares_care_circle_with(id)
  );

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10.2. ELDER_PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "elder_profiles_select_policy" ON public.elder_profiles;
CREATE POLICY "elder_profiles_select_policy" ON public.elder_profiles
  FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid() OR public.is_care_circle_member(id)
  );

DROP POLICY IF EXISTS "elder_profiles_insert_policy" ON public.elder_profiles;
CREATE POLICY "elder_profiles_insert_policy" ON public.elder_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "elder_profiles_update_policy" ON public.elder_profiles;
CREATE POLICY "elder_profiles_update_policy" ON public.elder_profiles
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "elder_profiles_delete_policy" ON public.elder_profiles;
CREATE POLICY "elder_profiles_delete_policy" ON public.elder_profiles
  FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10.3. CARE_CIRCLE_MEMBERS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "care_circle_members_select_policy" ON public.care_circle_members;
CREATE POLICY "care_circle_members_select_policy" ON public.care_circle_members
  FOR SELECT
  TO authenticated
  USING (
    member_user_id = auth.uid()
    OR public.is_elder_owner(elder_profile_id)
    OR public.is_care_circle_member(elder_profile_id)
  );

-- STRICT PRIVILEGE ESCALATION FIX:
-- ONLY the elder owner may directly INSERT membership records.
-- All other members must join exclusively through accept_care_invitation().
DROP POLICY IF EXISTS "care_circle_members_insert_policy" ON public.care_circle_members;
CREATE POLICY "care_circle_members_insert_policy" ON public.care_circle_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_elder_owner(elder_profile_id)
  );

-- ONLY the elder owner may modify permissions
DROP POLICY IF EXISTS "care_circle_members_update_policy" ON public.care_circle_members;
CREATE POLICY "care_circle_members_update_policy" ON public.care_circle_members
  FOR UPDATE
  TO authenticated
  USING (public.is_elder_owner(elder_profile_id))
  WITH CHECK (public.is_elder_owner(elder_profile_id));

-- Owner can remove members; members can leave the circle
DROP POLICY IF EXISTS "care_circle_members_delete_policy" ON public.care_circle_members;
CREATE POLICY "care_circle_members_delete_policy" ON public.care_circle_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR member_user_id = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 10.4. CARE_INVITATIONS POLICIES
-- ------------------------------------------------------------------------------
-- Read invitations metadata (invitation_code_hash column is excluded via Column Grants)
DROP POLICY IF EXISTS "care_invitations_select_policy" ON public.care_invitations;
CREATE POLICY "care_invitations_select_policy" ON public.care_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_members')
  );

DROP POLICY IF EXISTS "care_invitations_insert_policy" ON public.care_invitations;
CREATE POLICY "care_invitations_insert_policy" ON public.care_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_elder_owner(elder_profile_id)
      OR public.has_elder_permission(elder_profile_id, 'can_manage_members')
    )
  );

-- Direct client updates on invitations are completely forbidden.
-- Revocation is performed via revoke_care_invitation() or deletion policy.
DROP POLICY IF EXISTS "care_invitations_update_policy" ON public.care_invitations;

DROP POLICY IF EXISTS "care_invitations_delete_policy" ON public.care_invitations;
CREATE POLICY "care_invitations_delete_policy" ON public.care_invitations
  FOR DELETE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_members')
  );

-- ------------------------------------------------------------------------------
-- 10.5. MEDICATIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "medications_select_policy" ON public.medications;
CREATE POLICY "medications_select_policy" ON public.medications
  FOR SELECT
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_view_medical_info')
  );

DROP POLICY IF EXISTS "medications_insert_policy" ON public.medications;
CREATE POLICY "medications_insert_policy" ON public.medications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = auth.uid() OR created_by IS NULL)
    AND (
      public.is_elder_owner(elder_profile_id)
      OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
    )
  );

DROP POLICY IF EXISTS "medications_update_policy" ON public.medications;
CREATE POLICY "medications_update_policy" ON public.medications
  FOR UPDATE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
  )
  WITH CHECK (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
  );

DROP POLICY IF EXISTS "medications_delete_policy" ON public.medications;
CREATE POLICY "medications_delete_policy" ON public.medications
  FOR DELETE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
  );

-- ------------------------------------------------------------------------------
-- 10.6. MEDICATION_SCHEDULES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "medication_schedules_select_policy" ON public.medication_schedules;
CREATE POLICY "medication_schedules_select_policy" ON public.medication_schedules
  FOR SELECT
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_view_medical_info')
  );

DROP POLICY IF EXISTS "medication_schedules_insert_policy" ON public.medication_schedules;
CREATE POLICY "medication_schedules_insert_policy" ON public.medication_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
  );

DROP POLICY IF EXISTS "medication_schedules_update_policy" ON public.medication_schedules;
CREATE POLICY "medication_schedules_update_policy" ON public.medication_schedules
  FOR UPDATE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
  )
  WITH CHECK (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
  );

DROP POLICY IF EXISTS "medication_schedules_delete_policy" ON public.medication_schedules;
CREATE POLICY "medication_schedules_delete_policy" ON public.medication_schedules
  FOR DELETE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_medications')
  );

-- ------------------------------------------------------------------------------
-- 10.7. MEDICATION_LOGS POLICIES (Hardened Attribution)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "medication_logs_select_policy" ON public.medication_logs;
CREATE POLICY "medication_logs_select_policy" ON public.medication_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_view_medical_info')
  );

-- STRICT ATTRIBUTION ENFORCEMENT:
-- Authenticated users MUST attribute their log (recorded_by = auth.uid()).
-- Unattributed logs (recorded_by IS NULL) are strictly rejected from authenticated clients.
-- Service-role system jobs bypass RLS and retain the ability to insert automated missed records.
DROP POLICY IF EXISTS "medication_logs_insert_policy" ON public.medication_logs;
CREATE POLICY "medication_logs_insert_policy" ON public.medication_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recorded_by = auth.uid()
    AND public.can_record_medication_log(elder_profile_id)
  );

-- Caretakers can only edit their own recorded logs; owners retain full authority
DROP POLICY IF EXISTS "medication_logs_update_policy" ON public.medication_logs;
CREATE POLICY "medication_logs_update_policy" ON public.medication_logs
  FOR UPDATE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR (
      recorded_by = auth.uid()
      AND public.can_record_medication_log(elder_profile_id)
    )
  )
  WITH CHECK (
    public.is_elder_owner(elder_profile_id)
    OR (
      recorded_by = auth.uid()
      AND public.can_record_medication_log(elder_profile_id)
    )
  );

-- Audit Trail Protection: Only the elder owner can delete logs
DROP POLICY IF EXISTS "medication_logs_delete_policy" ON public.medication_logs;
CREATE POLICY "medication_logs_delete_policy" ON public.medication_logs
  FOR DELETE
  TO authenticated
  USING (public.is_elder_owner(elder_profile_id));

-- ------------------------------------------------------------------------------
-- 10.8. APPOINTMENTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "appointments_select_policy" ON public.appointments;
CREATE POLICY "appointments_select_policy" ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_view_medical_info')
  );

DROP POLICY IF EXISTS "appointments_insert_policy" ON public.appointments;
CREATE POLICY "appointments_insert_policy" ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = auth.uid() OR created_by IS NULL)
    AND (
      public.is_elder_owner(elder_profile_id)
      OR public.has_elder_permission(elder_profile_id, 'can_manage_appointments')
    )
  );

DROP POLICY IF EXISTS "appointments_update_policy" ON public.appointments;
CREATE POLICY "appointments_update_policy" ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_appointments')
  )
  WITH CHECK (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_appointments')
  );

DROP POLICY IF EXISTS "appointments_delete_policy" ON public.appointments;
CREATE POLICY "appointments_delete_policy" ON public.appointments
  FOR DELETE
  TO authenticated
  USING (
    public.is_elder_owner(elder_profile_id)
    OR public.has_elder_permission(elder_profile_id, 'can_manage_appointments')
  );

-- ------------------------------------------------------------------------------
-- 11. Strict Execution and Column-Level Privilege Management
-- ------------------------------------------------------------------------------

-- 11.1. Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 11.2. Table level permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.elder_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_circle_members TO authenticated;
GRANT INSERT, DELETE ON public.care_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;

-- 11.3. Column-Level Grants for care_invitations (Prevents reading invitation_code_hash)
REVOKE SELECT ON public.care_invitations FROM authenticated, anon, PUBLIC;
GRANT SELECT (id, elder_profile_id, invited_email, assigned_role, expires_at, accepted_at, created_by, created_at)
  ON public.care_invitations TO authenticated;

-- 11.4. Trigger functions: Revoke execute from all application users
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_record_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_identity_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 11.5. Revoke execute on all functions from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION public.is_elder_owner(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_care_circle_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_elder_permission(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_record_medication_log(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_care_circle_with(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_care_invitation(UUID, TEXT, TEXT, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_care_invitation(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_care_invitation(UUID) FROM PUBLIC, anon;

-- 11.6. Grant execute ONLY to authenticated role for necessary RLS helpers and RPCs
GRANT EXECUTE ON FUNCTION public.is_elder_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_care_circle_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_elder_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_record_medication_log(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_care_circle_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_care_invitation(UUID, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_care_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_care_invitation(UUID) TO authenticated;

-- 11.7. Revoke all public / anonymous direct data access
REVOKE ALL ON public.care_invitations FROM anon;
REVOKE ALL ON public.medications FROM anon;
REVOKE ALL ON public.medication_schedules FROM anon;
REVOKE ALL ON public.medication_logs FROM anon;
REVOKE ALL ON public.appointments FROM anon;
REVOKE ALL ON public.care_circle_members FROM anon;
REVOKE ALL ON public.elder_profiles FROM anon;
REVOKE ALL ON public.profiles FROM anon;

-- End of hardened migration
