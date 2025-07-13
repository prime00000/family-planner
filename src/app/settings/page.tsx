'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TagManagement } from './components/TagManagement'

export default function SettingsPage() {
  const { isLoading, isAdmin } = useAuth()
  const [activeSection, setActiveSection] = useState('tags')

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      redirect('/')
    }
  }, [isLoading, isAdmin])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/'}
              className="text-gray-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Section Tabs */}
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveSection('tags')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeSection === 'tags'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Tags
              </button>
              {/* Add more sections here as needed */}
            </nav>
          </div>

          {/* Section Content */}
          <div className="p-6">
            {activeSection === 'tags' && <TagManagement />}
            {/* Add more sections here as needed */}
          </div>
        </div>
      </main>
    </div>
  )
}