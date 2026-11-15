import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'

/**
 * ElderLink Notification Scheduler Edge Function
 * Invoked by pg_cron on a 1-minute schedule.
 *
 * Responsibilities:
 * 1. Authenticates invocation via ELDERLINK_CRON_SECRET bearer token using constant-time comparison.
 * 2. Evaluates active medication schedules in Asia/Kolkata (+05:30).
 * 3. Dispatches regular medication dose reminders (5-min lookback window).
 * 4. Detects missed doses (>90 min grace period), records missed logs, and alerts caregivers.
 * 5. Dispatches appointment reminders at 24h and 2h windows.
 * 6. Filters out synthetic phone-alias emails (@auth.elderlink.invalid) and respects opt-in preferences.
 * 7. Enforces database and Resend idempotency keys.
 * 8. Never reveals elder names, medication names, dosages, or clinical notes in email subjects or bodies.
 */

// Constant-time string equality check to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

// Deterministic SHA-256 event key generator
async function generateEventKey(
  eventType: string,
  eventIdentity: string,
  scheduledOccurrence: string,
  recipientUserId: string
): Promise<string> {
  const raw = `${eventType}:${eventIdentity}:${scheduledOccurrence}:${recipientUserId}`
  const msgBuffer = new TextEncoder().encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Convert UTC Date into Asia/Kolkata date parts and formatted strings
function getKolkataTimeContext(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  })

  const parts = formatter.formatToParts(now)
  const map: Record<string, string> = {}
  for (const p of parts) {
    map[p.type] = p.value
  }

  const year = map.year
  const month = map.month
  const day = map.day
  const todayDateStr = `${year}-${month}-${day}` // YYYY-MM-DD
  const hour = parseInt(map.hour, 10)
  const minute = parseInt(map.minute, 10)
  const second = parseInt(map.second, 10)

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const dayOfWeek = weekdayMap[map.weekday] ?? 0

  return {
    nowMs: now.getTime(),
    todayDateStr,
    hour,
    minute,
    second,
    dayOfWeek,
  }
}

