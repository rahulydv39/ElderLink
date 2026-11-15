-- ==============================================================================
-- ElderLink — Supabase Cron & Vault Scheduler Setup
-- ==============================================================================
-- Description:
-- Sets up scheduled 1-minute invocation of `process-elderlink-notifications`
-- using Supabase pg_cron, pg_net, and Supabase Vault.
--
-- TARGET FUNCTION URL:
-- https://ehiblqvovrvlfqmolekh.supabase.co/functions/v1/process-elderlink-notifications
--
-- IMPORTANT SAFETY & SECURITY GUIDELINES:
-- 1. DO NOT hardcode real secrets in this SQL file or commit them to Git.
-- 2. Store the shared ELDERLINK_CRON_SECRET securely in Supabase Vault.
-- 3. The same secret value must be set in the Supabase Edge Function environment:
--    supabase secrets set ELDERLINK_CRON_SECRET="your-generated-secret"
-- 4. Never run this script automatically without administrator review.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Step 1: Ensure Required Supabase Extensions are Enabled
-- ------------------------------------------------------------------------------
-- pg_cron: Schedule periodic database jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- pg_net: Asynchronous HTTP requests from PostgreSQL to Edge Functions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- Step 2: Configure Secrets in Supabase Vault
-- ------------------------------------------------------------------------------
-- Supabase Vault encrypts secrets using authenticated encryption with libsodium.
-- Replace '<YOUR_STRONG_RANDOM_CRON_SECRET>' with a strong cryptographically
-- generated token (e.g. `openssl rand -hex 32`).

DO $$
BEGIN
  -- Check if secret already exists in vault
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'elderlink_cron_secret'
  ) THEN
    -- Insert new secret
    PERFORM vault.create_secret(
      '<YOUR_STRONG_RANDOM_CRON_SECRET>',
      'elderlink_cron_secret',
      'Shared bearer secret for ElderLink notification scheduler cron execution'
    );
    RAISE NOTICE 'Vault secret elderlink_cron_secret created successfully.';
  ELSE
    RAISE NOTICE 'Vault secret elderlink_cron_secret already exists. To update it, run vault.update_secret().';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Step 2B: How to Update Vault Secret if Already Created (Reference)
-- ------------------------------------------------------------------------------
-- To update the secret later, query the secret ID and call vault.update_secret:
-- SELECT vault.update_secret(
--   (SELECT id FROM vault.secrets WHERE name = 'elderlink_cron_secret'),
--   'new-secret-value-here'
-- );

-- ------------------------------------------------------------------------------
-- Step 3: Schedule the ElderLink Notification Cron Job (Runs every minute)
-- ------------------------------------------------------------------------------

-- Safely remove any existing job with the same identifier to prevent duplicate runs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-elderlink-notifications'
  ) THEN
    PERFORM cron.unschedule('process-elderlink-notifications');
    RAISE NOTICE 'Unscheduled existing process-elderlink-notifications cron job.';
  END IF;
END $$;

-- Register the new 1-minute cron job
SELECT cron.schedule(
  'process-elderlink-notifications', -- Unique job identifier
  '* * * * *',                       -- Every minute cron expression
  $$
  SELECT
    net.http_post(
      url := 'https://ehiblqvovrvlfqmolekh.supabase.co/functions/v1/process-elderlink-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'elderlink_cron_secret'
          LIMIT 1
        )
      ),
      body := jsonb_build_object(
        'trigger', 'pg_cron',
        'scheduled_at', now()
      ),
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);

-- ------------------------------------------------------------------------------
-- Step 4: Verification Queries
-- ------------------------------------------------------------------------------

-- Check if the cron job is active:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'process-elderlink-notifications';

-- Check recent cron executions:
-- SELECT * FROM cron.job_run_details WHERE jobname = 'process-elderlink-notifications' ORDER BY start_time DESC LIMIT 10;

-- Check outgoing pg_net HTTP requests and responses:
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;

-- ------------------------------------------------------------------------------
-- Step 5: Unschedule Script (Rollback / Deactivation)
-- ------------------------------------------------------------------------------
-- To pause or permanently deactivate the notification scheduler, execute:
-- SELECT cron.unschedule('process-elderlink-notifications');
