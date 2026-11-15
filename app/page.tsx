import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { CtaBanner } from "@/components/cta-banner"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-teal-100 selection:text-teal-900">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  )
}
