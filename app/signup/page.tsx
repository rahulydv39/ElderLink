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
  ArrowRight,
  ShieldCheck,
  Phone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  SUPPORTED_COUNTRY_CODES,
  normalizePhoneNumber,
  validatePhoneNumber,
} from '@/lib/utils/phone'
import { phoneToAuthEmail } from '@/lib/utils/auth-identity'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [fullName, setFullName] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDuplicatePhone, setIsDuplicatePhone] = useState(false)

  // Real-time password validation criteria
  const isMinLength = password.length >= 8
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const isPasswordValid = isMinLength && hasNumberOrSymbol

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsDuplicatePhone(false)

    // 1. Full name validation
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.')
      return
    }

    // 2. Phone validation
    const phoneValidation = validatePhoneNumber(countryCode, mobileNumber)
    if (!phoneValidation.isValid) {
      setErrorMessage(phoneValidation.error || 'Please enter a valid mobile number.')
      return
    }

    const normalizedPhone = normalizePhoneNumber(countryCode, mobileNumber)

    // 3. Optional email format check
    const trimmedEmail = email.trim()
    if (trimmedEmail && (!trimmedEmail.includes('@') || !trimmedEmail.includes('.'))) {
      setErrorMessage('Please enter a valid email address or leave it blank.')
      return
    }

    // 4. Password validation
    if (!isPasswordValid) {
      setErrorMessage(
        'Password must be at least 8 characters and contain at least one number or special character.'
      )
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password.')
      return
    }

    if (!acceptedTerms) {
      setErrorMessage('You must agree to the Terms of Service and Privacy Policy to proceed.')
      return
    }

    setIsLoading(true)

    try {
      // Deterministically derive hidden internal auth email from normalized phone
      const internalAuthEmail = phoneToAuthEmail(normalizedPhone)

      const { data, error } = await supabase.auth.signUp({
        email: internalAuthEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: normalizedPhone,
            contact_email: trimmedEmail || '',
            auth_identifier_type: 'phone_alias',
          },
        },
      })

      if (error) {
        const lowerMsg = error.message.toLowerCase()
        if (
          lowerMsg.includes('already registered') ||
          lowerMsg.includes('already exists') ||
          lowerMsg.includes('duplicate') ||
          lowerMsg.includes('user already exists')
        ) {
          setIsDuplicatePhone(true)
          setErrorMessage('An account with this mobile number already exists. Please sign in instead.')
        } else {
          setErrorMessage(error.message)
        }
        setIsLoading(false)
        return
      }

      // Require a session after successful signup
      if (!data.session) {
        setErrorMessage(
          'Registration succeeded but a session was not established. Please ensure "Confirm email" is disabled in your Supabase Auth provider settings.'
        )
        setIsLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred during signup.'
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Sign up with your mobile number to coordinate family eldercare
          </p>
        </div>

        {errorMessage && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{errorMessage}</p>
              {isDuplicatePhone && (
                <div className="mt-2">
                  <Link
                    href="/login"
                    className="font-semibold text-teal-700 underline hover:no-underline dark:text-teal-300"
                  >
                    Click here to Sign In with your mobile number &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Full Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="e.g. Eleanor Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
              className="h-10 rounded-xl border-slate-200 focus-visible:ring-teal-600 dark:border-slate-800"
            />
          </div>

          {/* Mobile Number with Country Code */}
          <div className="space-y-1.5">
            <Label htmlFor="mobileNumber" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mobile Number <span className="text-rose-500">*</span>
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
                  autoComplete="tel-national"
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
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Used as your primary sign-in ID. E.164 formatted.
            </p>
          </div>

          {/* Optional Email Address */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </Label>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                Optional
              </span>
            </div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-10 rounded-xl border-slate-200 focus-visible:ring-teal-600 dark:border-slate-800"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Optional contact for updates and Care Circle invites.
            </p>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

            {/* Password Validation Checklist */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2.5 text-[11px] dark:bg-slate-800/60">
                <div className="flex items-center gap-1.5">
                  {isMinLength ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span
                    className={
                      isMinLength
                        ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                        : 'text-slate-500'
                    }
                  >
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasNumberOrSymbol ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span
                    className={
                      hasNumberOrSymbol
                        ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                        : 'text-slate-500'
                    }
                  >
                    Contains a number or special character
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label
              htmlFor="confirmPassword"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Confirm Password <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter password"
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
                  passwordsMatch
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
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

          {/* Terms Checkbox */}
          <div className="pt-2">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                className="mt-0.5 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
              />
              <Label
                htmlFor="terms"
                className="text-xs leading-snug font-normal text-slate-600 dark:text-slate-300 cursor-pointer select-none"
              >
                I agree to ElderLink&apos;s{' '}
                <Link
                  href="/terms"
                  className="font-semibold text-teal-600 hover:underline dark:text-teal-400"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="font-semibold text-teal-600 hover:underline dark:text-teal-400"
                >
                  Privacy Policy
                </Link>{' '}
                for collaborative elderly healthcare.
              </Label>
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
                <span>Creating Account...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>Create Account</span>
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center dark:border-slate-800">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
            >
              Sign In with Mobile
            </Link>
          </p>
        </div>

        {/* Security assurance */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Protected by 256-bit encryption & Supabase RLS</span>
        </div>
      </div>
    </div>
  )
}
