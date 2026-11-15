/**
 * Phone number normalization and validation utilities for ElderLink.
 * Standards: E.164 international format (+[calling code][subscriber number]).
 */

export interface CountryCodeOption {
  code: string // e.g. '+91'
  country: string // e.g. 'India'
  flag: string // e.g. '🇮🇳'
  digits?: number
}

export const SUPPORTED_COUNTRY_CODES: CountryCodeOption[] = [
  { code: '+91', country: 'India', flag: '🇮🇳', digits: 10 },
  { code: '+1', country: 'United States & Canada', flag: '🇺🇸', digits: 10 },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', digits: 10 },
  { code: '+61', country: 'Australia', flag: '🇦🇺', digits: 9 },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', digits: 8 },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪', digits: 9 },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', digits: 9 },
  { code: '+49', country: 'Germany', flag: '🇩🇪', digits: 10 },
  { code: '+33', country: 'France', flag: '🇫🇷', digits: 9 },
  { code: '+81', country: 'Japan', flag: '🇯🇵', digits: 10 },
]

/**
 * Normalizes a country calling code and local subscriber number into E.164 format.
 * Example: ("+91", "98765 43210") -> "+919876543210"
 */
export function normalizePhoneNumber(countryCode: string, nationalNumber: string): string {
  // Strip all non-digit characters from the national number
  let digits = nationalNumber.replace(/\D/g, '')

  // Strip leading 0 if present (commonly entered in local subscriber notation)
  if (digits.startsWith('0') && digits.length > 1) {
    digits = digits.replace(/^0+/, '')
  }

  // Ensure country calling code has the leading '+'
  const cleanCode = countryCode.trim().startsWith('+')
    ? countryCode.trim()
    : `+${countryCode.replace(/\D/g, '')}`

  return `${cleanCode}${digits}`
}

/**
 * Validates a mobile number according to country expectations and E.164 ITU-T rules.
 */
export function validatePhoneNumber(
  countryCode: string,
  nationalNumber: string
): { isValid: boolean; error?: string } {
  const digits = nationalNumber.replace(/\D/g, '')

  if (!digits) {
    return { isValid: false, error: 'Mobile number is required.' }
  }

  // Specific check for India (+91)
  if (countryCode === '+91') {
    if (digits.length !== 10) {
      return {
        isValid: false,
        error: 'Indian mobile numbers must be exactly 10 digits.',
      }
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return {
        isValid: false,
        error: 'Indian mobile numbers must start with 6, 7, 8, or 9.',
      }
    }
  } else {
    // General ITU-T E.164 subscriber length: 7 to 15 digits
    if (digits.length < 7 || digits.length > 15) {
      return {
        isValid: false,
        error: 'Please enter a valid mobile number (between 7 and 15 digits).',
      }
    }
  }

  return { isValid: true }
}

/**
 * Formats an E.164 phone string for clear UI presentation.
 */
export function formatPhoneDisplay(e164Phone: string | null | undefined): string {
  if (!e164Phone) return ''
  const trimmed = e164Phone.trim()

  // India format: +91 98765 43210
  if (trimmed.startsWith('+91') && trimmed.length === 13) {
    return `+91 ${trimmed.slice(3, 8)} ${trimmed.slice(8)}`
  }

  // US/Canada format: +1 (555) 123-4567
  if (trimmed.startsWith('+1') && trimmed.length === 12) {
    return `+1 (${trimmed.slice(2, 5)}) ${trimmed.slice(5, 8)}-${trimmed.slice(8)}`
  }

  return trimmed
}
