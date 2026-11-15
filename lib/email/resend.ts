import 'server-only'
import { Resend } from 'resend'

/**
 * Payload interface for sending an email via Resend.
 */
export interface SendEmailPayload {
  to: string | string[]
  subject: string
  html: string
  text: string
  from?: string
}

/**
 * Standard typed result returned by email operations.
 */
export interface EmailDeliveryResult {
  success: boolean
  id?: string
  error?: string
  statusCode?: number
}

// Cached singleton instance to reuse TCP/TLS connections
let resendInstance: Resend | null = null

/**
 * Returns the initialized Resend SDK client.
 * Throws a clear error if RESEND_API_KEY is missing.
 */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error(
      'Resend initialization failed: RESEND_API_KEY is not defined in the server environment.'
    )
  }

  if (!resendInstance) {
    resendInstance = new Resend(apiKey)
  }

  return resendInstance
}

/**
 * Returns the default sender address from the environment,
 * falling back to Resend's verified development sender if unset.
 */
export function getDefaultSender(): string {
  return process.env.RESEND_FROM_EMAIL || 'ElderLink <onboarding@resend.dev>'
}

/**
 * Sends a transactional email using Resend.
 *
 * Catches all internal and API exceptions, returning a structured EmailDeliveryResult
 * rather than throwing, ensuring caller database transactions remain protected.
 */
export async function sendEmail(payload: SendEmailPayload): Promise<EmailDeliveryResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: 'RESEND_API_KEY is not configured in the server environment.',
      }
    }

    const resend = getResendClient()
    const fromAddress = payload.from || getDefaultSender()

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Resend API returned an error.',
        statusCode: (error as { statusCode?: number }).statusCode,
      }
    }

    return {
      success: true,
      id: data?.id,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred during email transmission.'
    return {
      success: false,
      error: message,
    }
  }
}
