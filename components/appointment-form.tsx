'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  User,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database, AppointmentStatus } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  combineDateAndTimeToKolkataIso,
  extractKolkataDate,
  extractKolkataTime,
  isAppointmentPast,
} from '@/lib/utils/appointment'

type AppointmentRow = Database['public']['Tables']['appointments']['Row']

interface AppointmentFormProps {
  mode: 'create' | 'edit'
  elderId: string
  elderName: string
  appointment?: AppointmentRow
  cancelHref?: string
}

const STATUS_OPTIONS: { label: string; value: AppointmentStatus }[] = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

export function AppointmentForm({
  mode,
  elderId,
  elderName,
  appointment,
  cancelHref = `/elder-profiles/${elderId}/appointments`,
}: AppointmentFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Form field state
  const [doctorName, setDoctorName] = useState(appointment?.doctor_name || '')
  const [hospitalName, setHospitalName] = useState(appointment?.hospital_name || '')
  const [appointmentDate, setAppointmentDate] = useState(
    appointment ? extractKolkataDate(appointment.appointment_date) : ''
  )
  const [appointmentTime, setAppointmentTime] = useState(
    appointment ? extractKolkataTime(appointment.appointment_date) : '10:00'
  )
  const [location, setLocation] = useState(appointment?.location || '')
  const [reason, setReason] = useState(appointment?.reason || '')
  const [notes, setNotes] = useState(appointment?.notes || '')
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status || 'scheduled')

  // Validation & submission state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    // Doctor name required
    if (!doctorName.trim()) {
      errors.doctorName = "Doctor's name is required."
    }

    // Date & Time required
    if (!appointmentDate) {
      errors.appointmentDate = 'Appointment date is required.'
    }

    if (!appointmentTime) {
      errors.appointmentTime = 'Appointment time is required.'
    }

    // In create mode, date & time cannot be in the past
    if (appointmentDate && appointmentTime) {
      const combinedIso = combineDateAndTimeToKolkataIso(appointmentDate, appointmentTime)
      if (mode === 'create' && isAppointmentPast(combinedIso)) {
        errors.appointmentDate =
          'New appointments cannot be scheduled in the past. Please select an upcoming date and time.'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`)
        return
      }

      const combinedIso = combineDateAndTimeToKolkataIso(appointmentDate, appointmentTime)

      const payload = {
        doctor_name: doctorName.trim(),
        hospital_name: hospitalName.trim() || null,
        appointment_date: combinedIso,
        location: location.trim() || null,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
        status: status,
      }

      if (mode === 'create') {
        const { data: newAppt, error } = await supabase
          .from('appointments')
          .insert({
            ...payload,
            elder_profile_id: elderId,
            created_by: user.id, // Set from authenticated identity
          })
          .select()
          .single()

        if (error || !newAppt) {
          setGeneralError(error?.message || 'Failed to create appointment.')
          setIsSubmitting(false)
          return
        }

        setSuccessMessage(`Appointment with ${newAppt.doctor_name} scheduled successfully!`)
      } else {
        // Edit mode
        if (!appointment) {
          setGeneralError('Missing appointment record to update.')
          setIsSubmitting(false)
          return
        }

        const { data: updatedAppt, error } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', appointment.id)
          .eq('elder_profile_id', elderId)
          .select()
          .single()

        if (error || !updatedAppt) {
          setGeneralError(error?.message || 'Failed to update appointment.')
          setIsSubmitting(false)
          return
        }

        setSuccessMessage(`Appointment with ${updatedAppt.doctor_name} updated successfully!`)
      }

      // Smooth redirection to appointments page
      setTimeout(() => {
        router.push(cancelHref)
        router.refresh()
      }, 900)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while saving appointment.'
      setGeneralError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Alert Banners */}
      {generalError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to save appointment</p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{generalError}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/90 p-4 text-sm text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
          <div className="flex-1">
            <p className="font-semibold">{successMessage}</p>
            <p className="text-xs text-teal-700 dark:text-teal-300">Redirecting to appointments list...</p>
          </div>
        </div>
      )}

      {/* Section 1: Doctor & Facility */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Medical Provider & Facility
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Doctor consultation for {elderName}.
              </p>
            </div>
          </div>

          {/* Status selector (in edit mode or creation) */}
          {mode === 'edit' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                disabled={isSubmitting}
                className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Doctor Name */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="doctorName" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Doctor&apos;s Name <span className="text-teal-600">*</span>
              </Label>
              <span className="text-xs text-slate-400">Required</span>
            </div>
            <div className="relative mt-1.5">
              <Input
                id="doctorName"
                name="doctorName"
                type="text"
                placeholder="e.g. Dr. Anita Desai, MD"
                value={doctorName}
                onChange={(e) => {
                  setDoctorName(e.target.value)
                  if (fieldErrors.doctorName) setFieldErrors((prev) => ({ ...prev, doctorName: '' }))
                }}
                disabled={isSubmitting}
                className={fieldErrors.doctorName ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.doctorName && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.doctorName}</p>
            )}
          </div>

          {/* Hospital or Clinic Name */}
          <div>
            <Label htmlFor="hospitalName" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Hospital / Clinic
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="hospitalName"
                name="hospitalName"
                type="text"
                placeholder="e.g. Apollo Hospital, City Health Center"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Medical center or clinic facility name</p>
          </div>
        </div>
      </div>

      {/* Section 2: Date, Time & Location */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Schedule & Location
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Appointment time is scheduled in Asia/Kolkata (+05:30) timezone.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Appointment Date */}
          <div>
            <Label htmlFor="appointmentDate" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Appointment Date <span className="text-teal-600">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="appointmentDate"
                name="appointmentDate"
                type="date"
                min={mode === 'create' ? new Date().toISOString().split('T')[0] : undefined}
                value={appointmentDate}
                onChange={(e) => {
                  setAppointmentDate(e.target.value)
                  if (fieldErrors.appointmentDate) {
                    setFieldErrors((prev) => ({ ...prev, appointmentDate: '' }))
                  }
                }}
                disabled={isSubmitting}
                className={fieldErrors.appointmentDate ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.appointmentDate && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.appointmentDate}</p>
            )}
          </div>

          {/* Appointment Time */}
          <div>
            <Label htmlFor="appointmentTime" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Appointment Time <span className="text-teal-600">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="appointmentTime"
                name="appointmentTime"
                type="time"
                value={appointmentTime}
                onChange={(e) => {
                  setAppointmentTime(e.target.value)
                  if (fieldErrors.appointmentTime) {
                    setFieldErrors((prev) => ({ ...prev, appointmentTime: '' }))
                  }
                }}
                disabled={isSubmitting}
                className={fieldErrors.appointmentTime ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.appointmentTime && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.appointmentTime}</p>
            )}
          </div>

          {/* Location / Address */}
          <div className="sm:col-span-2">
            <Label htmlFor="location" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Physical Location / Address
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="location"
                name="location"
                type="text"
                placeholder="e.g. 154/11 Bannerghatta Road, OPD Block A, Room 204"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Enables family members and drivers to view one-click map directions.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Reason & Instructions */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Consultation Purpose & Preparation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clinical background notes for circle caregivers accompanying {elderName}.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* Reason for visit */}
          <div>
            <Label htmlFor="reason" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Reason for Visit / Chief Complaint
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="reason"
                name="reason"
                type="text"
                placeholder="e.g. 6-month blood pressure review and echocardiogram follow-up"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Special Preparation / Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Preparation Instructions / Doctor Notes
            </Label>
            <div className="relative mt-1.5">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="e.g. Fast 12 hours prior for blood sugar test. Bring current medication strip bottles and previous echo reports."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Helpful reminders for family members escorting the patient.
            </p>
          </div>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
        <Link
          href={cancelHref}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Cancel
        </Link>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>{mode === 'create' ? 'Scheduling Visit...' : 'Saving Changes...'}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{mode === 'create' ? 'Schedule Appointment' : 'Save Changes'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