// Generic, privacy-safe HTML email generator
function renderEmailHtml(title: string, message: string, ctaText: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #334155; }
    .container { max-width: 580px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 32px 24px; }
    .content h2 { margin-top: 0; font-size: 18px; color: #0f172a; }
    .content p { font-size: 15px; line-height: 1.6; color: #475569; margin: 16px 0; }
    .btn { display: inline-block; background-color: #0d9488; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ElderLink</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <p>${message}</p>
      <p>For patient confidentiality and clinical safety, medical details and dosages are securely managed inside your care portal.</p>
      <p style="text-align: center;">
        <a href="${ctaUrl}" class="btn">${ctaText}</a>
      </p>
    </div>
    <div class="footer">
      <p>ElderLink — Secure Collaborative Elderly Healthcare & Care Circle Platform</p>
      <p>This is an automated notification. To update your notification preferences, visit your account settings.</p>
    </div>
  </div>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  // 1. Only POST is accepted
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Secret Bearer Token Verification
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.slice(7).trim()
  const expectedSecret = Deno.env.get('ELDERLINK_CRON_SECRET') || ''
  if (!expectedSecret || !timingSafeEqual(token, expectedSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid secret' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Environment & Clients
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'ElderLink <notifications@elderlink.health>'
  const appUrl = (Deno.env.get('ELDERLINK_APP_URL') || 'https://elderlink.health').replace(/\/$/, '')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { nowMs, todayDateStr, dayOfWeek } = getKolkataTimeContext()

  const summary = {
    timestamp: new Date().toISOString(),
    processedEvents: 0,
    sentNotifications: 0,
    failedNotifications: 0,
    skippedNotifications: 0,
    missedLogsRecorded: 0,
  }

  // Helper to send email via Resend REST API
  async function sendResendEmail(
    toEmail: string,
    subject: string,
    html: string,
    text: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!resendApiKey) {
      return { success: false, error: 'RESEND_API_KEY_NOT_CONFIGURED' }
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [toEmail],
          subject,
          html,
          text,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('Resend delivery error:', res.status, errText)
        return {
          success: false,
          error: res.status === 429 ? 'RATE_LIMIT_EXCEEDED' : `RESEND_HTTP_${res.status}`,
        }
      }

      const data = await res.json()
      return { success: true, messageId: data?.id }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'NETWORK_ERROR'
      return { success: false, error: msg }
    }
  }

  // Helper to resolve eligible recipients for an elder profile
  async function resolveRecipients(elderProfileId: string) {
    // 1. Fetch elder profile owner
    const { data: elder } = await supabase
      .from('elder_profiles')
      .select('owner_user_id')
      .eq('id', elderProfileId)
      .single()

    const recipientIds = new Set<string>()
    if (elder?.owner_user_id) {
      recipientIds.add(elder.owner_user_id)
    }

    // 2. Fetch care circle members with view permission
    const { data: members } = await supabase
      .from('care_circle_members')
      .select('member_user_id')
      .eq('elder_profile_id', elderProfileId)
      .eq('can_view_medical_info', true)

    if (members) {
      for (const m of members) {
        if (m.member_user_id) {
          recipientIds.add(m.member_user_id)
        }
      }
    }

    if (recipientIds.size === 0) return []

    // 3. Fetch profiles and preferences
    const idList = Array.from(recipientIds)
    const [profilesRes, prefsRes] = await Promise.all([
      supabase.from('profiles').select('id, email').in('id', idList),
      supabase.from('notification_preferences').select('*').in('user_id', idList),
    ])

    interface PreferenceRow {
      user_id: string
      medication_reminders: boolean
      missed_dose_alerts: boolean
      appointment_reminders: boolean
    }

    const prefMap = new Map<string, PreferenceRow>(
      ((prefsRes.data as PreferenceRow[] | null) || []).map((p) => [p.user_id, p])
    )

    const validRecipients: {
      userId: string
      email: string
      preferences: {
        medication_reminders: boolean
        missed_dose_alerts: boolean
        appointment_reminders: boolean
      }
    }[] = []

    for (const p of profilesRes.data || []) {
      const email = (p.email || '').trim()
      // Skip empty, invalid, or internal phone-alias identifiers
      if (!email || email.endsWith('@auth.elderlink.invalid') || !email.includes('@')) {
        continue
      }

      const userPref = prefMap.get(p.id)
      validRecipients.push({
        userId: p.id,
        email,
        preferences: {
          medication_reminders: userPref?.medication_reminders ?? false,
          missed_dose_alerts: userPref?.missed_dose_alerts ?? false,
          appointment_reminders: userPref?.appointment_reminders ?? false,
        },
      })
    }

    return validRecipients
  }

  try {
    // =========================================================================
    // SECTION A: MEDICATION REMINDERS & MISSED DOSES
    // =========================================================================
    const { data: activeMeds } = await supabase
      .from('medications')
      .select(`
        id,
        elder_profile_id,
        start_date,
        end_date,
        medication_schedules (
          id,
          time,
          frequency,
          days_of_week,
          is_active
        )
      `)
      .eq('is_active', true)
      .lte('start_date', todayDateStr)

    for (const med of activeMeds || []) {
      if (med.end_date && med.end_date < todayDateStr) {
        continue
      }

      const schedules = (med.medication_schedules as Array<{
        id: string
        time: string
        frequency: string
        days_of_week: number[] | null
        is_active: boolean
      }>) || []

      for (const sched of schedules) {
        if (!sched.is_active) continue

        // Check frequency & day of week
        if (sched.frequency !== 'daily') {
          const days = sched.days_of_week || []
          if (!days.includes(dayOfWeek)) {
            continue
          }
        }

        const normalizedTime = sched.time.length === 5 ? `${sched.time}:00` : sched.time
        const scheduledOccurrenceIso = `${todayDateStr}T${normalizedTime}+05:30`
        const scheduledTimeMs = new Date(scheduledOccurrenceIso).getTime()
        const diffMinutes = (nowMs - scheduledTimeMs) / (1000 * 60)

        // 1. Regular Dose Reminder Window: due now (0 to 5 minutes lookback)
        if (diffMinutes >= 0 && diffMinutes <= 5) {
          summary.processedEvents++

          // Check if dose already recorded
          const { data: existingLog } = await supabase
            .from('medication_logs')
            .select('id, status')
            .eq('schedule_id', sched.id)
            .eq('scheduled_for', scheduledOccurrenceIso)
            .maybeSingle()

          if (!existingLog) {
            const recipients = await resolveRecipients(med.elder_profile_id)
            for (const r of recipients) {
              if (!r.preferences.medication_reminders) {
                summary.skippedNotifications++
                continue
              }

              const eventKey = await generateEventKey(
                'medication_reminder',
                sched.id,
                scheduledOccurrenceIso,
                r.userId
              )

              // Atomic claim
              const { data: claimed } = await supabase.rpc('claim_notification_event', {
                p_event_key: eventKey,
                p_event_type: 'medication_reminder',
                p_recipient_user_id: r.userId,
              })

              if (claimed) {
                const subject = 'ElderLink Notification: Scheduled Medication Dose'
                const msg =
                  'A scheduled medication dose is due in your ElderLink care circle. Please sign in to verify administration.'
                const html = renderEmailHtml(
                  'Scheduled Medication Dose',
                  msg,
                  'Open ElderLink Dashboard',
                  `${appUrl}/dashboard`
                )
                const text = `ElderLink Notification: Scheduled Medication Dose\n\n${msg}\n\nPlease visit: ${appUrl}/dashboard`

                const sendResult = await sendResendEmail(r.email, subject, html, text, eventKey)
                if (sendResult.success) {
                  summary.sentNotifications++
                  await supabase.rpc('complete_notification_delivery', {
                    p_event_key: eventKey,
                    p_provider_message_id: sendResult.messageId || null,
                  })
                } else {
                  summary.failedNotifications++
                  await supabase.rpc('fail_notification_delivery', {
                    p_event_key: eventKey,
                    p_error_code: sendResult.error || 'UNKNOWN_ERROR',
                    p_retry_delay_seconds: 300,
                  })
                }
              }
            }
          }
        }

        // 2. Missed-Dose Processing Window: > 90 minutes grace period elapsed (within 90 to 240 mins)
        if (diffMinutes >= 90 && diffMinutes <= 240) {
          summary.processedEvents++

          const { data: existingLog } = await supabase
            .from('medication_logs')
            .select('id, status')
            .eq('schedule_id', sched.id)
            .eq('scheduled_for', scheduledOccurrenceIso)
            .maybeSingle()

          let missedAlertNeeded = false

          if (!existingLog) {
            // Automatically insert system missed dose record
            const { error: insertError } = await supabase.from('medication_logs').insert({
              medication_id: med.id,
              schedule_id: sched.id,
              elder_profile_id: med.elder_profile_id,
              scheduled_for: scheduledOccurrenceIso,
              status: 'missed',
              recorded_by: null,
              adherence_notes: 'Automated adherence monitor (90-minute grace window expired)',
              recorded_at: new Date().toISOString(),
            })

            if (!insertError) {
              summary.missedLogsRecorded++
              missedAlertNeeded = true
            }
          } else if (existingLog.status === 'missed') {
            missedAlertNeeded = true
          }

          if (missedAlertNeeded) {
            const recipients = await resolveRecipients(med.elder_profile_id)
            for (const r of recipients) {
              if (!r.preferences.missed_dose_alerts) {
                summary.skippedNotifications++
                continue
              }

              const eventKey = await generateEventKey(
                'missed_dose_alert',
                sched.id,
                scheduledOccurrenceIso,
                r.userId
              )

              const { data: claimed } = await supabase.rpc('claim_notification_event', {
                p_event_key: eventKey,
                p_event_type: 'missed_dose_alert',
                p_recipient_user_id: r.userId,
              })

              if (claimed) {
                const subject = 'ElderLink Alert: Pending Medication Check'
                const msg =
                  'A scheduled medication dose has passed its 90-minute window without being recorded in your care circle.'
                const html = renderEmailHtml(
                  'Pending Medication Check',
                  msg,
                  'Review Adherence Log',
                  `${appUrl}/dashboard`
                )
                const text = `ElderLink Alert: Pending Medication Check\n\n${msg}\n\nPlease visit: ${appUrl}/dashboard`

                const sendResult = await sendResendEmail(r.email, subject, html, text, eventKey)
                if (sendResult.success) {
                  summary.sentNotifications++
                  await supabase.rpc('complete_notification_delivery', {
                    p_event_key: eventKey,
                    p_provider_message_id: sendResult.messageId || null,
                  })
                } else {
                  summary.failedNotifications++
                  await supabase.rpc('fail_notification_delivery', {
                    p_event_key: eventKey,
                    p_error_code: sendResult.error || 'UNKNOWN_ERROR',
                    p_retry_delay_seconds: 300,
                  })
                }
              }
            }
          }
        }
      }
    }

    // =========================================================================
    // SECTION B: APPOINTMENT REMINDERS (24h and 2h windows)
    // =========================================================================
    const { data: upcomingAppts } = await supabase
      .from('appointments')
      .select('id, elder_profile_id, appointment_date, status')
      .eq('status', 'scheduled')
      .gt('appointment_date', new Date().toISOString())

    for (const appt of upcomingAppts || []) {
      const apptMs = new Date(appt.appointment_date).getTime()
      const diffHours = (apptMs - nowMs) / (1000 * 60 * 60)

      let reminderType: 'appointment_reminder_24h' | 'appointment_reminder_2h' | null = null
      let reminderSubject = ''
      let reminderMsg = ''

      // 24-hour reminder window: between 23.5 and 24.5 hours ahead
      if (diffHours >= 23.5 && diffHours <= 24.5) {
        reminderType = 'appointment_reminder_24h'
        reminderSubject = 'ElderLink Reminder: Upcoming Clinical Consultation Tomorrow'
        reminderMsg =
          'A medical appointment is scheduled for tomorrow in your ElderLink care circle. Please sign in to review visit notes and clinic details.'
      }
      // 2-hour reminder window: between 1.5 and 2.5 hours ahead
      else if (diffHours >= 1.5 && diffHours <= 2.5) {
        reminderType = 'appointment_reminder_2h'
        reminderSubject = 'ElderLink Reminder: Upcoming Clinical Consultation Today'
        reminderMsg =
          'A medical visit is scheduled within approximately 2 hours in your ElderLink care circle. Please check directions and arrival preparation.'
      }

      if (reminderType) {
        summary.processedEvents++
        const recipients = await resolveRecipients(appt.elder_profile_id)

        for (const r of recipients) {
          if (!r.preferences.appointment_reminders) {
            summary.skippedNotifications++
            continue
          }

          const eventKey = await generateEventKey(
            reminderType,
            appt.id,
            appt.appointment_date,
            r.userId
          )

          const { data: claimed } = await supabase.rpc('claim_notification_event', {
            p_event_key: eventKey,
            p_event_type: reminderType,
            p_recipient_user_id: r.userId,
          })

          if (claimed) {
            const html = renderEmailHtml(
              'Upcoming Clinical Consultation',
              reminderMsg,
              'View Appointment Details',
              `${appUrl}/dashboard`
            )
            const text = `${reminderSubject}\n\n${reminderMsg}\n\nPlease visit: ${appUrl}/dashboard`

            const sendResult = await sendResendEmail(r.email, reminderSubject, html, text, eventKey)
            if (sendResult.success) {
              summary.sentNotifications++
              await supabase.rpc('complete_notification_delivery', {
                p_event_key: eventKey,
                p_provider_message_id: sendResult.messageId || null,
              })
            } else {
              summary.failedNotifications++
              await supabase.rpc('fail_notification_delivery', {
                p_event_key: eventKey,
                p_error_code: sendResult.error || 'UNKNOWN_ERROR',
                p_retry_delay_seconds: 300,
              })
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ status: 'success', summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'INTERNAL_SCHEDULER_ERROR'
    console.error('Fatal scheduler worker error:', err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
