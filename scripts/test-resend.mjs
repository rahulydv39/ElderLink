#!/usr/bin/env node

/**
 * ElderLink — Resend Email Delivery Test Script
 *
 * Usage:
 *   npm run test:email
 *
 * Safety requirements:
 * - Reads .env.local safely without printing secrets or token contents.
 * - Validates required environment variables (RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_TEST_TO).
 * - Sends a single generic test message to RESEND_TEST_TO.
 * - Prints Resend message ID on success or a descriptive error on failure.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resend } from 'resend'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const envLocalPath = path.join(rootDir, '.env.local')

/**
 * Safely parses .env.local into process.env without printing any contents.
 */
function loadEnvLocal() {
  if (!fs.existsSync(envLocalPath)) {
    return
  }

  const content = fs.readFileSync(envLocalPath, 'utf8')
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    // Strip quotes if wrapped
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

async function runTest() {
  loadEnvLocal()

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const testTo = process.env.RESEND_TEST_TO

  console.log('\n--- ElderLink Resend Integration Diagnostic ---')

  if (!apiKey) {
    console.error('[ERROR] RESEND_API_KEY is not defined in .env.local.')
    process.exit(1)
  }

  if (!fromEmail) {
    console.error('[ERROR] RESEND_FROM_EMAIL is not defined in .env.local.')
    process.exit(1)
  }

  if (!testTo || testTo === 'your_resend_account_email') {
    console.error(
      '[ERROR] RESEND_TEST_TO is not configured in .env.local.\n' +
      'Please set RESEND_TEST_TO to your verified Resend account email address before running this test.'
    )
    process.exit(1)
  }

  console.log('[INFO] Environment variables verified (API Key present, From Address configured).')
  console.log(`[INFO] Attempting test transmission to: ${testTo}`)

  const resend = new Resend(apiKey)

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: testTo,
      subject: 'ElderLink Health Portal: Resend Integration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="background-color: #0d9488; padding: 16px; border-radius: 8px; color: #ffffff; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 20px;">ElderLink Health Portal</h1>
          </div>
          <h2 style="color: #0f172a; font-size: 16px;">Resend Delivery Test Succeeded</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            This test email confirms that your Resend transactional email integration is correctly configured for ElderLink.
          </p>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            &copy; 2026 ElderLink. All patient confidentiality safeguards are enforced.
          </p>
        </div>
      `,
      text: `ELDERLINK HEALTH PORTAL\nResend Delivery Test Succeeded\n\nThis test email confirms that your Resend transactional email integration is correctly configured for ElderLink.\n\n© 2026 ElderLink.`,
    })

    if (error) {
      console.error(`[ERROR] Resend API returned an error: ${error.message}`)
      process.exit(1)
    }

    console.log('[SUCCESS] Email transmitted successfully.')
    console.log(`[SUCCESS] Resend Message ID: ${data?.id}`)
    console.log('------------------------------------------------\n')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown transmission exception.'
    console.error(`[ERROR] Transmission failed: ${message}`)
    process.exit(1)
  }
}

runTest()
