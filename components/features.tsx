import {
  Pill,
  Users,
  CalendarCheck,
  CheckCircle,
  Shield,
} from "lucide-react"

export function Features() {
  const features = [
    {
      id: "medication-management",
      title: "Medication Management",
      badge: "Zero Missed Doses",
      badgeColor: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
      iconBg: "bg-teal-600 text-white",
      description:
        "Comprehensive prescription tracking with personalized dosage schedules, reminder alerts, and refill prompts to ensure adherence without confusion.",
      points: [
        "Visual pill identifiers and clear dosage timing",
        "Refill alerts before prescriptions run empty",
        "Double-verification logs for family peace of mind",
      ],
      icon: Pill,
      footerNote: "Automated schedule sync across all devices",
    },
    {
      id: "family-care-circle",
      title: "Family Care Circle",
      badge: "Collaborative Support",
      badgeColor: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
      iconBg: "bg-sky-600 text-white",
      description:
        "Connect elderly individuals with adult children, relatives, and professional caretakers in a shared communication hub with customized access levels.",
      points: [
        "Granular roles for seniors, relatives, and nurses",
        "Shared care log with real-time status updates",
        "Immediate emergency contact dispatch system",
      ],
      icon: Users,
      footerNote: "Multi-user coordination without chaotic group chats",
    },
    {
      id: "appointment-tracking",
      title: "Appointment Tracking",
      badge: "Clinical Coordination",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
      iconBg: "bg-emerald-600 text-white",
      description:
        "Coordinate medical visits, specialist consultations, and physical therapy sessions with companion assignments and doctor visit notes.",
      points: [
        "Synchronized family calendar with ride coordination",
        "Pre-visit preparation questions and checklists",
        "Secure storage for consultation summaries and orders",
      ],
      icon: CalendarCheck,
      footerNote: "Calendar integration and ride companion alerts",
    },
  ]

  return (
    <section id="features" className="py-20 bg-slate-50/60 dark:bg-slate-900/40 border-y border-slate-100 dark:border-slate-800/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300">
            <Shield className="h-3.5 w-3.5" />
            <span>Pillars of Care</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Designed for compassionate, coordinated caregiving
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg dark:text-slate-300">
            Three core capabilities engineered to reduce caregiver burnout and protect
            senior health through transparency and simplicity.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs transition-all hover:border-teal-300 hover:shadow-lg hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg} shadow-sm transition-transform group-hover:scale-105`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${feature.badgeColor}`}
                    >
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-white">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {feature.description}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {feature.points.map((point, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    ✦ {feature.footerNote}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
