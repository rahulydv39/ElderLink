/**
 * Time and adherence utilities for ElderLink medication management.
 * Application timezone default: Asia/Kolkata (+05:30).
 */

export type TimeOfDayCategory = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

/**
 * Format a 24-hour SQL time string (e.g. "08:00:00" or "14:30") into user-friendly 12-hour format ("8:00 AM", "2:30 PM").
 */
export function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr

  const hour = parseInt(parts[0], 10)
  const minute = parts[1].padStart(2, '0')

  if (isNaN(hour)) return timeStr

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return `${displayHour}:${minute} ${period}`
}

/**
 * Categorize a scheduled time into Morning, Afternoon, Evening, or Night.
 */
export function getTimeOfDayCategory(timeStr: string): TimeOfDayCategory {
  if (!timeStr) return 'Morning'
  const hour = parseInt(timeStr.split(':')[0], 10)
  if (isNaN(hour)) return 'Morning'

  if (hour >= 5 && hour < 12) return 'Morning'
  if (hour >= 12 && hour < 17) return 'Afternoon'
  if (hour >= 17 && hour < 21) return 'Evening'
  return 'Night'
}

/**
 * Get current date in Asia/Kolkata timezone formatted as YYYY-MM-DD.
 */
export function getKolkataTodayDateString(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now) // Format: "YYYY-MM-DD"
}

/**
 * Returns current timestamp in Asia/Kolkata formatted as an ISO-compatible TIMESTAMPTZ for a scheduled dose.
 * e.g., date = "2026-11-15", time = "08:00:00" -> "2026-11-15T08:00:00+05:30"
 */
export function buildKolkataScheduledTimestamp(dateStr: string, timeStr: string): string {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  return `${dateStr}T${normalizedTime}+05:30`
}

/**
 * Checks whether a medication schedule is active and applies to the given date.
 */
export function isScheduleApplicableOnDate(
  schedule: {
    is_active: boolean
    frequency: string
    days_of_week?: number[] | null
  },
  medication: {
    is_active: boolean
    start_date: string
    end_date?: string | null
  },
  targetDateStr: string
): boolean {
  if (!schedule.is_active || !medication.is_active) {
    return false
  }

  // Check date range
  if (targetDateStr < medication.start_date) {
    return false
  }
  if (medication.end_date && targetDateStr > medication.end_date) {
    return false
  }

  // Check frequency
  if (schedule.frequency === 'daily') {
    return true
  }

  // Weekly or custom: check day of week (0 = Sunday, 1 = Monday, ... 6 = Saturday)
  const targetDate = new Date(`${targetDateStr}T12:00:00+05:30`)
  const dayOfWeek = targetDate.getDay()

  const allowedDays = schedule.days_of_week || []
  return allowedDays.includes(dayOfWeek)
}

/**
 * Determines current display adherence state for today's dose:
 * - 'taken': log exists with status = 'taken'
 * - 'skipped': log exists with status = 'skipped'
 * - 'missed': log exists with status = 'missed' OR current time is 60+ minutes past scheduled time with no log
 * - 'due': current time is within +/- 60 minutes of scheduled time
 * - 'upcoming': scheduled time is more than 60 minutes in the future
 */
export type DoseAdherenceStatus = 'taken' | 'skipped' | 'missed' | 'due' | 'upcoming'

export function computeDoseStatus(
  scheduledForIso: string,
  logStatus?: 'taken' | 'skipped' | 'missed' | 'unconfirmed' | null
): DoseAdherenceStatus {
  if (logStatus === 'taken') return 'taken'
  if (logStatus === 'skipped') return 'skipped'
  if (logStatus === 'missed') return 'missed'

  const scheduledTime = new Date(scheduledForIso).getTime()
  const now = new Date().getTime()
  const diffMinutes = (now - scheduledTime) / (1000 * 60)

  // If more than 90 minutes have passed without a log, it is overdue / missed
  if (diffMinutes > 90) {
    return 'missed'
  }

  // If within window from 45 mins before up to 90 mins after
  if (diffMinutes >= -45 && diffMinutes <= 90) {
    return 'due'
  }

  // Otherwise, upcoming in the future
  return 'upcoming'
}

/**
 * Calculate adherence rate:
 * Adherence % = (Taken doses / Eligible scheduled doses) * 100
 * Exclude future doses and unconfirmed doses.
 * Returns null if no eligible doses.
 */
export function calculateAdherenceRate(
  takenCount: number,
  eligibleTotal: number
): number | null {
  if (eligibleTotal <= 0) return null
  const pct = (takenCount / eligibleTotal) * 100
  return Math.round(pct * 10) / 10
}
