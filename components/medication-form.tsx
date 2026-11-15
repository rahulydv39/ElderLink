'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Pill,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database, ScheduleFrequency } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatTime12Hour, getTimeOfDayCategory } from '@/lib/utils/medication'

type MedicationRow = Database['public']['Tables']['medications']['Row']
type ScheduleRow = Database['public']['Tables']['medication_schedules']['Row']

export interface ScheduleItemState {
  id?: string // set if existing schedule
  time: string // HH:MM (e.g. "08:00")
  frequency: ScheduleFrequency
  daysOfWeek: number[]
  isActive: boolean
}

interface MedicationFormProps {
  mode: 'create' | 'edit'
  elderId: string
  elderName: string
  medication?: MedicationRow
  existingSchedules?: ScheduleRow[]
  cancelHref?: string
}

const COMMON_UNITS = ['mg', 'ml', 'tablet', 'capsule', 'drops', 'puff', 'patch', 'g']
const DAYS_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MedicationForm({
  mode,
  elderId,
  elderName,
  medication,
  existingSchedules = [],
  cancelHref = `/elder-profiles/${elderId}/medications`,
}: MedicationFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Medication fields state
  const [medicationName, setMedicationName] = useState(medication?.medication_name || '')
  const [dosage, setDosage] = useState(medication?.dosage || '')
  const [unit, setUnit] = useState(medication?.unit || 'mg')
  const [description, setDescription] = useState(medication?.description || '')
  const [instructions, setInstructions] = useState(medication?.instructions || '')
  const [startDate, setStartDate] = useState(
    medication?.start_date || new Date().toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(medication?.end_date || '')
  const [prescribedBy, setPrescribedBy] = useState(medication?.prescribed_by || '')
  const [isActive, setIsActive] = useState(medication?.is_active ?? true)

  // Schedules state (supports multiple dose times per day)
  const initialSchedules: ScheduleItemState[] =
    existingSchedules.length > 0
      ? existingSchedules.map((s) => ({
          id: s.id,
          time: s.scheduled_time.slice(0, 5), // "HH:MM"
          frequency: s.frequency,
          daysOfWeek: s.days_of_week || [],
          isActive: s.is_active,
        }))
      : [
          {
            time: '08:00',
            frequency: 'daily',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            isActive: true,
          },
        ]

  const [schedules, setSchedules] = useState<ScheduleItemState[]>(initialSchedules)
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<string[]>([])

  // Submission & Validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Add a new schedule dose time
  const handleAddSchedule = (presetTime = '20:00') => {
    setSchedules((prev) => [
      ...prev,
      {
        time: presetTime,
        frequency: 'daily',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        isActive: true,
      },
    ])
  }

  // Remove a schedule dose time
  const handleRemoveSchedule = (index: number) => {
    if (schedules.length <= 1) {
      setGeneralError('A medication must have at least one scheduled dosage time.')
      return
    }

    const scheduleToRemove = schedules[index]
    if (scheduleToRemove.id) {
      setDeletedScheduleIds((prev) => [...prev, scheduleToRemove.id!])
    }

    setSchedules((prev) => prev.filter((_, i) => i !== index))
  }

  // Update a schedule property
  const handleUpdateSchedule = (
    index: number,
    field: keyof ScheduleItemState,
    value: unknown
  ) => {
    setSchedules((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  // Toggle day of week for a schedule
  const handleToggleDayOfWeek = (scheduleIndex: number, dayIndex: number) => {
    setSchedules((prev) =>
      prev.map((item, i) => {
        if (i !== scheduleIndex) return item
        const exists = item.daysOfWeek.includes(dayIndex)
        const updatedDays = exists
          ? item.daysOfWeek.filter((d) => d !== dayIndex)
          : [...item.daysOfWeek, dayIndex].sort((a, b) => a - b)
        return { ...item, daysOfWeek: updatedDays }
      })
    )
  }

  // Validate form before submission
  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!medicationName.trim()) {
      errors.medicationName = 'Medication name is required.'
    }

    if (!dosage.trim()) {
      errors.dosage = 'Dosage amount is required (e.g. 5, 500, 1).'
    }

    if (!unit.trim()) {
      errors.unit = 'Unit is required (e.g. mg, tablet).'
    }

    if (!startDate) {
      errors.startDate = 'Start date is required.'
    }

    if (endDate && startDate && endDate < startDate) {
      errors.endDate = 'End date cannot be earlier than start date.'
    }

    if (schedules.length === 0) {
      errors.schedules = 'At least one scheduled dose time is required.'
    } else {
      for (let i = 0; i < schedules.length; i++) {
        if (!schedules[i].time) {
          errors.schedules = `Schedule #${i + 1} is missing a time.`
          break
        }
        if (schedules[i].frequency !== 'daily' && schedules[i].daysOfWeek.length === 0) {
          errors.schedules = `Schedule #${i + 1} must select at least one day of the week.`
          break
        }
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

      if (mode === 'create') {
        // 1. Insert medication
        const { data: newMed, error: medError } = await supabase
          .from('medications')
          .insert({
            elder_profile_id: elderId,
            medication_name: medicationName.trim(),
            dosage: dosage.trim(),
            unit: unit.trim(),
            description: description.trim() || null,
            instructions: instructions.trim() || null,
            start_date: startDate,
            end_date: endDate || null,
            prescribed_by: prescribedBy.trim() || null,
            created_by: user.id,
            is_active: isActive,
          })
          .select()
          .single()

        if (medError || !newMed) {
          setGeneralError(medError?.message || 'Failed to create medication.')
          setIsSubmitting(false)
          return
        }

        // 2. Insert schedules
        const scheduleInserts = schedules.map((s) => ({
          medication_id: newMed.id,
          elder_profile_id: elderId,
          scheduled_time: s.time.length === 5 ? `${s.time}:00` : s.time,
          frequency: s.frequency,
          days_of_week: s.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : s.daysOfWeek,
          timezone: 'Asia/Kolkata',
          is_active: s.isActive,
        }))

        const { error: schedError } = await supabase
          .from('medication_schedules')
          .insert(scheduleInserts)

        if (schedError) {
          setGeneralError(`Medication saved, but failed to create schedules: ${schedError.message}`)
          setIsSubmitting(false)
          return
        }

        setSuccessMessage(`Medication ${newMed.medication_name} registered successfully!`)
      } else {
        // Edit mode
        if (!medication) {
          setGeneralError('Missing medication record to update.')
          setIsSubmitting(false)
          return
        }

        // 1. Update medication details
        const { error: updateError } = await supabase
          .from('medications')
          .update({
            medication_name: medicationName.trim(),
            dosage: dosage.trim(),
            unit: unit.trim(),
            description: description.trim() || null,
            instructions: instructions.trim() || null,
            start_date: startDate,
            end_date: endDate || null,
            prescribed_by: prescribedBy.trim() || null,
            is_active: isActive,
          })
          .eq('id', medication.id)
          .eq('elder_profile_id', elderId)

        if (updateError) {
          setGeneralError(updateError.message)
          setIsSubmitting(false)
          return
        }

        // 2. Safely synchronize schedules
        // Update existing schedules
        for (const s of schedules) {
          const formattedTime = s.time.length === 5 ? `${s.time}:00` : s.time
          if (s.id) {
            await supabase
              .from('medication_schedules')
              .update({
                scheduled_time: formattedTime,
                frequency: s.frequency,
                days_of_week: s.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : s.daysOfWeek,
                is_active: s.isActive,
              })
              .eq('id', s.id)
              .eq('elder_profile_id', elderId)
          } else {
            // New schedule added in edit mode
            await supabase.from('medication_schedules').insert({
              medication_id: medication.id,
              elder_profile_id: elderId,
              scheduled_time: formattedTime,
              frequency: s.frequency,
              days_of_week: s.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : s.daysOfWeek,
              timezone: 'Asia/Kolkata',
              is_active: s.isActive,
            })
          }
        }

        // Remove deleted schedules
        if (deletedScheduleIds.length > 0) {
          await supabase
            .from('medication_schedules')
            .delete()
            .in('id', deletedScheduleIds)
            .eq('elder_profile_id', elderId)
        }

        setSuccessMessage(`Medication ${medicationName} updated successfully!`)
      }

      // Smooth redirection back to medication list
      setTimeout(() => {
        router.push(cancelHref)
        router.refresh()
      }, 900)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while saving medication.'
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
            <p className="font-semibold">Unable to save medication</p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{generalError}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/90 p-4 text-sm text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
          <div className="flex-1">
            <p className="font-semibold">{successMessage}</p>
            <p className="text-xs text-teal-700 dark:text-teal-300">Redirecting to medication schedule...</p>
          </div>
        </div>
      )}

      {/* Section 1: Prescription & Identification */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
              <Pill className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Prescription Details
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prescription for {elderName}. Enter the exact regimen prescribed by the physician.
              </p>
            </div>
          </div>

          {/* Active / Inactive Status Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Active Regimen
            </span>
          </label>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Medication Name */}
          <div className="sm:col-span-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="medicationName" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Medication Name <span className="text-teal-600">*</span>
              </Label>
              <span className="text-xs text-slate-400">Required</span>
            </div>
            <div className="relative mt-1.5">
              <Input
                id="medicationName"
                name="medicationName"
                type="text"
                placeholder="e.g. Amlodipine Besylate, Metformin, Atorvastatin"
                value={medicationName}
                onChange={(e) => {
                  setMedicationName(e.target.value)
                  if (fieldErrors.medicationName) {
                    setFieldErrors((prev) => ({ ...prev, medicationName: '' }))
                  }
                }}
                disabled={isSubmitting}
                className={fieldErrors.medicationName ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.medicationName && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.medicationName}</p>
            )}
          </div>

          {/* Dosage Amount */}
          <div>
            <Label htmlFor="dosage" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Dose Amount <span className="text-teal-600">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="dosage"
                name="dosage"
                type="text"
                placeholder="e.g. 5, 500, 1"
                value={dosage}
                onChange={(e) => {
                  setDosage(e.target.value)
                  if (fieldErrors.dosage) setFieldErrors((prev) => ({ ...prev, dosage: '' }))
                }}
                disabled={isSubmitting}
                className={fieldErrors.dosage ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.dosage && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.dosage}</p>
            )}
          </div>

          {/* Unit */}
          <div>
            <Label htmlFor="unit" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Unit / Form <span className="text-teal-600">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="unit"
                name="unit"
                type="text"
                list="common-units"
                placeholder="e.g. mg, tablet, ml"
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value)
                  if (fieldErrors.unit) setFieldErrors((prev) => ({ ...prev, unit: '' }))
                }}
                disabled={isSubmitting}
                className={fieldErrors.unit ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
              <datalist id="common-units">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            {fieldErrors.unit && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.unit}</p>
            )}
          </div>

          {/* Prescribed By */}
          <div>
            <Label htmlFor="prescribedBy" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Prescribed By
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="prescribedBy"
                name="prescribedBy"
                type="text"
                placeholder="e.g. Dr. Anita Desai"
                value={prescribedBy}
                onChange={(e) => setPrescribedBy(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Doctor or clinic name</p>
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="startDate" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Start Date <span className="text-teal-600">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (fieldErrors.startDate) setFieldErrors((prev) => ({ ...prev, startDate: '' }))
                }}
                disabled={isSubmitting}
                className={fieldErrors.startDate ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.startDate && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.startDate}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <Label htmlFor="endDate" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              End Date (Optional)
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="endDate"
                name="endDate"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (fieldErrors.endDate) setFieldErrors((prev) => ({ ...prev, endDate: '' }))
                }}
                disabled={isSubmitting}
                className={fieldErrors.endDate ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.endDate ? (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.endDate}</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">Leave blank for ongoing medications</p>
            )}
          </div>

          {/* Purpose / Description */}
          <div className="sm:col-span-3">
            <Label htmlFor="description" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Medical Purpose / Indication
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="description"
                name="description"
                type="text"
                placeholder="e.g. Essential hypertension and cardiovascular risk reduction"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Helps family members understand why this medicine is taken.
            </p>
          </div>

          {/* Clinical Instructions */}
          <div className="sm:col-span-3">
            <Label htmlFor="instructions" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Special Intake Instructions
            </Label>
            <div className="relative mt-1.5">
              <Textarea
                id="instructions"
                name="instructions"
                rows={2}
                placeholder="e.g. Take immediately after breakfast with a full glass of water. Do not crush."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Daily Dose Schedules */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Daily Dosage Times & Schedule
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure when doses are scheduled throughout the day in Asia/Kolkata timezone.
              </p>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Quick Add:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddSchedule('08:00')}
              className="h-7 text-[11px] rounded-lg"
            >
              + Morning (8 AM)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddSchedule('13:00')}
              className="h-7 text-[11px] rounded-lg"
            >
              + Noon (1 PM)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddSchedule('20:00')}
              className="h-7 text-[11px] rounded-lg"
            >
              + Night (8 PM)
            </Button>
          </div>
        </div>

        {fieldErrors.schedules && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{fieldErrors.schedules}</span>
          </div>
        )}

        {/* Schedule Items List */}
        <div className="mt-6 space-y-4">
          {schedules.map((schedule, idx) => {
            const timeCategory = getTimeOfDayCategory(schedule.time)

            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Dose index & Time input */}
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100/70 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      #{idx + 1}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={schedule.time}
                          onChange={(e) => handleUpdateSchedule(idx, 'time', e.target.value)}
                          disabled={isSubmitting}
                          className="h-9 w-32 font-mono text-sm bg-white dark:bg-slate-900"
                        />
                        <Badge
                          variant="outline"
                          className="text-xs font-medium border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700"
                        >
                          {formatTime12Hour(schedule.time)} ({timeCategory})
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Frequency Selector */}
                  <div className="flex items-center gap-2">
                    <select
                      value={schedule.frequency}
                      onChange={(e) =>
                        handleUpdateSchedule(idx, 'frequency', e.target.value as ScheduleFrequency)
                      }
                      disabled={isSubmitting}
                      className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                    >
                      <option value="daily">Every Day (Daily)</option>
                      <option value="weekly">Selected Days (Weekly)</option>
                      <option value="custom">Custom Days</option>
                    </select>

                    {schedules.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSchedule(idx)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Days of week selector if weekly or custom */}
                {schedule.frequency !== 'daily' && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500 mr-1">Active on:</span>
                    {DAYS_OF_WEEK_LABELS.map((dayLabel, dayIndex) => {
                      const isSelected = schedule.daysOfWeek.includes(dayIndex)
                      return (
                        <button
                          key={dayLabel}
                          type="button"
                          onClick={() => handleToggleDayOfWeek(idx, dayIndex)}
                          className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'bg-teal-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {dayLabel}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddSchedule('12:00')}
            className="rounded-xl text-xs inline-flex items-center gap-1.5 border-dashed"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Another Dose Time</span>
          </Button>
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
              <span>{mode === 'create' ? 'Saving Prescription...' : 'Updating Changes...'}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{mode === 'create' ? 'Save Medication & Schedule' : 'Update Medication'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
