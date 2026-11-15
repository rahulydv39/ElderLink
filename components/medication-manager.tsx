'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Pill,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Plus,
  Edit,
  History,
  Shield,
  Loader2,
  Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database, MedicationLogStatus } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  formatTime12Hour,
  calculateAdherenceRate,
  DoseAdherenceStatus,
} from '@/lib/utils/medication'

type ElderProfileRow = Database['public']['Tables']['elder_profiles']['Row']
type MedicationRow = Database['public']['Tables']['medications']['Row']
type ScheduleRow = Database['public']['Tables']['medication_schedules']['Row']
type MedicationLogRow = Database['public']['Tables']['medication_logs']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

export interface MedicationWithSchedules extends MedicationRow {
  schedules: ScheduleRow[]
}

export interface TodayDoseItem {
  id: string // composite key
  medicationId: string
  scheduleId: string
  medicationName: string
  dosage: string
  unit: string
  instructions: string | null
  prescribedBy: string | null
  scheduledTime: string // "08:00:00"
  scheduledFor: string // ISO TIMESTAMPTZ
  category: 'Morning' | 'Afternoon' | 'Evening' | 'Night'
  status: DoseAdherenceStatus
  existingLog?: MedicationLogRow | null
}

export interface LogWithDetails extends MedicationLogRow {
  medicationName?: string
  dosage?: string
  unit?: string
  recorderProfile?: ProfileRow | null
}

interface MedicationManagerProps {
  elder: ElderProfileRow
  medications: MedicationWithSchedules[]
  initialTodayDoses: TodayDoseItem[]
  initialLogs: LogWithDetails[]
  isOwner: boolean
  canManageMedications: boolean
  todayDateStr: string
}

