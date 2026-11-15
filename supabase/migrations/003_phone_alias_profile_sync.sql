-- ==============================================================================
-- ElderLink — Additive Migration 003: Phone Alias Profile Synchronization
-- ==============================================================================
-- Description:
-- Updates `public.handle_new_user()` to support deterministic phone-alias
-- authentication using Supabase's Email/Password auth engine under the hood.
--
-- Synchronization Logic:
-- 1. Accounts with `auth_identifier_type = 'phone_alias'`:
--    - `full_name`: extracted from `raw_user_meta_data->>'full_name'` (or 'name', fallback 'New Member').
--    - `phone`: extracted from `raw_user_meta_data->>'phone'` (the normalized E.164 phone number).
--    - `email`: extracted from `raw_user_meta_data->>'contact_email'`, falling back to ''
--      (NEVER the internal synthetic identifier `phone-...@auth.elderlink.invalid`).
--
-- 2. Legacy email-based accounts:
--    - `full_name`: extracted from metadata or fallback 'New Member'.
--    - `phone`: extracted from NEW.phone or metadata.
--    - `email`: extracted from NEW.email or metadata.
--
-- Safety Guarantees:
-- - Satisfies `public.profiles.email NOT NULL` constraint with empty string fallback.
-- - Preserves existing profile records, care circle memberships, and permissions.
-- - Does not alter any table structures or RLS policies.
-- - Leaves migration 002 update trigger `on_auth_user_updated` untouched.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_identifier_type TEXT;
BEGIN
  v_identifier_type := NEW.raw_user_meta_data->>'auth_identifier_type';

  IF v_identifier_type = 'phone_alias' THEN
    -- 1. Phone Alias Registration Flow:
    -- Extract Full Name from metadata
    v_full_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      'New Member'
    );

    -- Extract Phone from metadata (normalized E.164 phone)
    v_phone := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''),
      NULLIF(trim(NEW.phone), '')
    );

    -- Extract Contact Email from metadata (NEVER use NEW.email which is the internal synthetic identifier)
    v_email := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'contact_email'), ''),
      '' -- Fallback to empty string to satisfy NOT NULL constraint on public.profiles.email
    );

  ELSE
    -- 2. Legacy / Direct Email Registration Flow:
    v_full_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      'New Member'
    );

    v_phone := COALESCE(
      NULLIF(trim(NEW.phone), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
    );

    v_email := COALESCE(
      NULLIF(trim(NEW.email), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'email'), ''),
      ''
    );
  END IF;

  -- Insert or Update Profile Record
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    avatar_url
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_email,
    v_phone,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    -- For phone_alias accounts, update email only if contact_email was provided
    email = CASE
      WHEN v_identifier_type = 'phone_alias' AND EXCLUDED.email <> '' THEN EXCLUDED.email
      WHEN v_identifier_type IS DISTINCT FROM 'phone_alias' AND profiles.email = '' AND EXCLUDED.email <> '' THEN EXCLUDED.email
      WHEN v_identifier_type IS DISTINCT FROM 'phone_alias' AND EXCLUDED.email <> '' THEN EXCLUDED.email
      ELSE profiles.email
    END,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    full_name = CASE
      WHEN profiles.full_name = 'New Member' AND EXCLUDED.full_name <> 'New Member' THEN EXCLUDED.full_name
      WHEN EXCLUDED.full_name <> 'New Member' AND EXCLUDED.full_name IS NOT NULL THEN EXCLUDED.full_name
      ELSE profiles.full_name
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Revoke direct execution from non-privileged roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
