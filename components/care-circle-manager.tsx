'use client'

import { useState } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Activity,
  Calendar,
  Pill,
  X,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database, MemberRole } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatPhoneDisplay } from '@/lib/utils/phone'
import { isInternalAuthEmail } from '@/lib/utils/auth-identity'

type ElderProfileRow = Database['public']['Tables']['elder_profiles']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type CareCircleMemberRow = Database['public']['Tables']['care_circle_members']['Row']

export interface MemberWithProfile extends CareCircleMemberRow {
  profile?: ProfileRow | null
}

export interface PendingInvitationItem {
  id: string
  elder_profile_id: string
  invited_email: string | null
  assigned_role: MemberRole
  expires_at: string
  created_at: string
}

interface CareCircleManagerProps {
  elder: ElderProfileRow
  ownerProfile: ProfileRow | null
  currentUserId: string
  isOwner: boolean
  canManageMembers: boolean
  initialMembers: MemberWithProfile[]
  initialPendingInvitations: PendingInvitationItem[]
}

export function CareCircleManager({
  elder,
  ownerProfile,
  currentUserId,
  isOwner,
  canManageMembers,
  initialMembers,
  initialPendingInvitations,
}: CareCircleManagerProps) {
  const supabase = createClient()

  // Members and Invitations state
  const [members, setMembers] = useState<MemberWithProfile[]>(initialMembers)
  const [pendingInvitations, setPendingInvitations] =
    useState<PendingInvitationItem[]>(initialPendingInvitations)

  // Invitation creation state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteRole, setInviteRole] = useState<MemberRole>('family')
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [generatedCodeData, setGeneratedCodeData] = useState<{
    code: string
    role: MemberRole
    invitedEmail: string | null
    expiresAt: string
  } | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Revocation state
  const [memberToRevoke, setMemberToRevoke] = useState<MemberWithProfile | null>(null)
  const [isRevokingMember, setIsRevokingMember] = useState(false)
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null)

  // General feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback(null)
    }, 5000)
  }

  // Handle Invitation Generation
  const handleGenerateInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setIsGeneratingInvite(true)

    try {
      // For phone-based auth MVP, invitations are generated with p_invited_email = null
      // using high-entropy 128-bit cryptographic one-time codes
      const { data, error } = await supabase.rpc('create_care_invitation', {
        p_elder_id: elder.id,
        p_assigned_role: inviteRole,
        p_invited_email: null,
        p_duration_hours: 168, // 7 days
      })

      if (error) {
        setInviteError(error.message)
        setIsGeneratingInvite(false)
        return
      }

      const result = data as {
        invitation_id: string
        elder_profile_id: string
        raw_invitation_code: string
        assigned_role: MemberRole
        invited_email: string | null
        expires_at: string
      }

      setGeneratedCodeData({
        code: result.raw_invitation_code,
        role: result.assigned_role,
        invitedEmail: result.invited_email,
        expiresAt: result.expires_at,
      })

      // Add to pending invitations list
      setPendingInvitations((prev) => [
        {
          id: result.invitation_id,
          elder_profile_id: result.elder_profile_id,
          invited_email: result.invited_email,
          assigned_role: result.assigned_role,
          expires_at: result.expires_at,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while creating invitation.'
      setInviteError(message)
    } finally {
      setIsGeneratingInvite(false)
    }
  }

  // Copy raw invitation code to clipboard
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  // Copy full join link to clipboard
  const handleCopyLink = async (code: string) => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const joinUrl = `${origin}/care-circle/join?code=${code}`
      await navigator.clipboard.writeText(joinUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  // Revoke a member's access (authorized owner or member leaving)
  const handleConfirmRevokeMember = async () => {
    if (!memberToRevoke) return

    setIsRevokingMember(true)
    try {
      const { error } = await supabase
        .from('care_circle_members')
        .delete()
        .eq('id', memberToRevoke.id)

      if (error) {
        showFeedback('error', `Failed to remove member: ${error.message}`)
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== memberToRevoke.id))
        const removedName = memberToRevoke.profile?.full_name || 'Member'
        showFeedback('success', `${removedName} has been removed from ${elder.full_name}'s care circle.`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke membership.'
      showFeedback('error', message)
    } finally {
      setIsRevokingMember(false)
      setMemberToRevoke(null)
    }
  }

  // Revoke an unredeemed invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    setRevokingInvitationId(invitationId)
    try {
      const { error } = await supabase.rpc('revoke_care_invitation', {
        invitation_id: invitationId,
      })

      if (error) {
        showFeedback('error', `Failed to revoke invitation: ${error.message}`)
      } else {
        setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId))
        showFeedback('success', 'Invitation has been cancelled and its code invalidated.')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke invitation.'
      showFeedback('error', message)
    } finally {
      setRevokingInvitationId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Toast Feedback */}
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

      {/* Top Banner: Elder & Circle Summary */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 ring-1 ring-teal-600/10">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {elder.full_name}&apos;s Care Circle
                </h1>
                <Badge
                  variant="outline"
                  className="border-teal-200 bg-teal-50 text-teal-700 text-xs dark:border-teal-800 dark:text-teal-300 dark:bg-teal-950"
                >
                  {members.length + 1} Total {members.length + 1 === 1 ? 'Caregiver' : 'Caregivers'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Coordinated circle of family members and professional caretakers authorized to manage health regimens.
              </p>
            </div>
          </div>

          {/* Action: Invite Member */}
          {(isOwner || canManageMembers) && (
            <Button
              onClick={() => {
                setShowInviteModal(true)
                setGeneratedCodeData(null)
                setInviteError(null)
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Invite Member</span>
            </Button>
          )}
        </div>
      </div>

      {/* Invitation Generation Modal / Form */}
      {showInviteModal && (
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/50 via-white to-sky-50/30 p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Invite a New Care Circle Member
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generate a cryptographically secure 128-bit invitation code to share with a caretaker or family member.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowInviteModal(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {generatedCodeData ? (
            /* Result: Show Raw Invitation Code & Copy Controls */
            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-teal-200 bg-teal-50/90 p-5 dark:border-teal-900 dark:bg-teal-950/40">
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 dark:text-teal-300 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-600" />
                  <span>One-Time Invitation Code Generated Successfully</span>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 rounded-lg border border-teal-300/80 bg-white p-3 font-mono text-sm sm:text-base font-bold tracking-wider text-slate-900 text-center select-all dark:border-teal-800 dark:bg-slate-950 dark:text-teal-300">
                    {generatedCodeData.code}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      onClick={() => handleCopyCode(generatedCodeData.code)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      {codeCopied ? (
                        <>
                          <Check className="h-4 w-4 text-white" />
                          <span>Code Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCopyLink(generatedCodeData.code)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border-teal-300 text-teal-700 hover:bg-teal-100/60 text-xs font-semibold dark:border-teal-800 dark:text-teal-300"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-4 w-4 text-teal-600" />
                          <span>Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4" />
                          <span>Copy Join Link</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Assigned Role:</span>{' '}
                    <span className="capitalize">{generatedCodeData.role}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Recipient:</span>{' '}
                    {generatedCodeData.invitedEmail || 'Any authenticated user with this code'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Expires:</span>{' '}
                    {new Date(generatedCodeData.expiresAt).toLocaleDateString()} (7 days)
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 text-xs text-slate-600 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-300 space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white">How the recipient joins:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400">
                  <li>Send them this code or the direct join link.</li>
                  <li>They will register or sign in to their ElderLink account.</li>
                  <li>Upon entering the code at <code className="font-mono text-teal-600 dark:text-teal-400">/care-circle/join</code>, they gain access according to their role.</li>
                </ol>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => {
                    setGeneratedCodeData(null)
                    setShowInviteModal(false)
                  }}
                  variant="outline"
                  className="rounded-xl text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* Form: Select Role & Optional Email */
            <form onSubmit={handleGenerateInvitation} className="mt-6 space-y-5">
              {inviteError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">{inviteError}</div>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Select Care Circle Role <span className="text-teal-600">*</span>
                </Label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Family Option */}
                  <div
                    onClick={() => setInviteRole('family')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      inviteRole === 'family'
                        ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500/20 dark:bg-teal-950/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Family Member</span>
                      {inviteRole === 'family' && (
                        <CheckCircle2 className="h-4 w-4 text-teal-600" />
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Read-only access to vital medical information, allergies, and daily checkup summaries.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                        View Medical Records
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-400 dark:bg-slate-800 px-2 py-0.5 rounded-md line-through">
                        Edit Regimens
                      </span>
                    </div>
                  </div>

                  {/* Caretaker Option */}
                  <div
                    onClick={() => setInviteRole('caretaker')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      inviteRole === 'caretaker'
                        ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500/20 dark:bg-teal-950/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Caretaker / Nurse</span>
                      {inviteRole === 'caretaker' && (
                        <CheckCircle2 className="h-4 w-4 text-teal-600" />
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Full operational access to manage medications, schedule doses, log adherence, and book doctor visits.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="text-[10px] bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 px-2 py-0.5 rounded-md font-medium">
                        Manage Medications
                      </span>
                      <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 rounded-md font-medium">
                        Manage Appointments
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Single-Use Cryptographic Code Notice */}
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3.5 text-xs text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>One-Time Cryptographic Code</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-teal-800 dark:text-teal-300">
                  Invitations generate a single-use 128-bit cryptographic code valid for 7 days. Anyone who receives this code and logs in with their mobile number can redeem it to join with the assigned role.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  disabled={isGeneratingInvite}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isGeneratingInvite}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  {isGeneratingInvite ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Generating Code...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>Generate Secure Invitation</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Primary Owner Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Primary Profile Owner
          </h2>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-slate-50/80 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white font-bold text-sm shadow-xs">
              {ownerProfile?.full_name ? ownerProfile.full_name.charAt(0).toUpperCase() : 'O'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {ownerProfile?.full_name || 'Primary Owner'}
                </span>
                <Badge className="bg-teal-600 text-white text-[10px] font-semibold px-2 py-0.5">
                  Owner & Administrator
                </Badge>
                {ownerProfile?.id === currentUserId && (
                  <Badge variant="outline" className="border-teal-200 text-teal-700 text-[10px]">
                    You
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {ownerProfile?.phone
                  ? formatPhoneDisplay(ownerProfile.phone)
                  : ownerProfile?.email &&
                    ownerProfile.email !== '' &&
                    !isInternalAuthEmail(ownerProfile.email)
                  ? ownerProfile.email
                  : 'Authenticated Owner'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Shield className="h-3 w-3 text-teal-500" />
              Full Access & Invitation Authority
            </span>
          </div>
        </div>
      </div>

      {/* Circle Members Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Care Circle Members ({members.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Users who have accepted an invitation to support {elder.full_name}.
            </p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 mb-3">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No additional care circle members yet
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Invite family members, relatives, or home care nurses to coordinate daily care and medications together.
            </p>
            {(isOwner || canManageMembers) && (
              <div className="mt-4">
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 text-xs text-white"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  <span>Invite Your First Member</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((member) => {
              const isCurrentUser = member.member_user_id === currentUserId
              const memberName = member.profile?.full_name || 'Caregiver'
              const memberContact = member.profile?.phone
                ? formatPhoneDisplay(member.profile.phone)
                : member.profile?.email &&
                  member.profile.email !== '' &&
                  !isInternalAuthEmail(member.profile.email)
                ? member.profile.email
                : 'Circle Member'

              return (
                <div
                  key={member.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  {/* Left: Avatar & Identity */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-sm dark:bg-slate-800 dark:text-slate-200">
                      {memberName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {memberName}
                        </span>

                        <Badge
                          className={`text-[10px] font-semibold px-2 py-0.5 capitalize ${
                            member.role === 'caretaker'
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          }`}
                        >
                          {member.role}
                        </Badge>

                        {isCurrentUser && (
                          <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600">
                            You
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {memberContact}
                      </p>

                      {/* Permissions row */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {member.can_view_medical_info && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Activity className="h-3 w-3 text-teal-600" />
                            <span>Medical Records</span>
                          </span>
                        )}
                        {member.can_manage_medications && (
                          <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                            <Pill className="h-3 w-3 text-teal-600" />
                            <span>Manage Medications</span>
                          </span>
                        )}
                        {member.can_manage_appointments && (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                            <Calendar className="h-3 w-3 text-sky-600" />
                            <span>Manage Appointments</span>
                          </span>
                        )}
                        {member.can_manage_members && (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                            <Shield className="h-3 w-3 text-purple-600" />
                            <span>Invite Authority</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Join Date & Revocation Action */}
                  <div className="flex items-center gap-4 self-end md:self-center">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Joined {new Date(member.created_at).toLocaleDateString()}</span>
                    </span>

                    {(isOwner || isCurrentUser) && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setMemberToRevoke(member)}
                        className="h-8 rounded-lg px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        <span>{isCurrentUser ? 'Leave Circle' : 'Revoke Access'}</span>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pending Invitations Section */}
      {(isOwner || canManageMembers) && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Pending Invitations ({pendingInvitations.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active invitation codes awaiting redemption. Unredeemed codes expire after 7 days.
              </p>
            </div>
          </div>

          {pendingInvitations.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400 italic">
              No active pending invitations.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          {inv.invited_email ? inv.invited_email : 'Any authorized user'}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {inv.assigned_role}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revokingInvitationId === inv.id}
                    onClick={() => handleRevokeInvitation(inv.id)}
                    className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                  >
                    {revokingInvitationId === inv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    <span>Cancel Invitation</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog: Revoke Member Access */}
      {memberToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {memberToRevoke.member_user_id === currentUserId
                    ? 'Leave Care Circle?'
                    : 'Revoke Member Access?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action takes effect immediately.
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {memberToRevoke.member_user_id === currentUserId ? (
                <>
                  Are you sure you want to leave {elder.full_name}&apos;s care circle? You will no
                  longer be able to view their medical logs or medication schedules until re-invited.
                </>
              ) : (
                <>
                  Are you sure you want to remove{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {memberToRevoke.profile?.full_name || 'this member'}
                  </span>{' '}
                  from {elder.full_name}&apos;s care circle? They will immediately lose access to all
                  prescriptions, logs, and health records.
                </>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isRevokingMember}
                onClick={() => setMemberToRevoke(null)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={isRevokingMember}
                onClick={handleConfirmRevokeMember}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white inline-flex items-center gap-1.5"
              >
                {isRevokingMember ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Confirm Removal</span>
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
