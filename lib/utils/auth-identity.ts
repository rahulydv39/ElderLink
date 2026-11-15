/**
 * Internal Authentication Identifier Utility for ElderLink.
 *
 * ElderLink presents a phone-first authentication experience to users while
 * utilizing Supabase's Email/Password engine internally.
 *
 * This utility deterministically converts a normalized phone number into a synthetic,
 * non-routable internal identifier using the IETF RFC 2606 / RFC 6761 reserved '.invalid'
 * top-level domain.
 *
 * SECURITY INVARIANTS:
 * 1. This identifier must NEVER be displayed or presented to users in any UI.
 * 2. This identifier must NEVER be stored in public.profiles.email (actual contact email is used).
 * 3. Real contact emails must NEVER be used as the authentication identity.
 */

export const AUTH_IDENTIFIER_DOMAIN = 'auth.elderlink.invalid'
export const AUTH_IDENTIFIER_TYPE = 'phone_alias'

/**
 * Derives a deterministic internal email-shaped authentication identifier from a phone number.
 * Example: '+919876543210' -> 'phone-919876543210@auth.elderlink.invalid'
 *
 * @param normalizedPhone E.164 or digit-bearing phone string
 * @returns Deterministic synthetic email identifier under auth.elderlink.invalid
 */
export function phoneToAuthEmail(normalizedPhone: string): string {
  const digitsOnly = normalizedPhone.replace(/\D/g, '')
  if (!digitsOnly) {
    throw new Error('Cannot derive authentication identifier from an empty phone number.')
  }
  return `phone-${digitsOnly}@${AUTH_IDENTIFIER_DOMAIN}`
}

/**
 * Checks if a given email string is an internal phone-alias synthetic identifier.
 */
export function isInternalAuthEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${AUTH_IDENTIFIER_DOMAIN}`)
}
