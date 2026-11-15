'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface LogoutButtonProps {
  className?: string
  variant?: 'outline' | 'ghost' | 'default' | 'destructive'
}

export function LogoutButton({ className, variant = 'outline' }: LogoutButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      setIsLoggingOut(false)
    }
  }

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`inline-flex items-center gap-1.5 rounded-xl font-medium transition-all ${className}`}
    >
      {isLoggingOut ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          <span>Signing out...</span>
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </>
      )}
    </Button>
  )
}
