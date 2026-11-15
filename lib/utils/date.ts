/**
 * Calculate age in completed years from an ISO or YYYY-MM-DD date of birth string.
 */
export function calculateAge(dateOfBirth: string): number {
  if (!dateOfBirth) return 0
  const dob = new Date(dateOfBirth)
  if (isNaN(dob.getTime())) return 0

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return Math.max(0, age)
}

/**
 * Checks whether a given YYYY-MM-DD date is in the future.
 */
export function isFutureDate(dateString: string): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date > today
}

/**
 * Formats a YYYY-MM-DD date string into a user-friendly format (e.g., Aug 14, 1948).
 */
export function formatDisplayDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
