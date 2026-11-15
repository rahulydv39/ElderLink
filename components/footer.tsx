import Link from "next/link"
import { HeartPulse } from "lucide-react"

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
              <HeartPulse className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Elder<span className="text-teal-600">Link</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Collaborative elderly healthcare & medication management
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link href="#features" className="hover:text-teal-600 transition-colors">
              Features
            </Link>
            <Link href="#medication-management" className="hover:text-teal-600 transition-colors">
              Medications
            </Link>
            <Link href="#family-care-circle" className="hover:text-teal-600 transition-colors">
              Care Circles
            </Link>
            <Link href="#appointment-tracking" className="hover:text-teal-600 transition-colors">
              Appointments
            </Link>
            <Link href="/privacy" className="hover:text-teal-600 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-teal-600 transition-colors">
              Terms
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-500">
          <p>© 2026 ElderLink Platform. Built for elderly care coordination.</p>
        </div>
      </div>
    </footer>
  )
}
