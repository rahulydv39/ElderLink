import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  HeartPulse,
  Users,
  Pill,
  Calendar,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Clock,
  PlusCircle,
  UserPlus,
  Heart,
  KeyRound,
  Shield,
  ArrowRight,
  Bell,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { Badge } from '@/components/ui/badge'
import { ElderProfileCard } from '@/components/elder-profile-card'
import {
  formatAppointmentDateTime,
  getRelativeAppointmentDay,
  isAppointmentPast,
} from '@/lib/utils/appointment'
import { formatPhoneDisplay } from '@/lib/utils/phone'
import { isInternalAuthEmail } from '@/lib/utils/auth-identity'

export const instant = false

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/dashboard')
  }

  // Concurrently execute all independent dashboard queries to eliminate waterfall delays
  const [
    { data: profile },
    { data: elderProfiles },
    { data: userMemberships },
    { data: allMemberships },
    { data: allActiveMeds },
    { data: allAppointments },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('elder_profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('care_circle_members').select('*').eq('member_user_id', user.id),
    supabase.from('care_circle_members').select('elder_profile_id'),
    supabase.from('medications').select('id, elder_profile_id').eq('is_active', true),
    supabase
      .from('appointments')
      .select('*')
      .eq('status', 'scheduled')
      .order('appointment_date', { ascending: true }),
  ])

  // Compute aggregation metrics
  const memberCounts: Record<string, number> = {}
  allMemberships?.forEach((m) => {
    memberCounts[m.elder_profile_id] = (memberCounts[m.elder_profile_id] || 0) + 1
  })

  const activeMedsCounts: Record<string, number> = {}
  allActiveMeds?.forEach((m) => {
    activeMedsCounts[m.elder_profile_id] = (activeMedsCounts[m.elder_profile_id] || 0) + 1
  })

  const upcomingApptsCounts: Record<string, number> = {}
  const nextApptSummaryMap: Record<
    string,
    { doctorName: string; formattedDate: string; hospitalName?: string | null }
  > = {}

  allAppointments?.forEach((appt) => {
    if (!isAppointmentPast(appt.appointment_date)) {
      upcomingApptsCounts[appt.elder_profile_id] =
        (upcomingApptsCounts[appt.elder_profile_id] || 0) + 1

      if (!nextApptSummaryMap[appt.elder_profile_id]) {
        const relDay = getRelativeAppointmentDay(appt.appointment_date)
        const dateDisplay = relDay
          ? `${relDay} (${formatAppointmentDateTime(appt.appointment_date)})`
          : formatAppointmentDateTime(appt.appointment_date)

        nextApptSummaryMap[appt.elder_profile_id] = {
          doctorName: appt.doctor_name,
          formattedDate: dateDisplay,
          hospitalName: appt.hospital_name,
        }
      }
    }
  })

  const membershipMap = new Map((userMemberships || []).map((m) => [m.elder_profile_id, m]))

  const displayName = profile?.full_name || user.user_metadata?.full_name || 'Caregiver'
  const userPhone = profile?.phone || user.user_metadata?.phone || user.phone
  const rawEmail =
    profile?.email && profile.email !== ''
      ? profile.email
      : (user.user_metadata?.contact_email || '')
  const userEmail = isInternalAuthEmail(rawEmail) ? '' : rawEmail
  const contactDisplay = userPhone ? formatPhoneDisplay(userPhone) : (userEmail || 'Mobile Account')

  const allElders = elderProfiles || []
  const ownedProfiles = allElders.filter((e) => e.owner_user_id === user.id)
  const sharedProfiles = allElders.filter((e) => e.owner_user_id !== user.id)

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Elder<span className="text-teal-600">Link</span>
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider -mt-1">
                Care Circle Dashboard
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/settings/notifications"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Notification Settings"
            >
              <Bell className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">Notifications</span>
            </Link>

            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                {displayName}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {contactDisplay}
              </span>
            </div>

            <LogoutButton variant="outline" className="border-slate-200 hover:bg-slate-100 dark:border-slate-700" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 via-teal-100/40 to-sky-50 p-6 sm:p-8 dark:border-slate-800 dark:from-slate-900 dark:via-teal-950/20 dark:to-slate-900">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-100/60 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950/80 dark:text-teal-300 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>ElderLink Family Portal</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Welcome back, {displayName}!
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Manage aging family members, care circle teams, and synchronized health regimens
                  from a single unified workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Session Active</span>
                </Badge>
                <Badge className="bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>RLS Protected</span>
                </Badge>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
                  <Heart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">My Profiles</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {ownedProfiles.length} owned
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Shared With Me</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {sharedProfiles.length} active circles
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Account Identity</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">
                    {displayName}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Active</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {user.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                      : 'Just now'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: My Profiles (Owned) */}
          <div className="mt-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    My Elder Profiles
                  </h2>
                  <Badge variant="outline" className="border-teal-200 text-teal-700 bg-teal-50 text-xs">
                    {ownedProfiles.length} Owned
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Profiles where you are the primary administrator and legal caregiver.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/care-circle/join"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  <span>Join with Code</span>
                </Link>

                <Link
                  href="/onboarding/elder-profile"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Add Elder Profile</span>
                </Link>
              </div>
            </div>

            {/* Profile Grid or Empty State */}
            {ownedProfiles.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {ownedProfiles.map((elder) => (
                  <ElderProfileCard
                    key={elder.id}
                    elder={elder}
                    isOwner={true}
                    memberCount={memberCounts[elder.id] || 0}
                    activeMedsCount={activeMedsCounts[elder.id] || 0}
                    upcomingApptsCount={upcomingApptsCounts[elder.id] || 0}
                    nextApptSummary={nextApptSummaryMap[elder.id] || null}
                  />
                ))}
              </div>
            ) : (
              /* Empty State: Guide user to /onboarding/elder-profile */
              <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-8 sm:p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-4">
                  <UserPlus className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  No elder profiles registered yet
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                  ElderLink centers around the health of your elderly family members. Register their
                  profile to unlock medication schedules, care circle collaboration, and health logs.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/onboarding/elder-profile"
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Add Your First Elder Profile</span>
                  </Link>

                  <Link
                    href="/care-circle/join"
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <KeyRound className="h-4 w-4 text-slate-500" />
                    <span>Join Existing Circle</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Shared With Me (Care Circles) */}
          <div className="mt-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Shared With Me
                  </h2>
                  <Badge variant="outline" className="border-sky-200 text-sky-700 bg-sky-50 text-xs">
                    {sharedProfiles.length} Shared Circles
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Elder profiles shared with you as an authorized caretaker or family member.
                </p>
              </div>

              <Link
                href="/care-circle/join"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 transition-colors dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300"
              >
                <KeyRound className="h-3.5 w-3.5 text-sky-600" />
                <span>Redeem Another Invitation</span>
              </Link>
            </div>

            {sharedProfiles.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {sharedProfiles.map((elder) => {
                  const membership = membershipMap.get(elder.id)
                  return (
                    <ElderProfileCard
                      key={elder.id}
                      elder={elder}
                      isOwner={false}
                      sharedRole={membership?.role || 'family'}
                      memberCount={memberCounts[elder.id] || 0}
                      activeMedsCount={activeMedsCounts[elder.id] || 0}
                      upcomingApptsCount={upcomingApptsCounts[elder.id] || 0}
                      nextApptSummary={nextApptSummaryMap[elder.id] || null}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        No shared circles yet
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Have a family member or patient share their 32-character invitation code with you.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/care-circle/join"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <span>Enter Code</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Core Modules Placeholders for Upcoming Steps */}
          <div className="mt-14">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white mb-4">
              ElderLink Healthcare Modules
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Care Circles Active Module */}
              <div className="flex flex-col justify-between rounded-2xl border border-teal-200/80 bg-white p-6 shadow-xs dark:border-teal-900/50 dark:bg-slate-900 ring-1 ring-teal-500/10">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <Badge className="bg-teal-600 text-white text-[10px] font-semibold">
                      Step 5 Active
                    </Badge>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    Family Care Circles
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Connect relatives and professional nurses with role-based access, permission
                    boundaries, and cryptographic invitation codes.
                  </p>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-teal-600 font-medium">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Role-Based RLS Ready</span>
                    </span>
                    <Link
                      href="/care-circle/join"
                      className="font-medium text-teal-600 hover:text-teal-700 hover:underline"
                    >
                      Join Circle &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Medication Management Module */}
              <div className="flex flex-col justify-between rounded-2xl border border-sky-200/80 bg-white p-6 shadow-xs dark:border-sky-900/50 dark:bg-slate-900 ring-1 ring-sky-500/10">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                      <Pill className="h-5 w-5" />
                    </div>
                    <Badge className="bg-sky-600 text-white text-[10px] font-semibold">
                      Step 6 Active
                    </Badge>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    Medication Schedules
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Track daily prescriptions, multiple dosage times, adherence logs, and missed-dose alerts
                    in Asia/Kolkata timezone.
                  </p>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-sky-600 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Adherence Engine Ready</span>
                    </span>
                    <span className="font-medium text-sky-600">
                      {allElders.length > 0 ? (
                        <Link
                          href={`/elder-profiles/${allElders[0].id}/medications`}
                          className="hover:underline"
                        >
                          View Regimens &rarr;
                        </Link>
                      ) : (
                        'Active'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Appointments Module */}
              <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-6 shadow-xs dark:border-emerald-900/50 dark:bg-slate-900 ring-1 ring-emerald-500/10">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                      Step 7 Active
                    </Badge>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    Appointments & Visits
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Coordinate clinical checkups, doctor consultations, clinic directions, and visit notes
                    in Asia/Kolkata timezone with RLS security.
                  </p>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Clinical Visit Tracking</span>
                    </span>
                    <span className="font-medium text-emerald-600">
                      {allElders.length > 0 ? (
                        <Link
                          href={`/elder-profiles/${allElders[0].id}/appointments`}
                          className="hover:underline"
                        >
                          View Visits &rarr;
                        </Link>
                      ) : (
                        'Active'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
