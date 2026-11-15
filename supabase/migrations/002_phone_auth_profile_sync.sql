-- ==============================================================================
-- ElderLink — Additive Migration 002: Phone-Based Authentication Profile Sync
-- ==============================================================================
-- Description:
-- 1. Updates the `handle_new_user()` trigger function to support Supabase Phone +
--    Password authentication where `auth.users.phone` is populated on sign up.
-- 2. Adds a safe `handle_user_update()` trigger function on `auth.users` for
--    `AFTER UPDATE OF phone` to ensure existing accounts that update or link their
--    phone number automatically synchronize `public.profiles.phone`.
--
-- Safety Guarantees:
-- - Preserves existing user profiles, identities, and circle relationships.
-- - Satisfies NOT NULL constraint on `public.profiles.email` using empty string fallback.
-- - Does not alter any table structures or RLS policies.
-- - Restricts function execution privileges from anon/authenticated roles.
-- ==============================================================================

-- 1. INSERT Trigger: Profile initialization on new user registration
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
BEGIN
  -- Extract Full Name (from metadata full_name or name, fallback to 'New Member')
  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    'New Member'
  );

  -- Extract Phone Number (from auth.users.phone, fallback to metadata)
  v_phone := COALESCE(
    NULLIF(trim(NEW.phone), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
  );

  -- Extract Optional Email Address (from auth.users.email, fallback to metadata, fallback '')
  v_email := COALESCE(
    NULLIF(trim(NEW.email), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'email'), ''),
    '' -- Satisfies NOT NULL constraint on public.profiles.email
  );

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
    email = CASE
      WHEN profiles.email = '' AND EXCLUDED.email <> '' THEN EXCLUDED.email
      WHEN EXCLUDED.email <> '' THEN EXCLUDED.email
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

-- Attach INSERT trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Revoke direct execution on handle_new_user from external callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- 2. UPDATE Trigger: Safe mobile number synchronization when auth.users.phone changes
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Synchronize mobile number if changed on auth.users
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE public.profiles
    SET
      phone = NEW.phone,
      updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach UPDATE trigger to auth.users for phone modifications
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Revoke direct execution on handle_user_update from external callers
REVOKE EXECUTE ON FUNCTION public.handle_user_update() FROM PUBLIC, anon, authenticated;
