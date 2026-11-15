import 'server-only'
import { sendEmail } from '@/lib/email/resend'
import {
  getMedicationReminderTemplate,
  getMissedDoseTemplate,
  getAppointmentReminderTemplate,
  getAppointmentUpdateTemplate,
  getCareCircleInvitationTemplate,
  getGenericNotificationTemplate,
} from '@/lib/email/templates'
import { isInternalAuthEmail } from '@/lib/utils/auth-identity'

export interface NotificationOptions {
  recipientEmail: string | null | undefined
}

export interface NotificationDeliveryResult {
  success: boolean
  id?: string
  skipped?: boolean
  error?: string
}

/**
 * Validates a recipient contact email address before dispatching to Resend.
 * Gracefully flags missing, malformed, or internal synthetic .invalid addresses.
 */
function validateNotificationRecipient(email: string | null | undefined): {
  valid: boolean
  error?: string
  skipped?: boolean
} {
  if (!email || !email.trim()) {
    return {
      valid: false,
      skipped: true,
      error: 'Recipient has no contact email registered.',
    }
  }

  const trimmed = email.trim().toLowerCase()

  // Guard against sending to internal phone-alias synthetic identifiers
  if (isInternalAuthEmail(trimmed) || trimmed.endsWith('.invalid')) {
    return {
      valid: false,
      skipped: true,
      error: 'Cannot dispatch email to internal synthetic identifier.',
    }
  }

  // Basic RFC 5322 structural verification
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return {
      valid: false,
      skipped: true,
      error: 'Recipient contact email format is invalid.',
    }
  }

  return { valid: true }
}

/**
 * 1. Sends a scheduled medication dose reminder email.
 */
export async function sendMedicationReminderEmail(
  options: NotificationOptions
): Promise<NotificationDeliveryResult> {
  try {
    const check = validateNotificationRecipient(options.recipientEmail)
    if (!check.valid) {
      return {
        success: false,
        skipped: check.skipped,
        error: check.error,
      }
    }

    const template = getMedicationReminderTemplate()
    const result = await sendEmail({
      to: options.recipientEmail!.trim(),
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    return {
      success: result.success,
      id: result.id,
      error: result.error,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unexpected error during medication reminder dispatch.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * 2. Sends a missed medication dose check alert email.
 */
export async function sendMissedDoseEmail(
  options: NotificationOptions
): Promise<NotificationDeliveryResult> {
  try {
    const check = validateNotificationRecipient(options.recipientEmail)
    if (!check.valid) {
      return {
        success: false,
        skipped: check.skipped,
        error: check.error,
      }
    }

    const template = getMissedDoseTemplate()
    const result = await sendEmail({
      to: options.recipientEmail!.trim(),
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    return {
      success: result.success,
      id: result.id,
      error: result.error,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unexpected error during missed dose alert dispatch.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * 3. Sends an upcoming clinical consultation reminder email.
 */
export async function sendAppointmentReminderEmail(
  options: NotificationOptions
): Promise<NotificationDeliveryResult> {
  try {
    const check = validateNotificationRecipient(options.recipientEmail)
    if (!check.valid) {
      return {
        success: false,
        skipped: check.skipped,
        error: check.error,
      }
    }

    const template = getAppointmentReminderTemplate()
    const result = await sendEmail({
      to: options.recipientEmail!.trim(),
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    return {
      success: result.success,
      id: result.id,
      error: result.error,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unexpected error during appointment reminder dispatch.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * 4. Sends a clinical consultation schedule update email.
 */
export async function sendAppointmentUpdateEmail(
  options: NotificationOptions
): Promise<NotificationDeliveryResult> {
  try {
    const check = validateNotificationRecipient(options.recipientEmail)
    if (!check.valid) {
      return {
        success: false,
        skipped: check.skipped,
        error: check.error,
      }
    }

    const template = getAppointmentUpdateTemplate()
    const result = await sendEmail({
      to: options.recipientEmail!.trim(),
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    return {
      success: result.success,
      id: result.id,
      error: result.error,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unexpected error during appointment update dispatch.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * 5. Sends a Care Circle invitation notification email.
 */
export async function sendCareCircleInvitationEmail(
  options: NotificationOptions
): Promise<NotificationDeliveryResult> {
  try {
    const check = validateNotificationRecipient(options.recipientEmail)
    if (!check.valid) {
      return {
        success: false,
        skipped: check.skipped,
        error: check.error,
      }
    }

    const template = getCareCircleInvitationTemplate()
    const result = await sendEmail({
      to: options.recipientEmail!.trim(),
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    return {
      success: result.success,
      id: result.id,
      error: result.error,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unexpected error during care circle invitation notification dispatch.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * 6. Sends a general ElderLink notification email.
 */
export async function sendGenericNotificationEmail(
  options: NotificationOptions
): Promise<NotificationDeliveryResult> {
  try {
    const check = validateNotificationRecipient(options.recipientEmail)
    if (!check.valid) {
      return {
        success: false,
        skipped: check.skipped,
        error: check.error,
      }
    }

    const template = getGenericNotificationTemplate()
    const result = await sendEmail({
      to: options.recipientEmail!.trim(),
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    return {
      success: result.success,
      id: result.id,
      error: result.error,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unexpected error during generic notification dispatch.'
    return {
      success: false,
      error: message,
    }
  }
}
