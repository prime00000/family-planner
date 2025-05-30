'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/lib/auth/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user && !isLoading) {
      router.replace('/')
    }
  }, [user, isLoading, router])

  // Show nothing while checking auth state
  if (isLoading) {
    return null
  }

  // If not logged in, show login form
  if (!user) {
    return <LoginForm />
  }

  // This will briefly show while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  )
} 