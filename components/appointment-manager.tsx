'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Edit,
  ExternalLink,
  Loader2,
  Shield,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database, AppointmentStatus } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  formatAppointmentDateTime,
  getRelativeAppointmentDay,
} from '@/lib/utils/appointment'

type ElderProfileRow = Database['public']['Tables']['elder_profiles']['Row']
type AppointmentRow = Database['public']['Tables']['appointments']['Row']

interface AppointmentManagerProps {
  elder: ElderProfileRow
  appointments: AppointmentRow[]
  isOwner: boolean
  canManageAppointments: boolean
}

export function AppointmentManager({
  elder,
  appointments: initialAppointments,
  isOwner,
  canManageAppointments,
}: AppointmentManagerProps) {
  const supabase = createClient()

  // Tab state: 'upcoming' | 'past' | 'all'
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming')

  // Appointments state
  const [appointments, setAppointments] = useState<AppointmentRow[]>(initialAppointments)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Actions & Modal state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [cancellingAppt, setCancellingAppt] = useState<AppointmentRow | null>(null)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Update appointment status ('completed' or 'cancelled')
  const handleUpdateStatus = async (apptId: string, newStatus: AppointmentStatus) => {
    if (!canManageAppointments) {
      showFeedback('error', 'You do not have permission to modify appointment status.')
      return
    }

    setActionLoadingId(apptId)

    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', apptId)
        .eq('elder_profile_id', elder.id)
        .select()
        .single()

      if (error || !data) {
        showFeedback('error', `Failed to update status: ${error?.message || 'Database error'}`)
        return
      }

      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: newStatus } : a))
      )

      const label = newStatus === 'completed' ? 'marked as Completed' : 'cancelled'
      showFeedback('success', `Appointment ${label}.`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating appointment status.'
      showFeedback('error', message)
    } finally {
      setActionLoadingId(null)
      setCancellingAppt(null)
    }
  }

  // Partition appointments
  const [nowMs] = useState(() => Date.now())

  const upcomingList = appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.appointment_date).getTime() >= nowMs - 3600000)
    .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())

  const pastList = appointments
    .filter((a) => a.status === 'completed' || new Date(a.appointment_date).getTime() < nowMs - 3600000)
    .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())

  const allList = appointments
    .filter((a) => {
      const matchesSearch =
        a.doctor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.hospital_name && a.hospital_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.reason && a.reason.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus = statusFilter === 'all' || a.status === statusFilter

      return matchesSearch && matchesStatus
    })
    .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())

  const displayedList =
    activeTab === 'upcoming' ? upcomingList : activeTab === 'past' ? pastList : allList

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

      {/* Header Banner: Elder Name, Appointment Metrics & Schedule Action */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 ring-1 ring-teal-600/10">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {elder.full_name}&apos;s Appointments
                </h1>
                <Badge
                  variant="outline"
                  className="border-teal-200 bg-teal-50 text-teal-700 text-xs dark:border-teal-800 dark:text-teal-300 dark:bg-teal-950"
                >
                  {upcomingList.length} Upcoming {upcomingList.length === 1 ? 'Visit' : 'Visits'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Doctor consultations, clinical follow-ups, and hospital checkups in Asia/Kolkata timezone.
              </p>
            </div>
          </div>

          {/* Action: Schedule Appointment (Authorized only) */}
          {canManageAppointments && (
            <Link
              href={`/elder-profiles/${elder.id}/appointments/new`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Appointment</span>
            </Link>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Next Upcoming Visit</p>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white truncate">
              {upcomingList.length > 0 ? (
                <>
                  {upcomingList[0].doctor_name} &bull; {getRelativeAppointmentDay(upcomingList[0].appointment_date)}
                </>
              ) : (
                'None scheduled'
              )}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Visits on Record</p>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {appointments.length} appointments
            </p>
          </div>

          <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Appointment Permissions</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Shield className="h-3.5 w-3.5 text-teal-600" />
              <span>
                {isOwner ? 'Full Owner Access' : canManageAppointments ? 'Authorized Caretaker' : 'Family View-Only'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'upcoming'
              ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Upcoming</span>
          {upcomingList.length > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.2 text-[11px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              {upcomingList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('past')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'past'
              ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Past Visits</span>
          {pastList.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {pastList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'all'
              ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>All History</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {appointments.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar for "All" tab */}
      {activeTab === 'all' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by doctor, hospital, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      )}

      {/* Appointment Cards List */}
      {displayedList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {activeTab === 'upcoming'
              ? 'No upcoming appointments scheduled'
              : activeTab === 'past'
              ? 'No past appointments recorded'
              : 'No matching appointments found'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {activeTab === 'upcoming'
              ? 'Keep track of upcoming clinic checkups and specialist doctor consultations.'
              : 'Appointments that are completed or whose scheduled date has passed appear here.'}
          </p>
          {canManageAppointments && activeTab === 'upcoming' && (
            <div className="mt-4">
              <Link
                href={`/elder-profiles/${elder.id}/appointments/new`}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Schedule an Appointment</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {displayedList.map((appt) => {
            const isActionLoading = actionLoadingId === appt.id
            const isScheduled = appt.status === 'scheduled'
            const isCompleted = appt.status === 'completed'
            const isCancelled = appt.status === 'cancelled'
            const relativeDay = getRelativeAppointmentDay(appt.appointment_date)

            return (
              <div
                key={appt.id}
                className={`rounded-2xl border p-6 shadow-xs flex flex-col justify-between transition-all ${
                  isCancelled
                    ? 'border-slate-200 bg-slate-50/50 opacity-75 dark:border-slate-800 dark:bg-slate-900/50'
                    : isCompleted
                    ? 'border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                    : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div>
                  {/* Card Header: Doctor Name & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 ring-1 ring-teal-600/10">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                            {appt.doctor_name}
                          </h3>
                        </div>
                        {appt.hospital_name && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            <span>{appt.hospital_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isScheduled && (
                        <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-xs dark:bg-sky-950/60 dark:text-sky-300">
                          {relativeDay ? `${relativeDay}` : 'Scheduled'}
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs flex items-center gap-1 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Completed</span>
                        </Badge>
                      )}
                      {isCancelled && (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-xs flex items-center gap-1 dark:bg-rose-950/60 dark:text-rose-300">
                          <XCircle className="h-3 w-3" />
                          <span>Cancelled</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Date & Time pill */}
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-100 dark:bg-slate-800/60 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Calendar className="h-3.5 w-3.5 text-teal-600" />
                    <span>{formatAppointmentDateTime(appt.appointment_date)}</span>
                  </div>

                  {/* Location with Google Maps link */}
                  {appt.location && (
                    <div className="mt-3 flex items-start justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-start gap-1.5 flex-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{appt.location}</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${appt.location} ${appt.hospital_name || ''}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 hover:text-teal-700 hover:underline shrink-0"
                      >
                        <span>Directions</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {/* Reason for visit */}
                  {appt.reason && (
                    <div className="mt-3 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">Reason: </span>
                      <span>{appt.reason}</span>
                    </div>
                  )}

                  {/* Preparation / Notes */}
                  {appt.notes && (
                    <div className="mt-2.5 rounded-lg bg-amber-50/70 p-2.5 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/40">
                      <span className="font-bold">Instructions: </span>
                      <span>{appt.notes}</span>
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons (for authorized caregivers) */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {canManageAppointments ? (
                    <div className="flex items-center gap-2">
                      {isScheduled && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isActionLoading}
                            onClick={() => handleUpdateStatus(appt.id, 'completed')}
                            className="h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            <span>Mark Completed</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isActionLoading}
                            onClick={() => setCancellingAppt(appt)}
                            className="h-7 rounded-lg border-slate-200 text-red-600 hover:bg-red-50 text-[11px] font-semibold dark:border-slate-700 dark:hover:bg-red-950/40"
                          >
                            <span>Cancel</span>
                          </Button>
                        </>
                      )}

                      {isCancelled && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isActionLoading}
                          onClick={() => handleUpdateStatus(appt.id, 'scheduled')}
                          className="h-7 rounded-lg text-slate-600 text-[11px]"
                        >
                          Reopen Appointment
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Shield className="h-3 w-3 text-teal-600" />
                      <span>Care Circle View</span>
                    </span>
                  )}

                  {canManageAppointments && (
                    <Link
                      href={`/elder-profiles/${elder.id}/appointments/${appt.id}/edit`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit Details</span>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Dialog: Cancel Appointment */}
      {cancellingAppt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-appointment-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && actionLoadingId !== cancellingAppt.id) {
              setCancellingAppt(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && actionLoadingId !== cancellingAppt.id) {
              setCancellingAppt(null)
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 id="cancel-appointment-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Appointment?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {cancellingAppt.doctor_name} &bull; {formatAppointmentDateTime(cancellingAppt.appointment_date)}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Are you sure you want to cancel this appointment for {elder.full_name}? The visit record
              will be preserved as Cancelled in the history log rather than deleted, so other caregivers remain informed.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={actionLoadingId === cancellingAppt.id}
                onClick={() => setCancellingAppt(null)}
                className="rounded-xl text-xs min-h-[38px] px-4"
              >
                Keep Appointment
              </Button>

              <Button
                type="button"
                disabled={actionLoadingId === cancellingAppt.id}
                onClick={() => handleUpdateStatus(cancellingAppt.id, 'cancelled')}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 min-h-[38px] px-4"
              >
                {actionLoadingId === cancellingAppt.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    <span>Confirm Cancellation</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
