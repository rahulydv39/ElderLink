'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  HeartPulse,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isMinLength = password.length >= 8
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const isPasswordValid = isMinLength && hasNumberOrSymbol

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!isPasswordValid) {
      setErrorMessage('Password must be at least 8 characters and include at least one number or symbol.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 2000)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Set new password
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Please choose a strong, secure password for your account
          </p>
        </div>

        {success ? (
          <div className="mt-6 text-center">
            <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400 mb-2" />
              <p className="font-semibold text-sm">Password updated successfully!</p>
              <p className="text-xs mt-1">Redirecting to your dashboard...</p>
            </div>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-10 rounded-xl border-slate-200 pr-10 focus-visible:ring-teal-600 dark:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Validation checklist */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2.5 text-[11px] dark:bg-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      {isMinLength ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className={isMinLength ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-slate-500'}>
                        At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasNumberOrSymbol ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className={hasNumberOrSymbol ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-slate-500'}>
                        Contains a number or symbol
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-10 rounded-xl border-slate-200 pr-10 focus-visible:ring-teal-600 dark:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <p
                    className={`text-[11px] font-medium flex items-center gap-1 mt-1 ${
                      passwordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {passwordsMatch ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        <span>Passwords do not match yet</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl bg-teal-600 text-white font-semibold shadow-md shadow-teal-600/20 hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/30 transition-all active:scale-[0.99] mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating password...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>Update Password</span>
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center dark:border-slate-800">
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
              >
                Return to Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
