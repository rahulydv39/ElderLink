'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  HeartPulse,
  Activity,
  AlertTriangle,
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  PlusCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database, Gender, BloodGroup } from '@/types/database.types'
import { isFutureDate, calculateAge } from '@/lib/utils/date'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type ElderProfileRow = Database['public']['Tables']['elder_profiles']['Row']

interface ElderProfileFormProps {
  mode: 'create' | 'edit'
  initialData?: ElderProfileRow
  cancelHref?: string
}

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
]

const BLOOD_GROUP_OPTIONS: { label: string; value: BloodGroup }[] = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
  { label: 'Unknown', value: 'unknown' },
]

export function ElderProfileForm({
  mode,
  initialData,
  cancelHref = '/dashboard',
}: ElderProfileFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Form field state
  const [fullName, setFullName] = useState(initialData?.full_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(initialData?.date_of_birth || '')
  const [gender, setGender] = useState<Gender | ''>(initialData?.gender || '')
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>(initialData?.blood_group || '')
  const [medicalConditionsInput, setMedicalConditionsInput] = useState(
    initialData?.medical_conditions ? initialData.medical_conditions.join(', ') : ''
  )
  const [allergiesInput, setAllergiesInput] = useState(
    initialData?.allergies ? initialData.allergies.join(', ') : ''
  )
  const [emergencyContactName, setEmergencyContactName] = useState(
    initialData?.emergency_contact_name || ''
  )
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initialData?.emergency_contact_phone || ''
  )
  const [address, setAddress] = useState(initialData?.address || '')

  // Feedback & submission state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Parse comma-separated strings into array of trimmed strings
  const parseCommaList = (input: string): string[] => {
    return input
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const parsedConditions = parseCommaList(medicalConditionsInput)
  const parsedAllergies = parseCommaList(allergiesInput)

  // Real-time calculated age
  const calculatedAge = dateOfBirth && !isFutureDate(dateOfBirth) ? calculateAge(dateOfBirth) : null

  // Validate fields before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Full Name
    if (!fullName.trim()) {
      errors.fullName = "Elder's full name is required."
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.'
    }

    // Date of Birth
    if (!dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required.'
    } else if (isFutureDate(dateOfBirth)) {
      errors.dateOfBirth = 'Date of birth cannot be in the future.'
    } else {
      const dob = new Date(dateOfBirth)
      if (isNaN(dob.getTime())) {
        errors.dateOfBirth = 'Please enter a valid calendar date.'
      }
    }

    // Emergency Contact Phone (optional, but validate format if entered)
    if (emergencyContactPhone.trim()) {
      const phoneRegex = /^[+0-9\s\-()]{7,20}$/
      if (!phoneRegex.test(emergencyContactPhone.trim())) {
        errors.emergencyContactPhone =
          'Please enter a valid phone number (digits, spaces, hyphens, and optional + prefix).'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Get current authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login?redirectTo=' + encodeURIComponent(window.location.pathname))
        return
      }

      const payload = {
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        gender: (gender as Gender) || null,
        blood_group: (bloodGroup as BloodGroup) || null,
        medical_conditions: parseCommaList(medicalConditionsInput),
        allergies: parseCommaList(allergiesInput),
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        address: address.trim() || null,
      }

      if (mode === 'create') {
        const { data, error } = await supabase
          .from('elder_profiles')
          .insert({
            ...payload,
            owner_user_id: user.id, // Strictly set from authenticated identity
          })
          .select()
          .single()

        if (error) {
          setGeneralError(error.message)
          setIsSubmitting(false)
          return
        }

        setSuccessMessage(`Elder profile for ${data.full_name} created successfully!`)
      } else {
        // Edit mode
        if (!initialData) {
          setGeneralError('Missing profile record to update.')
          setIsSubmitting(false)
          return
        }

        // Verify client-side ownership check before calling API
        if (initialData.owner_user_id !== user.id) {
          setGeneralError('Permission denied: You can only edit elder profiles you own.')
          setIsSubmitting(false)
          return
        }

        const { data, error } = await supabase
          .from('elder_profiles')
          .update(payload)
          .eq('id', initialData.id)
          .eq('owner_user_id', user.id) // Enforce owner check in query
          .select()
          .single()

        if (error) {
          setGeneralError(error.message)
          setIsSubmitting(false)
          return
        }

        setSuccessMessage(`Elder profile for ${data.full_name} updated successfully!`)
      }

      // Smooth redirection to dashboard
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 900)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while saving profile.'
      setGeneralError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Alert Banners */}
      {generalError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to save profile</p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{generalError}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/90 p-4 text-sm text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
          <div className="flex-1">
            <p className="font-semibold">{successMessage}</p>
            <p className="text-xs text-teal-700 dark:text-teal-300">Redirecting to dashboard...</p>
          </div>
        </div>
      )}

      {/* Section 1: Basic Identity */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Primary Identity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Essential biographical information for identification and care coordination.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Elder's Full Name (Required) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fullName" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Elder&apos;s Full Name <span className="text-teal-600">*</span>
              </Label>
              <span className="text-xs text-slate-400">Required</span>
            </div>
            <div className="relative mt-1.5">
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="e.g. Margaret Jenkins, Dr. Robert Davis"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  if (fieldErrors.fullName) {
                    setFieldErrors((prev) => ({ ...prev, fullName: '' }))
                  }
                }}
                disabled={isSubmitting}
                className={fieldErrors.fullName ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.fullName ? (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.fullName}</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                The name by which family members and caregivers will recognize this profile.
              </p>
            )}
          </div>

          {/* Date of Birth (Required) */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dateOfBirth" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Date of Birth <span className="text-teal-600">*</span>
              </Label>
              {calculatedAge !== null && (
                <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50 dark:border-teal-800 dark:text-teal-300">
                  {calculatedAge} years old
                </Badge>
              )}
            </div>
            <div className="relative mt-1.5">
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={dateOfBirth}
                onChange={(e) => {
                  setDateOfBirth(e.target.value)
                  if (fieldErrors.dateOfBirth) {
                    setFieldErrors((prev) => ({ ...prev, dateOfBirth: '' }))
                  }
                }}
                disabled={isSubmitting}
                className={fieldErrors.dateOfBirth ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.dateOfBirth ? (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.dateOfBirth}</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Used to calculate age and ensure age-appropriate care logs.
              </p>
            )}
          </div>

          {/* Gender (Optional) */}
          <div>
            <Label htmlFor="gender" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Gender
            </Label>
            <div className="mt-1.5">
              <select
                id="gender"
                name="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | '')}
                disabled={isSubmitting}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              >
                <option value="">Select gender (optional)</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="dark:bg-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Optional demographic indicator.</p>
          </div>
        </div>
      </div>

      {/* Section 2: Clinical Details */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <HeartPulse className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Clinical & Medical Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crucial health context for doctors, caretakers, and emergency responders.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Blood Group (Optional) */}
          <div className="sm:col-span-2">
            <Label htmlFor="bloodGroup" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Blood Group
            </Label>
            <div className="mt-1.5 max-w-xs">
              <select
                id="bloodGroup"
                name="bloodGroup"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value as BloodGroup | '')}
                disabled={isSubmitting}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              >
                <option value="">Select blood group (optional)</option>
                {BLOOD_GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="dark:bg-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Essential for clinical records and blood transfusion cross-matching.
            </p>
          </div>

          {/* Medical Conditions (Comma separated) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="medicalConditions" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Medical Conditions
              </Label>
              <span className="text-xs text-slate-400">Comma-separated</span>
            </div>
            <div className="relative mt-1.5">
              <Input
                id="medicalConditions"
                name="medicalConditions"
                type="text"
                placeholder="e.g. Hypertension, Type 2 Diabetes, Mild Osteoarthritis"
                value={medicalConditionsInput}
                onChange={(e) => setMedicalConditionsInput(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {parsedConditions.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 mr-1">Stored items:</span>
                {parsedConditions.map((cond, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-800"
                  >
                    <Activity className="h-3 w-3 mr-1 text-teal-500" />
                    {cond}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Separate multiple diagnosed conditions with commas.
              </p>
            )}
          </div>

          {/* Known Allergies (Comma separated) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="allergies" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Known Allergies
              </Label>
              <span className="text-xs text-slate-400">Comma-separated</span>
            </div>
            <div className="relative mt-1.5">
              <Input
                id="allergies"
                name="allergies"
                type="text"
                placeholder="e.g. Penicillin, Peanuts, Sulfa drugs, Latex"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {parsedAllergies.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 mr-1">Stored items:</span>
                {parsedAllergies.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                List drug allergies, food intolerances, and environmental triggers.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Emergency Contact & Address */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Phone className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Emergency Contact & Residence
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Immediate point of contact in critical situations.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Emergency Contact Name */}
          <div>
            <Label htmlFor="emergencyContactName" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Emergency Contact Person
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="emergencyContactName"
                name="emergencyContactName"
                type="text"
                placeholder="e.g. Sarah Jenkins (Daughter)"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Name and relation of primary caregiver.</p>
          </div>

          {/* Emergency Contact Phone */}
          <div>
            <Label htmlFor="emergencyContactPhone" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Emergency Contact Phone
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                type="tel"
                placeholder="e.g. +1 (555) 234-5678"
                value={emergencyContactPhone}
                onChange={(e) => {
                  setEmergencyContactPhone(e.target.value)
                  if (fieldErrors.emergencyContactPhone) {
                    setFieldErrors((prev) => ({ ...prev, emergencyContactPhone: '' }))
                  }
                }}
                disabled={isSubmitting}
                className={fieldErrors.emergencyContactPhone ? 'border-red-500 focus-visible:ring-red-200' : ''}
              />
            </div>
            {fieldErrors.emergencyContactPhone ? (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.emergencyContactPhone}</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">Direct phone number for emergencies.</p>
            )}
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <Label htmlFor="address" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Residential Address
            </Label>
            <div className="relative mt-1.5">
              <Textarea
                id="address"
                name="address"
                rows={3}
                placeholder="e.g. Apt 4B, 742 Evergreen Terrace, Springfield, OR"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Elder&apos;s physical residence for house calls, ambulance pickups, or medicine deliveries.
            </p>
          </div>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
        <Link
          href={cancelHref}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Cancel
        </Link>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>{mode === 'create' ? 'Creating Profile...' : 'Saving Changes...'}</span>
            </>
          ) : (
            <>
              {mode === 'create' ? (
                <>
                  <PlusCircle className="h-4 w-4" />
                  <span>Create Elder Profile</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
