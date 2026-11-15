'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  HeartPulse,
  Users,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function JoinCareCircleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const initialCode = searchParams.get('code') || ''
  const [invitationCode, setInvitationCode] = useState(initialCode)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{
    elderProfileId: string
    assignedRole: string
  } | null>(null)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedCode = invitationCode.trim()

    if (!trimmedCode) {
      setErrorMessage('Please enter an invitation code.')
      return
    }

    if (trimmedCode.length < 24) {
      setErrorMessage(
        'Invalid invitation code format. ElderLink invitation codes are 32 hexadecimal characters.'
      )
      return
    }

    setIsLoading(true)

    try {
      // 1. Verify user authentication
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push(`/login?redirectTo=${encodeURIComponent(`/care-circle/join?code=${trimmedCode}`)}`)
        return
      }

      // 2. Call existing atomic accept_care_invitation RPC
      const { data, error } = await supabase.rpc('accept_care_invitation', {
        raw_code: trimmedCode,
      })

      if (error) {
        // Map database exception messages to user-friendly feedback
        const msg = error.message || ''
        if (msg.includes('invalid, already used, or expired')) {
          setErrorMessage(
            'This invitation code is invalid, has already been redeemed, or has expired. Please request a fresh invitation from the elder profile owner.'
          )
        } else if (msg.includes('different email address')) {
          setErrorMessage(
            'This invitation is restricted to a specific email address that does not match your currently signed-in account.'
          )
        } else if (msg.includes('already the owner')) {
          setErrorMessage('You are the owner of this elder profile and already hold full administrative access.')
        } else if (msg.includes('already a member')) {
          setErrorMessage('You are already an active member of this care circle.')
        } else {
          setErrorMessage(msg || 'Failed to accept invitation. Please verify the code and try again.')
        }
        setIsLoading(false)
        return
      }

      // 3. Process RPC JSONB response
      const result = data as {
        success?: boolean
        elder_profile_id?: string
        assigned_role?: string
      }

      if (result && result.elder_profile_id) {
        setSuccessData({
          elderProfileId: result.elder_profile_id,
          assignedRole: result.assigned_role || 'member',
        })
      } else {
        setSuccessData({
          elderProfileId: '',
          assignedRole: 'member',
        })
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while joining the care circle.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      {successData ? (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-5">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome to the Care Circle!
          </h2>

          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            You have successfully joined as a{' '}
            <span className="font-semibold text-teal-600 uppercase">
              {successData.assignedRole}
            </span>
            . The elder profile and its care modules are now available on your dashboard.
          </p>

          <div className="mt-6">
            <Button
              onClick={() => {
                router.push('/dashboard')
                router.refresh()
              }}
              className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm h-10 inline-flex items-center justify-center gap-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Join a Care Circle
            </h1>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Enter the one-time 32-character invitation code provided by the elder profile owner.
            </p>
          </div>

          {errorMessage && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleJoin} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="invitationCode" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Invitation Code
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="invitationCode"
                  name="invitationCode"
                  type="text"
                  placeholder="e.g. 4b8d7a8e23f91c50b64d8a1e5c2b9f3a"
                  value={invitationCode}
                  onChange={(e) => {
                    setInvitationCode(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={isLoading}
                  autoComplete="off"
                  spellCheck="false"
                  className="font-mono text-xs pr-10"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <KeyRound className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Invitation codes are 32 hexadecimal characters generated by the circle owner.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !invitationCode.trim()}
              className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm h-10 inline-flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Verifying & Joining...</span>
                </>
              ) : (
                <>
                  <span>Join Care Circle</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800 text-center">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Cancel and return to dashboard
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default function JoinCareCirclePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/70 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <Link href="/" className="mb-8 flex items-center gap-2.5 group">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm transition-transform group-hover:scale-105">
          <HeartPulse className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Elder<span className="text-teal-600">Link</span>
          </span>
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider -mt-1">
            Care Circle Network
          </span>
        </div>
      </Link>

      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto" />
            <p className="mt-2 text-xs text-slate-500">Loading invitation form...</p>
          </div>
        }
      >
        <JoinCareCircleForm />
      </Suspense>

      {/* Security badge */}
      <div className="mt-8 flex items-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="h-4 w-4 text-teal-600" />
        <span>Cryptographically hashed one-time tokens verified via Supabase RLS</span>
      </div>
    </div>
  )
}
