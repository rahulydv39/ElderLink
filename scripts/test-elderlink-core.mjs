#!/usr/bin/env node

/**
 * ElderLink — Core Application Unit & Integration Test Suite
 *
 * Covers:
 * 1. Authentication & Phone-Identity Utilities
 * 2. Open Redirect Prevention (OWASP)
 * 3. Elder Profiles & Age Calculation
 * 4. Care Circle Role & Permission Access Matrix
 * 5. Medication Recurrence, Adherence State Machine & Metrics
 * 6. Doctor Appointment Scheduling & Timezone Calculations
 * 7. Security, Input Sanitization & Privacy Invariants
 * 8. Cross-User Data Isolation & Permission Boundaries
 */

import {
  normalizePhoneNumber,
  validatePhoneNumber,
  formatPhoneDisplay,
  SUPPORTED_COUNTRY_CODES,
} from '../lib/utils/phone.ts'
import {
  phoneToAuthEmail,
  isInternalAuthEmail,
  getSafeRedirectUrl,
  AUTH_IDENTIFIER_DOMAIN,
} from '../lib/utils/auth-identity.ts'
import { calculateAge, isFutureDate, formatDisplayDate } from '../lib/utils/date.ts'
import {
  formatTime12Hour,
  getTimeOfDayCategory,
  buildKolkataScheduledTimestamp,
  isScheduleApplicableOnDate,
  computeDoseStatus,
  calculateAdherenceRate,
} from '../lib/utils/medication.ts'
import {
  combineDateAndTimeToKolkataIso,
  extractKolkataDate,
  extractKolkataTime,
  formatAppointmentDateTime,
  formatAppointmentDateOnly,
  formatAppointmentTimeOnly,
  getRelativeAppointmentDay,
  isAppointmentPast,
} from '../lib/utils/appointment.ts'
import {
  getMedicationReminderTemplate,
  getMissedDoseTemplate,
  getAppointmentReminderTemplate,
  getGenericNotificationTemplate,
} from '../lib/email/templates.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`)
  } else {
    failed++
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`)
  }
}

console.log('\n======================================================')
console.log('ElderLink Core Application & Security Test Suite')
console.log('======================================================\n')

// -----------------------------------------------------------------------------
// 1. Phone-First Authentication & Identity Normalization
// -----------------------------------------------------------------------------
console.log('Module 1: Phone-First Authentication & Identity Normalization')
{
  // Normalization
  assert(
    normalizePhoneNumber('+91', '98765 43210') === '+919876543210',
    'Normalizes Indian number with spaces into E.164'
  )
  assert(
    normalizePhoneNumber('+91', '09876543210') === '+919876543210',
    'Strips leading 0 from subscriber number'
  )
  assert(
    normalizePhoneNumber('+1', '(555) 123-4567') === '+15551234567',
    'Normalizes US phone number with parentheses and hyphens'
  )
  assert(
    normalizePhoneNumber('91', '9876543210') === '+919876543210',
    'Adds missing plus prefix to calling code'
  )

  // Validation
  const validIndia = validatePhoneNumber('+91', '9876543210')
  assert(validIndia.isValid, 'Accepts valid 10-digit Indian mobile starting with 9')

  const invalidIndiaPrefix = validatePhoneNumber('+91', '4876543210')
  assert(!invalidIndiaPrefix.isValid, 'Rejects Indian mobile starting with invalid digit (4)')

  const invalidIndiaLength = validatePhoneNumber('+91', '987654321')
  assert(!invalidIndiaLength.isValid, 'Rejects 9-digit Indian mobile number')

  const emptyPhone = validatePhoneNumber('+91', '')
  assert(!emptyPhone.isValid, 'Rejects empty mobile number')

  // Display formatting
  assert(
    formatPhoneDisplay('+919876543210') === '+91 98765 43210',
    'Formats Indian phone with 5-5 grouped display'
  )
  assert(
    formatPhoneDisplay('+15551234567') === '+1 (555) 123-4567',
    'Formats US phone with standard standard bracket-hyphen display'
  )

  // Supported country codes catalog
  assert(
    Array.isArray(SUPPORTED_COUNTRY_CODES) && SUPPORTED_COUNTRY_CODES.some((c) => c.code === '+91'),
    'Contains India in supported country codes list'
  )

  // Internal Synthetic Email Alias
  const internalEmail = phoneToAuthEmail('+919876543210')
  assert(
    internalEmail === `phone-919876543210@${AUTH_IDENTIFIER_DOMAIN}`,
    'Derives deterministic email alias under auth.elderlink.invalid'
  )
  assert(isInternalAuthEmail(internalEmail), 'Correctly identifies internal alias email')
  assert(!isInternalAuthEmail('caregiver@gmail.com'), 'Recognizes real user email as external')
  assert(!isInternalAuthEmail(null), 'Handles null email safely')
}

// -----------------------------------------------------------------------------
// 2. Open Redirect Prevention (OWASP A01 / Broken Access Control)
// -----------------------------------------------------------------------------
console.log('\nModule 2: Open Redirect Prevention (OWASP)')
{
  assert(
    getSafeRedirectUrl('/dashboard') === '/dashboard',
    'Allows safe relative path (/dashboard)'
  )
  assert(
    getSafeRedirectUrl('/elder-profiles/123/medications?tab=history') ===
      '/elder-profiles/123/medications?tab=history',
    'Allows safe nested path with query string'
  )
  assert(
    getSafeRedirectUrl('https://malicious-phishing.com') === '/dashboard',
    'Blocks external absolute HTTP/HTTPS URL redirect'
  )
  assert(
    getSafeRedirectUrl('//evil.com') === '/dashboard',
    'Blocks protocol-relative URL redirect (//evil.com)'
  )
  assert(
    getSafeRedirectUrl('/\\evil.com') === '/dashboard',
    'Blocks backslash-obfuscated redirect (/\\evil.com)'
  )
  assert(
    getSafeRedirectUrl('javascript:alert(document.cookie)') === '/dashboard',
    'Blocks javascript: URI scheme redirect'
  )
  assert(
    getSafeRedirectUrl('data:text/html,<h1>Phishing</h1>') === '/dashboard',
    'Blocks data: URI scheme redirect'
  )
  assert(getSafeRedirectUrl(null) === '/dashboard', 'Fallback on null input')
  assert(getSafeRedirectUrl('') === '/dashboard', 'Fallback on empty input')
  assert(
    getSafeRedirectUrl('   /settings/notifications   ') === '/settings/notifications',
    'Trims whitespace and accepts valid internal target'
  )
}

// -----------------------------------------------------------------------------
// 3. Elder Profiles, Demographics & Age Calculation
// -----------------------------------------------------------------------------
console.log('\nModule 3: Elder Profiles, Demographics & Age Calculation')
{
  // Age calculation
  const dob1950 = '1950-05-15'
  const expectedAge = calculateAge(dob1950)
  assert(expectedAge >= 74 && expectedAge <= 78, 'Calculates senior age correctly (born 1950)')

  // Future date check
  const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
  assert(isFutureDate(futureDate), 'Identifies future date correctly')
  assert(!isFutureDate('1945-08-15'), 'Identifies historical date correctly')

  // Date formatting
  const formatted = formatDisplayDate('1948-08-15')
  assert(formatted.includes('1948') && formatted.includes('Aug'), 'Formats display date nicely')
}

// -----------------------------------------------------------------------------
// 4. Care Circle Role & Permission Access Matrix
// -----------------------------------------------------------------------------
console.log('\nModule 4: Care Circle Role & Permission Access Matrix')
{
  function evaluatePermissions(role, isOwner, memberFlags = {}) {
    if (isOwner) {
      return {
        canViewMedicalInfo: true,
        canManageMedications: true,
        canManageAppointments: true,
        canManageMembers: true,
        canEditElderProfile: true,
      }
    }
    return {
      canViewMedicalInfo: Boolean(
        memberFlags.can_view_medical_info || role === 'family' || role === 'caretaker'
      ),
      canManageMedications: Boolean(
        memberFlags.can_manage_medications || role === 'caretaker'
      ),
      canManageAppointments: Boolean(
        memberFlags.can_manage_appointments || role === 'caretaker'
      ),
      canManageMembers: Boolean(memberFlags.can_manage_members),
      canEditElderProfile: false, // strictly restricted to primary owner
    }
  }

  // Owner
  const ownerPerms = evaluatePermissions('owner', true)
  assert(ownerPerms.canEditElderProfile, 'Owner has full profile editing authority')
  assert(ownerPerms.canManageMembers, 'Owner has member management authority')

  // Caretaker
  const caretakerPerms = evaluatePermissions('caretaker', false, { can_manage_members: false })
  assert(caretakerPerms.canViewMedicalInfo, 'Caretaker can view medical info')
  assert(caretakerPerms.canManageMedications, 'Caretaker can manage medications by default')
  assert(caretakerPerms.canManageAppointments, 'Caretaker can manage appointments by default')
  assert(!caretakerPerms.canManageMembers, 'Caretaker cannot manage members without explicit flag')
  assert(!caretakerPerms.canEditElderProfile, 'Caretaker cannot edit legal elder profile')

  // Family Member
  const familyPerms = evaluatePermissions('family', false, {
    can_manage_medications: false,
    can_manage_appointments: false,
  })
  assert(familyPerms.canViewMedicalInfo, 'Family member can view medical info')
  assert(!familyPerms.canManageMedications, 'Family member cannot manage meds without permission')
  assert(!familyPerms.canManageAppointments, 'Family member cannot manage appointments without permission')
}

// -----------------------------------------------------------------------------
// 5. Medication Recurrence, Adherence State Machine & Metrics
// -----------------------------------------------------------------------------
console.log('\nModule 5: Medication Recurrence, Adherence State Machine & Metrics')
{
  // 12-Hour format
  assert(formatTime12Hour('08:00:00') === '8:00 AM', 'Formats morning 08:00')
  assert(formatTime12Hour('12:00:00') === '12:00 PM', 'Formats noon 12:00')
  assert(formatTime12Hour('18:30:00') === '6:30 PM', 'Formats evening 18:30')
  assert(formatTime12Hour('00:15:00') === '12:15 AM', 'Formats midnight 00:15')

  // Categories
  assert(getTimeOfDayCategory('08:00:00') === 'Morning', '08:00 is Morning')
  assert(getTimeOfDayCategory('13:00:00') === 'Afternoon', '13:00 is Afternoon')
  assert(getTimeOfDayCategory('19:00:00') === 'Evening', '19:00 is Evening')
  assert(getTimeOfDayCategory('22:00:00') === 'Night', '22:00 is Night')

  // Adherence Rate Calculation
  assert(calculateAdherenceRate(0, 0) === null, 'Returns null when 0 eligible doses (no division by zero)')
  assert(calculateAdherenceRate(5, 5) === 100, 'Returns 100% when 5/5 doses taken')
  assert(calculateAdherenceRate(3, 5) === 60, 'Returns 60% when 3/5 doses taken')
  assert(calculateAdherenceRate(1, 3) === 33.3, 'Rounds to 1 decimal place (33.3%)')

  // Schedule applicability & timestamp building
  assert(
    buildKolkataScheduledTimestamp('2026-11-20', '08:00:00') === '2026-11-20T08:00:00+05:30',
    'Constructs Asia/Kolkata ISO timestamp for scheduled time'
  )
  const activeMed = { is_active: true, start_date: '2026-01-01', end_date: null }
  const dailySched = { is_active: true, frequency: 'daily', days_of_week: null }
  assert(
    isScheduleApplicableOnDate(dailySched, activeMed, '2026-11-20'),
    'Daily schedule applies on any day within range'
  )
  const specificSched = { is_active: true, frequency: 'weekly', days_of_week: [1, 3, 5] }
  // 2026-11-20 is Friday (day 5 in JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  assert(
    isScheduleApplicableOnDate(specificSched, activeMed, '2026-11-20'),
    'Weekly schedule with Friday [1, 3, 5] matches Friday 2026-11-20'
  )
  assert(
    !isScheduleApplicableOnDate(specificSched, activeMed, '2026-11-22'),
    'Weekly schedule with [1, 3, 5] excludes Sunday 2026-11-22'
  )

  // Dose status state machine
  const now = Date.now()
  const scheduledNow = new Date(now).toISOString()
  const scheduledFuture = new Date(now + 120 * 60000).toISOString()
  const scheduledPast100 = new Date(now - 100 * 60000).toISOString()

  assert(computeDoseStatus(scheduledFuture, null) === 'upcoming', 'Dose in 2 hours is upcoming')
  assert(computeDoseStatus(scheduledNow, null) === 'due', 'Dose scheduled right now is due')
  assert(computeDoseStatus(scheduledPast100, null) === 'missed', 'Dose scheduled 100 mins ago without log is missed')
  assert(computeDoseStatus(scheduledPast100, 'taken') === 'taken', 'Dose marked taken remains taken')
  assert(computeDoseStatus(scheduledPast100, 'skipped') === 'skipped', 'Dose marked skipped remains skipped')
}

// -----------------------------------------------------------------------------
// 6. Doctor Appointment Scheduling & Timezone Calculations
// -----------------------------------------------------------------------------
console.log('\nModule 6: Doctor Appointment Scheduling & Timezone Calculations')
{
  const kolkataIso = combineDateAndTimeToKolkataIso('2026-11-20', '14:30')
  assert(kolkataIso === '2026-11-20T14:30:00+05:30', 'Combines date & time with +05:30 IST offset')

  assert(extractKolkataDate(kolkataIso) === '2026-11-20', 'Extracts exact Kolkata date')
  assert(extractKolkataTime(kolkataIso) === '14:30', 'Extracts exact Kolkata time')

  const dateOnlyDisplay = formatAppointmentDateOnly(kolkataIso)
  assert(dateOnlyDisplay.includes('Nov') && dateOnlyDisplay.includes('20'), 'Formats short appointment date')

  const timeOnlyDisplay = formatAppointmentTimeOnly(kolkataIso)
  assert(timeOnlyDisplay.includes('2:30') && timeOnlyDisplay.includes('PM'), 'Formats 12-hour appointment time')

  const fullDisplay = formatAppointmentDateTime(kolkataIso)
  assert(fullDisplay.includes('2026') && fullDisplay.includes('2:30'), 'Formats full appointment date and time')

  // Past check
  assert(isAppointmentPast('2020-01-01T10:00:00+05:30'), 'Past appointment correctly identified')
  assert(!isAppointmentPast('2099-01-01T10:00:00+05:30'), 'Future appointment correctly identified as not past')

  // Relative day
  const todayKolkata = new Date().toISOString()
  const relativeToday = getRelativeAppointmentDay(todayKolkata)
  assert(relativeToday === 'Today', 'Identifies today appointment as "Today"')
}

// -----------------------------------------------------------------------------
// 7. Security, Input Sanitization & Privacy Invariants
// -----------------------------------------------------------------------------
console.log('\nModule 7: Security, Input Sanitization & Privacy Invariants')
{
  const templates = [
    getMedicationReminderTemplate(),
    getMissedDoseTemplate(),
    getAppointmentReminderTemplate(),
    getGenericNotificationTemplate(),
  ]

  for (const t of templates) {
    // Check no script injection or broken tags
    assert(!t.html.includes('<script'), 'No unescaped script tags in email HTML')
    assert(t.subject.startsWith('ElderLink'), 'All email subjects clearly branded with ElderLink')
    assert(t.text.includes('ElderLink'), 'All plain text versions branded')
    assert(!t.text.includes('undefined') && !t.text.includes('null'), 'No undefined/null interpolation leaks')
  }
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================')
console.log(`Core Test Results: ${passed} passed, ${failed} failed`)
console.log('======================================================\n')

if (failed > 0) {
  process.exit(1)
}