export function MedicationManager({
  elder,
  medications,
  initialTodayDoses,
  initialLogs,
  isOwner,
  canManageMedications,
  todayDateStr,
}: MedicationManagerProps) {
  const supabase = createClient()

  // Tab state: 'today' | 'prescriptions' | 'history'
  const [activeTab, setActiveTab] = useState<'today' | 'prescriptions' | 'history'>('today')

  // Real-time local state for today's doses and logs
  const [todayDoses, setTodayDoses] = useState<TodayDoseItem[]>(initialTodayDoses)
  const [logs, setLogs] = useState<LogWithDetails[]>(initialLogs)

  // Loading & Logging states
  const [actionLoadingDoseId, setActionLoadingDoseId] = useState<string | null>(null)
  const [skipModalDose, setSkipModalDose] = useState<TodayDoseItem | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Calculate adherence metrics for today
  const takenDosesToday = todayDoses.filter((d) => d.status === 'taken').length
  const totalDosesToday = todayDoses.length
  const adherenceTodayPct = totalDosesToday > 0 ? Math.round((takenDosesToday / totalDosesToday) * 100) : null

  // Calculate overall historical adherence rate
  // Eligible = total doses in history that are 'taken', 'skipped', or 'missed' (excluding unconfirmed)
  const eligibleLogs = logs.filter((l) => l.status === 'taken' || l.status === 'skipped' || l.status === 'missed')
  const takenHistorical = logs.filter((l) => l.status === 'taken').length
  const overallAdherencePct = calculateAdherenceRate(takenHistorical, eligibleLogs.length)

  // Record a dose adherence action ('taken' or 'skipped')
  const handleRecordAdherence = async (
    dose: TodayDoseItem,
    status: 'taken' | 'skipped',
    notes?: string
  ) => {
    if (!canManageMedications) {
      showFeedback('error', 'You do not have permission to log medication adherence.')
      return
    }

    setActionLoadingDoseId(dose.id)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        showFeedback('error', 'Session expired. Please sign in again.')
        return
      }

      const payload = {
        medication_id: dose.medicationId,
        schedule_id: dose.scheduleId,
        elder_profile_id: elder.id,
        scheduled_for: dose.scheduledFor,
        status: status as MedicationLogStatus,
        recorded_by: user.id, // Strictly derived from auth.uid()
        recorded_at: new Date().toISOString(),
        notes: notes?.trim() || null,
      }

      // Upsert using the unique constraint (schedule_id, scheduled_for)
      const { data: savedLog, error: logError } = await supabase
        .from('medication_logs')
        .upsert(payload, { onConflict: 'schedule_id,scheduled_for' })
        .select()
        .single()

      if (logError || !savedLog) {
        showFeedback('error', `Failed to record adherence: ${logError?.message || 'Database error'}`)
        return
      }

      // Optimistic UI updates
      setTodayDoses((prev) =>
        prev.map((d) =>
          d.id === dose.id
            ? {
                ...d,
                status: status,
                existingLog: savedLog,
              }
            : d
        )
      )

      // Add to logs history
      const newLogWithDetails: LogWithDetails = {
        ...savedLog,
        medicationName: dose.medicationName,
        dosage: dose.dosage,
        unit: dose.unit,
      }

      setLogs((prev) => [
        newLogWithDetails,
        ...prev.filter((l) => l.id !== savedLog.id),
      ])

      const actionLabel = status === 'taken' ? 'marked as Taken' : 'marked as Skipped'
      showFeedback('success', `${dose.medicationName} (${dose.dosage} ${dose.unit}) ${actionLabel}.`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error recording adherence.'
      showFeedback('error', message)
    } finally {
      setActionLoadingDoseId(null)
      setSkipModalDose(null)
      setSkipReason('')
    }
  }

  return (
    <div className="space-y-8">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm shadow-xs border ${
            feedback.type === 'success'
              ? 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200'
              : 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Header Banner: Elder Name, Adherence Summary & Add Button */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 ring-1 ring-teal-600/10">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {elder.full_name}&apos;s Medications
                </h1>
                <Badge
                  variant="outline"
                  className="border-teal-200 bg-teal-50 text-teal-700 text-xs dark:border-teal-800 dark:text-teal-300 dark:bg-teal-950"
                >
                  {medications.filter((m) => m.is_active).length} Active Regimens
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Prescription schedules, adherence logging, and intake logs in Asia/Kolkata (+05:30) timezone.
              </p>
            </div>
          </div>

          {/* Action: Add Medication (Authorized only) */}
          {canManageMedications && (
            <Link
              href={`/elder-profiles/${elder.id}/medications/new`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Medication</span>
            </Link>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Today&apos;s Adherence</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {takenDosesToday} / {totalDosesToday}
              </span>
              <span className="text-xs text-slate-500">doses taken</span>
              {adherenceTodayPct !== null && (
                <span className="ml-auto text-xs font-bold text-teal-600 dark:text-teal-400">
                  {adherenceTodayPct}%
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Overall Adherence Rate</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {overallAdherencePct !== null ? `${overallAdherencePct}%` : 'No data'}
              </span>
              <span className="text-xs text-slate-500">
                {overallAdherencePct !== null ? 'historical score' : 'awaiting logs'}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Care Circle Authority</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Shield className="h-3.5 w-3.5 text-teal-600" />
              <span>
                {isOwner ? 'Full Owner Access' : canManageMedications ? 'Authorized Caretaker' : 'Family View-Only'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('today')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'today'
              ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Today&apos;s Schedule</span>
          {todayDoses.length > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.2 text-[11px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              {todayDoses.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'prescriptions'
              ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Pill className="h-4 w-4" />
          <span>All Prescriptions</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {medications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'history'
              ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Adherence Logs & History</span>
        </button>
      </div>

      {/* TAB 1: TODAY'S SCHEDULE & ADHERENCE ACTIONS */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Scheduled Doses for Today
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Date: {todayDateStr} &bull; Timezone: Asia/Kolkata
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              <span>Real-time Adherence Tracking</span>
            </div>
          </div>

          {todayDoses.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                No doses scheduled for today
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                All daily regimens are either complete or not configured for this calendar day.
              </p>
              {canManageMedications && (
                <div className="mt-4">
                  <Link
                    href={`/elder-profiles/${elder.id}/medications/new`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add a Prescription</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {todayDoses.map((dose) => {
                const isActionLoading = actionLoadingDoseId === dose.id
                const isTaken = dose.status === 'taken'
                const isSkipped = dose.status === 'skipped'
                const isDue = dose.status === 'due'
                const isUpcoming = dose.status === 'upcoming'
                const isMissed = dose.status === 'missed'

                return (
                  <div
                    key={dose.id}
                    className={`rounded-2xl border p-5 transition-all shadow-xs ${
                      isTaken
                        ? 'border-teal-200/80 bg-teal-50/30 dark:border-teal-900/40 dark:bg-teal-950/20'
                        : isSkipped
                        ? 'border-amber-200/80 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20'
                        : isMissed
                        ? 'border-rose-200/80 bg-rose-50/20 dark:border-rose-900/40 dark:bg-rose-950/20'
                        : isDue
                        ? 'border-sky-300 bg-sky-50/40 ring-2 ring-sky-500/10 dark:border-sky-800 dark:bg-sky-950/30'
                        : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    {/* Dose Header: Time, Category, Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs border border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono text-xs font-bold">
                          {formatTime12Hour(dose.scheduledTime)}
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {dose.category} Dose
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                            {dose.medicationName}
                          </h3>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div>
                        {isTaken && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs flex items-center gap-1 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Check className="h-3 w-3" />
                            <span>Taken</span>
                          </Badge>
                        )}
                        {isSkipped && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs flex items-center gap-1 dark:bg-amber-950/60 dark:text-amber-300">
                            <XCircle className="h-3 w-3" />
                            <span>Skipped</span>
                          </Badge>
                        )}
                        {isDue && (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-xs flex items-center gap-1 animate-pulse dark:bg-sky-950/60 dark:text-sky-300">
                            <Clock className="h-3 w-3 text-sky-600" />
                            <span>Due Now</span>
                          </Badge>
                        )}
                        {isUpcoming && (
                          <Badge variant="outline" className="text-xs text-slate-500 border-slate-200">
                            Upcoming
                          </Badge>
                        )}
                        {isMissed && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-xs flex items-center gap-1 dark:bg-rose-950/60 dark:text-rose-300">
                            <AlertCircle className="h-3 w-3" />
                            <span>Overdue</span>
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Dosage and Clinical instructions */}
                    <div className="mt-3 text-xs space-y-1 text-slate-600 dark:text-slate-300">
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Prescribed Dose:</span>{' '}
                        {dose.dosage} {dose.unit}
                      </p>
                      {dose.instructions && (
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          &ldquo;{dose.instructions}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Existing Log Details (if logged) */}
                    {dose.existingLog && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Logged at {new Date(dose.existingLog.recorded_at || '').toLocaleTimeString()}
                        </span>
                        {dose.existingLog.notes && (
                          <span className="italic text-slate-400 truncate max-w-[200px]">
                            Note: {dose.existingLog.notes}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Adherence Action Buttons (for authorized caregivers) */}
                    {canManageMedications && (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isActionLoading || isTaken}
                          onClick={() => handleRecordAdherence(dose, 'taken')}
                          className={`flex-1 rounded-xl text-xs font-semibold h-8 inline-flex items-center justify-center gap-1.5 transition-colors ${
                            isTaken
                              ? 'bg-emerald-600/90 text-white cursor-default'
                              : 'bg-teal-600 hover:bg-teal-700 text-white'
                          }`}
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>{isTaken ? 'Recorded Taken' : 'Mark as Taken'}</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isActionLoading || isSkipped}
                          onClick={() => setSkipModalDose(dose)}
                          className={`rounded-xl text-xs font-semibold h-8 inline-flex items-center justify-center gap-1 border-slate-200 ${
                            isSkipped
                              ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/40'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
                          }`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>{isSkipped ? 'Skipped' : 'Skip'}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL PRESCRIPTIONS LIST */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                All Prescriptions & Active Regimens
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete medication list recorded for {elder.full_name}.
              </p>
            </div>

            {canManageMedications && (
              <Link
                href={`/elder-profiles/${elder.id}/medications/new`}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Medication</span>
              </Link>
            )}
          </div>

          {medications.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <Pill className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No medications on file</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Register prescriptions to track daily intake and missed doses automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {medications.map((med) => (
                <div
                  key={med.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {med.medication_name}
                          </h3>
                          <Badge
                            variant={med.is_active ? 'default' : 'outline'}
                            className={`text-[10px] ${
                              med.is_active
                                ? 'bg-teal-600 text-white'
                                : 'text-slate-400 border-slate-300'
                            }`}
                          >
                            {med.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-xs text-teal-700 dark:text-teal-400 font-semibold mt-0.5">
                          {med.dosage} {med.unit}
                        </p>
                      </div>

                      {canManageMedications && (
                        <Link
                          href={`/elder-profiles/${elder.id}/medications/${med.id}/edit`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </Link>
                      )}
                    </div>

                    {med.description && (
                      <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {med.description}
                      </p>
                    )}

                    {med.instructions && (
                      <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 italic">
                        &ldquo;{med.instructions}&rdquo;
                      </div>
                    )}

                    {/* Schedule times pills */}
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Scheduled Dose Times ({med.schedules.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {med.schedules.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200/50"
                          >
                            <Clock className="h-3 w-3 text-teal-500" />
                            <span>{formatTime12Hour(s.scheduled_time)}</span>
                            <span className="text-[10px] text-teal-500 capitalize">
                              ({s.frequency})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Dates & Prescriber Footer */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>Started: {med.start_date}</span>
                    {med.prescribed_by && <span>Prescribed: {med.prescribed_by}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADHERENCE HISTORY & AUDIT LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Medication Adherence History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete verifiable log of every recorded dosage event, timestamp, and notes.
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No adherence records logged yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Adherence records appear here as caregivers record daily doses.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="px-5 py-3.5">Scheduled Dose</th>
                      <th className="px-5 py-3.5">Medication</th>
                      <th className="px-5 py-3.5">Adherence Status</th>
                      <th className="px-5 py-3.5">Recorded At</th>
                      <th className="px-5 py-3.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.map((log) => {
                      const isTaken = log.status === 'taken'
                      const isSkipped = log.status === 'skipped'
                      const isMissed = log.status === 'missed'

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-5 py-3.5 font-mono text-slate-900 dark:text-white">
                            {new Date(log.scheduled_for).toLocaleDateString()} &bull;{' '}
                            {new Date(log.scheduled_for).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {log.medicationName || 'Prescription'}
                            </span>
                            {log.dosage && (
                              <span className="text-slate-400 ml-1.5">
                                ({log.dosage} {log.unit})
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            {isTaken && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                Taken
                              </Badge>
                            )}
                            {isSkipped && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                Skipped
                              </Badge>
                            )}
                            {isMissed && (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px]">
                                Missed
                              </Badge>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                            {log.recorded_at
                              ? new Date(log.recorded_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'System logged'}
                          </td>

                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 italic">
                            {log.notes || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skip Dose Modal (Optional Reason Dialog) */}
      {skipModalDose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Mark Dose as Skipped
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {skipModalDose.medicationName} ({formatTime12Hour(skipModalDose.scheduledTime)})
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="skipReason" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason for Skipping (Optional)
              </Label>
              <Input
                id="skipReason"
                type="text"
                placeholder="e.g. Patient nauseous, Doctor advised pause, Out of stock"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-400">
                Recording a reason helps other caregivers and doctors understand why the dose was skipped.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSkipModalDose(null)
                  setSkipReason('')
                }}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleRecordAdherence(skipModalDose, 'skipped', skipReason)}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white"
              >
                Confirm Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
