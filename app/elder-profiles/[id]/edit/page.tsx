import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HeartPulse, ArrowLeft, ShieldAlert, Edit, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ElderProfileForm } from '@/components/elder-profile-form'

export const instant = false

interface EditElderProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function EditElderProfilePage({ params }: EditElderProfilePageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=/elder-profiles/${id}/edit`)
  }

  // Fetch elder profile
  const { data: profile, error } = await supabase
    .from('elder_profiles')
    .select('*')
    .eq('id', id)
    .single()

  // Profile not found
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
        <header className="border-b border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
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
              The requested elder profile does not exist or may have been removed.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center rounded-xl bg-teal-600 px-5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Verify ownership
  if (profile.owner_user_id !== user.id) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col">
        <header className="border-b border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
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
              You do not have ownership permissions to modify this elder profile. Only the primary profile owner can make adjustments.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

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
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {/* Header Banner */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 mb-3">
              <Edit className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span>Editing Elder Profile</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Edit {profile.full_name}&apos;s Profile
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Update medical conditions, emergency contact information, or address. Changes are
              immediately synchronized across the care circle.
            </p>
          </div>

          {/* Profile Form in Edit Mode */}
          <ElderProfileForm mode="edit" initialData={profile} cancelHref="/dashboard" />

          {/* Security Note */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>
              Profile ownership is strictly protected. Ownership IDs cannot be reassigned.
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
