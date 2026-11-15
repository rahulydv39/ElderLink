import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HeartPulse, ArrowLeft, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CareCircleManager, MemberWithProfile, PendingInvitationItem } from '@/components/care-circle-manager'

export const instant = false

interface CareCirclePageProps {
  params: Promise<{ id: string }>
}

export default async function CareCirclePage({ params }: CareCirclePageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Verify Authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=/elder-profiles/${id}/care-circle`)
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
              The requested elder profile does not exist or may have been deleted.
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

  // 3. Authorization check
  const isOwner = elder.owner_user_id === user.id

  // Check if current user is an existing member
  const { data: callerMembership } = await supabase
    .from('care_circle_members')
    .select('*')
    .eq('elder_profile_id', id)
    .eq('member_user_id', user.id)
    .maybeSingle()

  const isMember = !!callerMembership
  const canManageMembers = isOwner || !!callerMembership?.can_manage_members

  if (!isOwner && !isMember) {
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
              You are not a member of {elder.full_name}&apos;s care circle. Only authorized caregivers and family members can view circle members.
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

  // 4. Concurrently fetch Owner Profile, Care Circle Members, and Pending Invitations
  const [
    { data: ownerProfile },
    { data: rawMembers },
    invitationsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', elder.owner_user_id)
      .maybeSingle(),
    supabase
      .from('care_circle_members')
      .select('*')
      .eq('elder_profile_id', id)
      .order('created_at', { ascending: true }),
    (isOwner || canManageMembers)
      ? supabase
          .from('care_invitations')
          .select('id, elder_profile_id, invited_email, assigned_role, expires_at, created_at')
          .eq('elder_profile_id', id)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  // 5. Fetch profiles for all members
  let membersWithProfiles: MemberWithProfile[] = []
  if (rawMembers && rawMembers.length > 0) {
    const memberUserIds = rawMembers.map((m) => m.member_user_id)
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', memberUserIds)

    const profileMap = new Map((memberProfiles || []).map((p) => [p.id, p]))

    membersWithProfiles = rawMembers.map((member) => ({
      ...member,
      profile: profileMap.get(member.member_user_id) || null,
    }))
  }

  // 6. Resolve Pending Invitations
  const pendingInvitations: PendingInvitationItem[] =
    (invitationsRes.data as PendingInvitationItem[]) || []

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

      {/* Main Content */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <CareCircleManager
            elder={elder}
            ownerProfile={ownerProfile}
            currentUserId={user.id}
            isOwner={isOwner}
            canManageMembers={canManageMembers}
            initialMembers={membersWithProfiles}
            initialPendingInvitations={pendingInvitations}
          />
        </div>
      </main>
    </div>
  )
}
