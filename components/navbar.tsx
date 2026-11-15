import Link from "next/link"
import { HeartPulse, ArrowRight } from "lucide-react"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
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

        <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Link href="#features" className="hover:text-teal-600 transition-colors">
            Features
          </Link>
          <Link href="#how-it-works" className="hover:text-teal-600 transition-colors">
            How It Works
          </Link>
          <Link href="#care-circle" className="hover:text-teal-600 transition-colors">
            Care Circle
          </Link>
          <Link href="#about" className="hover:text-teal-600 transition-colors">
            About
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            <span>Get Started</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  )
}
