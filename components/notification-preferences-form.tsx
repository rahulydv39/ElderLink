'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Pill,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Mail,
  Loader2,
  Lock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface NotificationPreferencesFormProps {
  userId: string
  initialPreferences: {
    medication_reminders: boolean
    missed_dose_alerts: boolean
    appointment_reminders: boolean
  } | null
  contactEmail: string
}

export function NotificationPreferencesForm({
  userId,
  initialPreferences,
  contactEmail,
}: NotificationPreferencesFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [medicationReminders, setMedicationReminders] = useState<boolean>(
    initialPreferences?.medication_reminders ?? false
  )
  const [missedDoseAlerts, setMissedDoseAlerts] = useState<boolean>(
    initialPreferences?.missed_dose_alerts ?? false
  )
  const [appointmentReminders, setAppointmentReminders] = useState<boolean>(
    initialPreferences?.appointment_reminders ?? false
  )

  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase.from('notification_preferences').upsert(
        {
          user_id: userId,
          medication_reminders: medicationReminders,
          missed_dose_alerts: missedDoseAlerts,
          appointment_reminders: appointmentReminders,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

      if (error) {
        throw error
      }

      setMessage({
        type: 'success',
        text: 'Notification preferences saved successfully.',
      })
      router.refresh()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save preferences.'
      setMessage({
        type: 'error',
        text: `Error saving preferences: ${msg}`,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Privacy Notice Banner */}
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-teal-50/50 to-blue-50 p-5 dark:border-sky-900/60 dark:from-slate-900 dark:via-teal-950/20 dark:to-slate-900 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 rounded-lg bg-teal-600/10 p-2 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Privacy-First Notifications
              <Badge variant="outline" className="text-[10px] bg-white/70 text-teal-700 dark:bg-slate-800 dark:text-teal-300 border-teal-200">
                PHI Safe
              </Badge>
            </h2>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Email notifications are delivered to the contact email address associated with your
              account. ElderLink does not currently verify email ownership. Notifications do not
              contain medication names, diagnoses, or patient details.
            </p>
          </div>
        </div>
      </div>

      {/* Recipient Contact Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Delivery Destination
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {contactEmail ? contactEmail : <span className="text-amber-600 dark:text-amber-400">No contact email configured</span>}
            </div>
          </div>
        </div>

        {contactEmail ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 self-start sm:self-auto">
            Ready for Delivery
          </Badge>
        ) : (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 self-start sm:self-auto">
            Email Required for Delivery
          </Badge>
        )}
      </div>

      {/* Preferences Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* 1. Medication Reminders */}
          <div className="p-6 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 shrink-0">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <label
                    htmlFor="toggle-medication-reminders"
                    className="text-base font-semibold text-slate-900 dark:text-white cursor-pointer select-none"
                  >
                    Medication Reminders
                  </label>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Receive scheduled email reminders when active prescribed medication doses become
                    due for elders in your Care Circle.
                  </p>
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    <span>Generic alert only — never names the medication or dosage.</span>
                  </div>
                </div>
              </div>

              {/* Accessible Custom Toggle Switch */}
              <button
                type="button"
                id="toggle-medication-reminders"
                role="switch"
                aria-checked={medicationReminders}
                onClick={() => setMedicationReminders(!medicationReminders)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  medicationReminders ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span className="sr-only">Enable medication reminders</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    medicationReminders ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 2. Missed-Dose Alerts */}
          <div className="p-6 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <label
                    htmlFor="toggle-missed-dose-alerts"
                    className="text-base font-semibold text-slate-900 dark:text-white cursor-pointer select-none"
                  >
                    Missed-Dose Alerts
                  </label>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Receive high-priority notifications when a scheduled medication dose remains
                    unrecorded 90 minutes after its scheduled time.
                  </p>
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    <span>Dispatched after standard 90-minute grace window.</span>
                  </div>
                </div>
              </div>

              {/* Accessible Custom Toggle Switch */}
              <button
                type="button"
                id="toggle-missed-dose-alerts"
                role="switch"
                aria-checked={missedDoseAlerts}
                onClick={() => setMissedDoseAlerts(!missedDoseAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  missedDoseAlerts ? 'bg-amber-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span className="sr-only">Enable missed-dose alerts</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    missedDoseAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. Appointment Reminders */}
          <div className="p-6 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <label
                    htmlFor="toggle-appointment-reminders"
                    className="text-base font-semibold text-slate-900 dark:text-white cursor-pointer select-none"
                  >
                    Appointment Reminders
                  </label>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Receive reminder emails 24 hours and 2 hours prior to upcoming doctor visits
                    and medical appointments.
                  </p>
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    <span>Dispatched in 24-hour and 2-hour pre-visit windows.</span>
                  </div>
                </div>
              </div>

              {/* Accessible Custom Toggle Switch */}
              <button
                type="button"
                id="toggle-appointment-reminders"
                role="switch"
                aria-checked={appointmentReminders}
                onClick={() => setAppointmentReminders(!appointmentReminders)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  appointmentReminders ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span className="sr-only">Enable appointment reminders</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    appointmentReminders ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {message && (
          <div
            className={`flex items-start gap-3 rounded-xl p-4 text-sm font-medium ${
              message.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            )}
            <div>{message.text}</div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 order-2 sm:order-1"
          >
            ← Return to Dashboard
          </Link>

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-xs order-1 sm:order-2 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Preferences...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Notification Preferences</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
