import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HeartPulse, ArrowLeft, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AppointmentManager } from '@/components/appointment-manager'

export const instant = false

interface AppointmentsPageProps {
  params: Promise<{ id: string }>
}

export default async function AppointmentsPage({ params }: AppointmentsPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Verify user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=/elder-profiles/${id}/appointments`)
  }

  // 2. Fetch Elder Profile
  const { data: elder, error: elderError } = await supabase
    .from('elder_profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (elderError || !elder) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
        <header className="border-b border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Back to Dashboard
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Profile Not Found</h1>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              The requested elder profile does not exist or has been removed.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // 3. Authorization check
  const isOwner = elder.owner_user_id === user.id

  const { data: membership } = await supabase
    .from('care_circle_members')
    .select('*')
    .eq('elder_profile_id', id)
    .eq('member_user_id', user.id)
    .maybeSingle()

  const canViewMedicalInfo =
    isOwner ||
    !!membership?.can_view_medical_info ||
    membership?.role === 'family' ||
    membership?.role === 'caretaker'

  const canManageAppointments =
    isOwner ||
    !!membership?.can_manage_appointments ||
    membership?.role === 'caretaker'

  if (!isOwner && !canViewMedicalInfo) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
        <header className="border-b border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Back to Dashboard
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-900/40 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400 mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Access Denied</h1>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              You do not have medical information viewing permissions for {elder.full_name}.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // 4. Fetch all appointments for this elder profile
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('elder_profile_id', id)
    .order('appointment_date', { ascending: true })

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Elder<span className="text-teal-600">Link</span>
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider -mt-1">
                Appointments & Visits
              </span>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <AppointmentManager
            elder={elder}
            appointments={appointments || []}
            isOwner={isOwner}
            canManageAppointments={canManageAppointments}
          />
        </div>
      </main>
    </div>
  )
}
