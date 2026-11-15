import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HeartPulse, ArrowLeft, ShieldCheck, Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ElderProfileForm } from '@/components/elder-profile-form'

export const instant = false

export default async function OnboardingElderProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/onboarding/elder-profile')
  }

  // Check if this is the first elder profile or an additional one
  const { count } = await supabase
    .from('elder_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)

  const isFirstProfile = (count ?? 0) === 0

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Elder<span className="text-teal-600">Link</span>
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider -mt-1">
                Care Circle Network
              </span>
            </div>
          </Link>

          {!isFirstProfile && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {/* Header Banner */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 mb-3">
              <Heart className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 fill-teal-600/20" />
              <span>{isFirstProfile ? 'Step 1 of Setup' : 'Add New Profile'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isFirstProfile ? 'Create Your First Elder Profile' : 'Add an Elder Profile'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {isFirstProfile
                ? 'Welcome to ElderLink! Set up the health profile for the aging family member or patient under your care. This will serve as the center for medication reminders and shared circle management.'
                : 'Register another elderly family member or resident to manage their medications and care team alongside your existing profiles.'}
            </p>
          </div>

          {/* Profile Form */}
          <ElderProfileForm mode="create" cancelHref="/dashboard" />

          {/* Privacy Note */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>
              All medical information is encrypted and protected by Supabase Row-Level Security.
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
