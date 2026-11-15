/**
 * Date, time, and formatting utilities for ElderLink appointments.
 * Default application timezone: Asia/Kolkata (+05:30).
 */

/**
 * Combines date (YYYY-MM-DD) and time (HH:MM) into an ISO string with Asia/Kolkata offset (+05:30).
 */
export function combineDateAndTimeToKolkataIso(dateStr: string, timeStr: string): string {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  return `${dateStr}T${normalizedTime}+05:30`
}

/**
 * Extracts the YYYY-MM-DD date part in Asia/Kolkata timezone from an ISO timestamptz string.
 */
export function extractKolkataDate(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date) // "YYYY-MM-DD"
}

/**
 * Extracts the HH:MM time part in Asia/Kolkata timezone from an ISO timestamptz string.
 */
export function extractKolkataTime(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return formatter.format(date) // "HH:MM"
}

/**
 * Formats an appointment date & time nicely in Asia/Kolkata timezone:
 * e.g., "Thu, Nov 20, 2026 &bull; 10:30 AM"
 */
export function formatAppointmentDateTime(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${dateFormatter.format(date)} at ${timeFormatter.format(date)}`
}

/**
 * Formats short appointment date (e.g. "Nov 20, 2026").
 */
export function formatAppointmentDateOnly(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * Formats appointment time only (e.g. "10:30 AM").
 */
export function formatAppointmentTimeOnly(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Checks if an appointment timestamp is in the past.
 */
export function isAppointmentPast(isoString: string): boolean {
  if (!isoString) return false
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return false
  return date.getTime() < Date.now()
}

/**
 * Returns a human-friendly relative indicator (e.g. "Today", "Tomorrow", "In 3 days", "Past").
 */
export function getRelativeAppointmentDay(isoString: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''

  const apptDateKolkata = extractKolkataDate(isoString)
  const todayKolkata = extractKolkataDate(new Date().toISOString())

  if (apptDateKolkata === todayKolkata) {
    return 'Today'
  }

  // Calculate day difference
  const apptTime = new Date(`${apptDateKolkata}T00:00:00+05:30`).getTime()
  const todayTime = new Date(`${todayKolkata}T00:00:00+05:30`).getTime()
  const diffDays = Math.round((apptTime - todayTime) / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays > 7) return `In ${Math.ceil(diffDays / 7)} weeks`
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`

  return ''
}
