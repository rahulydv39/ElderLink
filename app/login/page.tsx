'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  HeartPulse,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Phone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SUPPORTED_COUNTRY_CODES,
  normalizePhoneNumber,
  validatePhoneNumber,
} from '@/lib/utils/phone'
import { phoneToAuthEmail } from '@/lib/utils/auth-identity'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const messageParam = searchParams.get('message')

  const [countryCode, setCountryCode] = useState('+91')
  const [mobileNumber, setMobileNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage] = useState<string | null>(messageParam)
  const [isUnregistered, setIsUnregistered] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsUnregistered(false)

    // Validate phone
    const phoneValidation = validatePhoneNumber(countryCode, mobileNumber)
    if (!phoneValidation.isValid) {
      setErrorMessage(phoneValidation.error || 'Please enter a valid mobile number.')
      return
    }

    if (!password) {
      setErrorMessage('Please enter your password.')
      return
    }

    setIsLoading(true)

    try {
      const normalizedPhone = normalizePhoneNumber(countryCode, mobileNumber)
      const internalAuthEmail = phoneToAuthEmail(normalizedPhone)

      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalAuthEmail,
        password,
      })

      if (error) {
        const lowerMsg = error.message.toLowerCase()
        if (
          lowerMsg.includes('invalid login credentials') ||
          lowerMsg.includes('invalid_grant') ||
          lowerMsg.includes('invalid credentials') ||
          lowerMsg.includes('user not found') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('no user')
        ) {
          setErrorMessage(
            'Invalid mobile number or password. Please verify your credentials and try again.'
          )
        } else {
          setErrorMessage(error.message)
        }
        setIsLoading(false)
        return
      }

      if (data.user) {
        router.push(redirectTo)
        router.refresh()
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred during sign in.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Sign in to your ElderLink family care circle
        </p>
      </div>

      {infoMessage && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
          <span>{infoMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{errorMessage}</p>
            {isUnregistered && (
              <div className="mt-2">
                <Link
                  href="/signup"
                  className="font-semibold text-teal-700 underline hover:no-underline dark:text-teal-300"
                >
                  Create a new ElderLink account &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        {/* Mobile Number with Country Code */}
        <div className="space-y-1.5">
          <Label htmlFor="mobileNumber" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Registered Mobile Number
          </Label>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isLoading}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                aria-label="Country calling code"
              >
                {SUPPORTED_COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1">
              <Input
                id="mobileNumber"
                type="tel"
                autoComplete="tel"
                placeholder={countryCode === '+91' ? '98765 43210' : 'Mobile number'}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 rounded-xl border-slate-200 pr-9 focus-visible:ring-teal-600 dark:border-slate-800"
              />
              <Phone className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
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
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 rounded-xl bg-teal-600 text-white font-semibold shadow-md shadow-teal-600/20 hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/30 transition-all active:scale-[0.99] mt-2"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing in...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span>Sign In to Circle</span>
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-5 text-center dark:border-slate-800">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-semibold text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
          >
            Create an Account
          </Link>
        </p>
      </div>

      {/* Security assurance */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
        <span>Secure authentication with Supabase SSR</span>
      </div>
    </div>
  )
}

export default function LoginPage() {
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

      <Suspense
        fallback={
          <div className="h-96 w-full max-w-md animate-pulse rounded-2xl bg-white shadow-xl dark:bg-slate-900" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  )
}
