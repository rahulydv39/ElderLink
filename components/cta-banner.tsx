import Link from "next/link"
import { ArrowRight, HeartHandshake } from "lucide-react"

export function CtaBanner() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-teal-800 to-sky-900 px-6 py-12 text-center text-white shadow-xl sm:px-12 md:py-16">
          {/* Subtle decoration */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-500/20 blur-2xl" />

          <div className="relative mx-auto max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur text-teal-100">
              <HeartHandshake className="h-4 w-4" />
              <span>Start Your Family Care Circle</span>
            </div>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Give your loved ones the attentive care they deserve.
            </h2>

            <p className="mt-4 text-base text-teal-100 sm:text-lg">
              Set up a circle in less than two minutes. Invite family members,
              add daily prescriptions, and stay coordinated seamlessly.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-teal-900 shadow-md transition-all hover:bg-teal-50 active:scale-[0.98]"
              >
                <span>Create a Free Care Circle</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/20"
              >
                Sign In Existing Member
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
