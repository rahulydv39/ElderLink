-- ==============================================================================
-- ElderLink — Additive Migration 004: Notification Scheduler & Preferences
-- ==============================================================================
-- Description:
-- 1. Creates `public.notification_preferences` for user opt-in control.
-- 2. Creates `public.notification_deliveries` for delivery tracking & idempotency.
-- 3. Implements atomic claim, completion, retry, and skipping functions.
--
-- Safety Guarantees:
-- - All user preferences default to FALSE (explicit opt-in).
-- - Zero PII or clinical data stored in delivery logs.
-- - RLS enforced; client cannot view or modify internal delivery records.
-- - Atomic row-level locks prevent duplicate notifications across concurrent workers.
-- - Enforces maximum 5 delivery attempts with stale lock recovery.
-- - Active processing locks are never prematurely failed or intercepted.
-- - Strictly revokes unauthorized access from PUBLIC, anon, and authenticated.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NOTIFICATION_PREFERENCES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_reminders BOOLEAN NOT NULL DEFAULT false,
  missed_dose_alerts BOOLEAN NOT NULL DEFAULT false,
  appointment_reminders BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Explicit Table Privileges
REVOKE ALL ON public.notification_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.notification_preferences TO service_role;

-- Users may only view their own preferences
DROP POLICY IF EXISTS "notification_preferences_select_policy" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_policy"
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users may insert their own preferences
DROP POLICY IF EXISTS "notification_preferences_insert_policy" ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_policy"
  ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users may update their own preferences
DROP POLICY IF EXISTS "notification_preferences_update_policy" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_policy"
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS set_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. NOTIFICATION_DELIVERIES TABLE (Idempotency & Scheduler Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error_code TEXT,
  locked_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient scheduler lookups and retries
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_event_key
  ON public.notification_deliveries(event_key);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
  ON public.notification_deliveries(status);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON public.notification_deliveries(recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_retry
  ON public.notification_deliveries(next_attempt_at)
  WHERE status = 'failed';

-- Enable RLS
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Explicit Table Privileges: Revoke all public/client access, grant strictly to service_role
REVOKE ALL ON public.notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

-- ------------------------------------------------------------------------------
-- 3. ATOMIC DELIVERY CLAIM & MANAGEMENT FUNCTIONS
-- ------------------------------------------------------------------------------

-- 3.1. Claim an event for processing atomically (prevents concurrent double-sends, enforces max 5 attempts)
CREATE OR REPLACE FUNCTION public.claim_notification_event(
  p_event_key TEXT,
  p_event_type TEXT,
  p_recipient_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery RECORD;
  v_now TIMESTAMPTZ := now();
  v_lock_timeout INTERVAL := INTERVAL '5 minutes';
  v_max_attempts CONSTANT INTEGER := 5;
  v_inserted_rows INTEGER := 0;
BEGIN
  -- 1. Attempt to insert a new processing record if not existing (starts at attempt_count = 1)
  INSERT INTO public.notification_deliveries (
    event_key,
    event_type,
    recipient_user_id,
    status,
    attempt_count,
    locked_at,
    created_at,
    updated_at
  )
  VALUES (
    p_event_key,
    p_event_type,
    p_recipient_user_id,
    'processing',
    1,
    v_now,
    v_now,
    v_now
  )
  ON CONFLICT (event_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

  -- If this invocation inserted the row, it is claimed for attempt 1
  IF v_inserted_rows > 0 THEN
    RETURN TRUE;
  END IF;

  -- 2. Atomically lock the existing row
  SELECT * INTO v_delivery
  FROM public.notification_deliveries
  WHERE event_key = p_event_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 3. If already sent or skipped, do not re-claim
  IF v_delivery.status = 'sent' OR v_delivery.status = 'skipped' THEN
    RETURN FALSE;
  END IF;

  -- 4. If currently marked 'processing'
  IF v_delivery.status = 'processing' THEN
    -- If locked_at is within the last five minutes, lock is active:
    -- return FALSE immediately, even when attempt_count equals 5
    IF v_delivery.locked_at IS NOT NULL AND v_delivery.locked_at > (v_now - v_lock_timeout) THEN
      RETURN FALSE;
    END IF;

    -- The processing lock is stale:
    -- If attempt_count is already 5 or greater, mark the event failed with MAX_ATTEMPTS_EXCEEDED, clear locked_at, and return FALSE
    IF v_delivery.attempt_count >= v_max_attempts THEN
      UPDATE public.notification_deliveries
      SET
        status = 'failed',
        last_error_code = 'MAX_ATTEMPTS_EXCEEDED',
        locked_at = NULL,
        updated_at = v_now
      WHERE event_key = p_event_key;
      RETURN FALSE;
    END IF;

    -- Otherwise reclaim the event as next attempt, update locked_at, and return TRUE
    UPDATE public.notification_deliveries
    SET
      locked_at = v_now,
      attempt_count = v_delivery.attempt_count + 1,
      updated_at = v_now
    WHERE event_key = p_event_key;
    RETURN TRUE;
  END IF;

  -- 5. If marked 'failed'
  IF v_delivery.status = 'failed' THEN
    -- Never retry when attempt_count is 5 or greater
    IF v_delivery.attempt_count >= v_max_attempts THEN
      RETURN FALSE;
    END IF;

    -- Respect next_attempt_at retry backoff
    IF v_delivery.next_attempt_at IS NOT NULL AND v_delivery.next_attempt_at > v_now THEN
      RETURN FALSE;
    END IF;

    -- Otherwise change status to processing, increment attempt_count, set locked_at, and return TRUE
    UPDATE public.notification_deliveries
    SET
      status = 'processing',
      locked_at = v_now,
      attempt_count = v_delivery.attempt_count + 1,
      updated_at = v_now
    WHERE event_key = p_event_key;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3.2. Mark delivery successful
CREATE OR REPLACE FUNCTION public.complete_notification_delivery(
  p_event_key TEXT,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notification_deliveries
  SET
    status = 'sent',
    provider_message_id = p_provider_message_id,
    sent_at = now(),
    locked_at = NULL,
    updated_at = now()
  WHERE event_key = p_event_key;
END;
$$;

-- 3.3. Mark delivery failed with exponential/interval retry backoff
CREATE OR REPLACE FUNCTION public.fail_notification_delivery(
  p_event_key TEXT,
  p_error_code TEXT,
  p_retry_delay_seconds INT DEFAULT 300
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notification_deliveries
  SET
    status = 'failed',
    last_error_code = p_error_code,
    next_attempt_at = now() + (p_retry_delay_seconds || ' seconds')::interval,
    locked_at = NULL,
    updated_at = now()
  WHERE event_key = p_event_key;
END;
$$;

-- 3.4. Mark delivery skipped (e.g. disabled user preference or no contact email)
CREATE OR REPLACE FUNCTION public.skip_notification_delivery(
  p_event_key TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notification_deliveries
  SET
    status = 'skipped',
    last_error_code = p_reason,
    locked_at = NULL,
    updated_at = now()
  WHERE event_key = p_event_key;
END;
$$;

-- Revoke execution from public, anon, and authenticated roles
REVOKE EXECUTE ON FUNCTION public.claim_notification_event(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_notification_delivery(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_notification_delivery(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skip_notification_delivery(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Grant execution strictly to service_role
GRANT EXECUTE ON FUNCTION public.claim_notification_event(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_delivery(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_notification_delivery(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.skip_notification_delivery(TEXT, TEXT) TO service_role;
