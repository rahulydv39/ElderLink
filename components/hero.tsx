import Link from "next/link"
import {
  ArrowRight,
  ShieldCheck,
  Users2,
  Pill,
  Calendar,
  CheckCircle2,
  Sparkles,
} from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Background soft ambient accents */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[420px] w-[620px] rounded-full bg-teal-100/60 blur-3xl dark:bg-teal-950/20" />
        <div className="h-[360px] w-[500px] -translate-y-24 translate-x-32 rounded-full bg-sky-100/50 blur-3xl dark:bg-sky-950/20" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Headline and CTAs */}
          <div className="flex flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-3.5 py-1 text-xs font-semibold text-teal-800 backdrop-blur dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-300">
              <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Collaborative Healthcare Platform for Seniors</span>
            </div>

            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-white">
              Caring for aging loved ones,{" "}
              <span className="bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent">
                together with confidence.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              ElderLink unites seniors, family members, and caregivers in a single
              synchronized circle. Never miss a critical dose, coordinate clinical
              appointments, and keep everyone on the same page every single day.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col w-full sm:w-auto sm:flex-row items-center gap-3.5">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-base font-semibold text-white shadow-md shadow-teal-600/20 transition-all hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/30 active:scale-[0.98]"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Sign In to Care Circle
              </Link>
            </div>

            {/* Trust points */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-500 lg:justify-start dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span>Encrypted & Private</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span>Multi-Caregiver Sync</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span>Senior-Friendly Design</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Healthcare Mockup Preview */}
          <div className="w-full lg:col-span-5">
            <div className="relative mx-auto max-w-md rounded-2xl border border-teal-100 bg-white/95 p-6 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-bold text-base dark:bg-teal-950 dark:text-teal-300">
                    ER
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      Eleanor Vance&apos;s Circle
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      3 family & 1 caretaker active
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced
                </span>
              </div>

              {/* Feed items */}
              <div className="mt-5 space-y-3.5">
                {/* Medication Item */}
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Morning Medication
                      </h4>
                      <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                        8:15 AM
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Metformin 500mg & Vitamin D3
                    </p>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Confirmed by Caregiver Maria</span>
                    </div>
                  </div>
                </div>

                {/* Appointment Item */}
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-xs">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Cardiology Checkup
                      </h4>
                      <span className="text-[11px] font-medium text-sky-700 dark:text-sky-400">
                        Today 2:30 PM
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Dr. Richard Miller • City Heart Clinic
                    </p>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <Users2 className="h-3 w-3" />
                      <span>Accompanied by Son James</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status footer inside mockup */}
              <div className="mt-5 rounded-xl bg-teal-50/80 p-3 text-center dark:bg-teal-950/40">
                <p className="text-xs font-medium text-teal-800 dark:text-teal-300">
                  All today&apos;s scheduled care items are up to date
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
