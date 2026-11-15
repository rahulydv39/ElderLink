import Link from 'next/link'
import {
  Calendar,
  Droplets,
  Activity,
  AlertTriangle,
  Phone,
  MapPin,
  Edit,
  Shield,
  User,
  Users,
  Pill,
} from 'lucide-react'
import type { Database, MemberRole } from '@/types/database.types'
import { calculateAge, formatDisplayDate } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'

type ElderProfileRow = Database['public']['Tables']['elder_profiles']['Row']

interface ElderProfileCardProps {
  elder: ElderProfileRow
  isOwner?: boolean
  sharedRole?: MemberRole | null
  memberCount?: number
  activeMedsCount?: number
  upcomingApptsCount?: number
  nextApptSummary?: {
    doctorName: string
    formattedDate: string
    hospitalName?: string | null
  } | null
}

export function ElderProfileCard({
  elder,
  isOwner = true,
  sharedRole = null,
  memberCount,
  activeMedsCount,
  upcomingApptsCount,
  nextApptSummary,
}: ElderProfileCardProps) {
  const age = calculateAge(elder.date_of_birth)
  const formattedDob = formatDisplayDate(elder.date_of_birth)

  const formatGenderLabel = (g: string | null) => {
    if (!g) return null
    switch (g) {
      case 'male':
        return 'Male'
      case 'female':
        return 'Female'
      case 'other':
        return 'Other'
      case 'prefer_not_to_say':
        return 'Demographics withheld'
      default:
        return g
    }
  }

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-md transition-shadow dark:border-slate-800 dark:bg-slate-900">
      <div>
        {/* Card Header: Avatar, Name, Age, Edit button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 ring-1 ring-teal-600/10">
              <User className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {elder.full_name}
                </h3>
                {isOwner ? (
                  <Badge
                    variant="outline"
                    className="border-teal-200 bg-teal-50/50 text-[10px] text-teal-700 dark:border-teal-800 dark:text-teal-300 dark:bg-teal-950/40"
                  >
                    Primary Owner
                  </Badge>
                ) : (
                  <Badge
                    className={`text-[10px] font-semibold px-2 py-0.5 capitalize ${
                      sharedRole === 'caretaker'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                    }`}
                  >
                    {sharedRole === 'caretaker' ? 'Caretaker' : 'Family Member'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {age} years old &bull; Born {formattedDob}
              </p>
            </div>
          </div>

          {/* Edit button: only displayed if current user is the owner */}
          {isOwner && (
            <Link
              href={`/elder-profiles/${elder.id}/edit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Edit className="h-3.5 w-3.5 text-slate-500" />
              <span>Edit</span>
            </Link>
          )}
        </div>

        {/* Demographics Pill Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/80">
          {elder.gender && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {formatGenderLabel(elder.gender)}
            </span>
          )}

          {elder.blood_group && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <Droplets className="h-3 w-3 text-rose-500" />
              <span>Blood: {elder.blood_group === 'unknown' ? 'Unknown' : elder.blood_group}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Calendar className="h-3 w-3" />
            <span>DOB: {elder.date_of_birth}</span>
          </span>
        </div>

        {/* Medical Conditions */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Medical Conditions
          </p>
          {elder.medical_conditions && elder.medical_conditions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {elder.medical_conditions.map((condition, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-800"
                >
                  <Activity className="h-3 w-3 mr-1 text-teal-600 dark:text-teal-400" />
                  {condition}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No medical conditions recorded</p>
          )}
        </div>

        {/* Allergies */}
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Known Allergies
          </p>
          {elder.allergies && elder.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {elder.allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800"
                >
                  <AlertTriangle className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" />
                  {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No known allergies</p>
          )}
        </div>

        {/* Emergency Contact & Address (When available) */}
        {(elder.emergency_contact_name || elder.emergency_contact_phone || elder.address) && (
          <div className="mt-4 rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 text-xs text-slate-600 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-300 space-y-2">
            {(elder.emergency_contact_name || elder.emergency_contact_phone) && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">
                    {elder.emergency_contact_name || 'Emergency Contact'}
                  </span>
                </div>
                {elder.emergency_contact_phone && (
                  <a
                    href={`tel:${elder.emergency_contact_phone}`}
                    className="font-medium text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
                  >
                    {elder.emergency_contact_phone}
                  </a>
                )}
              </div>
            )}

            {elder.address && (
              <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{elder.address}</span>
              </div>
            )}
          </div>
        )}

        {/* Next Appointment Preview (if scheduled) */}
        {nextApptSummary && (
          <div className="mt-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <Calendar className="h-3 w-3" />
                Next Appointment
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                {nextApptSummary.formattedDate}
              </span>
            </div>
            <p className="mt-1 font-medium text-slate-800 dark:text-slate-100 line-clamp-1">
              {nextApptSummary.doctorName}
              {nextApptSummary.hospitalName ? ` • ${nextApptSummary.hospitalName}` : ''}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Care Circle Action Button */}
          <Link
            href={`/elder-profiles/${elder.id}/care-circle`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 font-semibold text-teal-700 hover:bg-teal-100 transition-colors dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-950"
          >
            <Users className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>Care Circle</span>
            {typeof memberCount === 'number' && memberCount > 0 && (
              <span className="ml-0.5 rounded-full bg-teal-200/80 px-1.5 py-0.2 text-[10px] text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                {memberCount}
              </span>
            )}
          </Link>

          {/* Medications Action Button */}
          <Link
            href={`/elder-profiles/${elder.id}/medications`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 hover:bg-sky-100 transition-colors dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-950"
          >
            <Pill className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>Medications</span>
            {typeof activeMedsCount === 'number' && activeMedsCount > 0 && (
              <span className="ml-0.5 rounded-full bg-sky-200/80 px-1.5 py-0.2 text-[10px] text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                {activeMedsCount}
              </span>
            )}
          </Link>

          {/* Appointments Action Button */}
          <Link
            href={`/elder-profiles/${elder.id}/appointments`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Appointments</span>
            {typeof upcomingApptsCount === 'number' && upcomingApptsCount > 0 && (
              <span className="ml-0.5 rounded-full bg-emerald-200/80 px-1.5 py-0.2 text-[10px] text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                {upcomingApptsCount}
              </span>
            )}
          </Link>
        </div>

        {isOwner ? (
          <Link
            href={`/elder-profiles/${elder.id}/edit`}
            className="font-medium text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
          >
            Manage Details &rarr;
          </Link>
        ) : (
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Shield className="h-3 w-3 text-teal-500" />
            <span>Shared Circle Member</span>
          </span>
        )}
      </div>
    </div>
  )
}
