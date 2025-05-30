'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

const PUBLIC_PATHS = ['/login']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      const isPublicPath = PUBLIC_PATHS.includes(pathname)

      if (!user && !isPublicPath) {
        // Redirect to login if trying to access protected route while not authenticated
        router.replace('/login')
      }
    }
  }, [user, isLoading, pathname, router])

  // Show nothing while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return <>{children}</>
} 