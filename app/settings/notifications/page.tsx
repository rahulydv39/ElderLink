import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, HeartPulse, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { NotificationPreferencesForm } from '@/components/notification-preferences-form'
import { isInternalAuthEmail } from '@/lib/utils/auth-identity'

export const instant = false

export default async function NotificationSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/settings/notifications')
  }

  // 1. Fetch user profile for contact email
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 2. Fetch existing notification preferences
  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const rawEmail =
    profile?.email && profile.email !== ''
      ? profile.email
      : (user.user_metadata?.contact_email || '')
  const contactEmail = isInternalAuthEmail(rawEmail) ? '' : rawEmail

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Return to Dashboard"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>

            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
                <HeartPulse className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Elder<span className="text-teal-600">Link</span>
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider -mt-1">
                  Settings
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <LogoutButton variant="outline" className="border-slate-200 hover:bg-slate-100 dark:border-slate-700" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Breadcrumb & Title */}
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              <Link href="/dashboard" className="hover:underline">Dashboard</Link>
              <span>/</span>
              <span>Settings</span>
              <span>/</span>
              <span className="text-teal-600 dark:text-teal-400 font-semibold">Notifications</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Notification Preferences
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Manage automated email delivery for medications, adherence alerts, and upcoming doctor visits.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <NotificationPreferencesForm
            userId={user.id}
            initialPreferences={preferences}
            contactEmail={contactEmail}
          />
        </div>
      </main>
    </div>
  )
}
