'use client'

import Link from 'next/link'
import {
  HeartPulse,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/70 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      {/* Brand header */}
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

      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Password Recovery
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Account recovery for mobile number credentials
          </p>
        </div>

        {/* Clear statement that automated recovery is unavailable */}
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold text-amber-950 dark:text-amber-100 mb-1">
              Automated Password Recovery Unavailable
            </p>
            <p>
              ElderLink accounts authenticate using mobile number and password without SMS OTP verification. Because SMS gateway recovery is not configured for this application, automated self-service password reset is currently unavailable.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              Available Alternatives:
            </p>

            <div className="flex items-start gap-2.5">
              <UserCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-900 dark:text-white">
                  Care Circle Members:
                </span>{' '}
                If you are a family member or caretaker and cannot access your account, ask the primary elder profile administrator to generate a fresh invitation code for your mobile number.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <KeyRound className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-900 dark:text-white">
                  Active Sessions:
                </span>{' '}
                If you are currently signed in on this or another browser session, you can update your password directly via{' '}
                <Link
                  href="/reset-password"
                  className="font-semibold text-teal-600 underline hover:no-underline dark:text-teal-400"
                >
                  Set New Password
                </Link>
                .
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link href="/login" className="w-full">
            <Button
              type="button"
              className="w-full h-11 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span>Return to Mobile Sign In</span>
            </Button>
          </Link>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center dark:border-slate-800">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Need a new account?{' '}
            <Link
              href="/signup"
              className="font-semibold text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
            >
              Sign Up with Mobile
            </Link>
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Patient data protected under HIPAA & RLS governance</span>
        </div>
      </div>
    </div>
  )
}
