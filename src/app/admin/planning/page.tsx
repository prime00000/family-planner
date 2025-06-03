'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { usePlanningStore } from '@/stores/planningStore'
import { PastWeekReview } from '@/components/planning/PastWeekReview'
import NewItemsReview from '@/app/admin/planning/new-items/page'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { PLANNING_PHASES } from '@/lib/constants'

const phases = [
  { id: PLANNING_PHASES.PAST_WEEK, label: 'Review Last Week' },
  { id: PLANNING_PHASES.NEW_ITEMS, label: 'New Items' },
  { id: PLANNING_PHASES.VIBE_PLAN, label: 'Plan Week' },
] as const

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-2 sm:px-4 py-4 sm:py-6">
        <div className="bg-white rounded-lg shadow animate-pulse">
          <div className="px-3 py-4 sm:px-4 border-b border-gray-200">
            <div className="h-6 w-48 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-64 bg-gray-200 rounded" />
          </div>
          <div className="p-3 sm:p-4">
            <div className="space-y-4">
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPlanningPage() {
  const router = useRouter()
  const { isLoading, isAdmin } = useAuth()
  const { phase, setPhase } = usePlanningStore()
  
  console.log('Current phase:', phase)

  // Handle redirect after render
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/')
    }
  }, [isLoading, isAdmin, router])

  // Show loading state while checking auth
  if (isLoading) {
    return <LoadingState />
  }

  // Don't render content for non-admins
  if (!isAdmin) {
    return <LoadingState />
  }

  console.log('Rendering phase component for:', phase)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-0 sm:px-2 py-2 sm:py-4">
        <div className="bg-white shadow">
          {/* Header */}
          <div className="px-3 py-4 sm:px-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">
              Weekly Planning Session
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Review last week and plan the upcoming week
            </p>
          </div>

          {/* Phase Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {phases.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    console.log('Setting phase to:', p.id)
                    setPhase(p.id)
                  }}
                  className={`
                    flex-1 px-2 sm:px-4 py-3 sm:py-4 text-center border-b-2 text-sm font-medium
                    ${phase === p.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {p.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="p-0">
            {phase === PLANNING_PHASES.PAST_WEEK && (
              <>
                <PastWeekReview />
                <div className="px-3 py-4 sm:px-4 border-t border-gray-200">
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setPhase(PLANNING_PHASES.NEW_ITEMS)}
                      className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <span>Next: New Items</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {phase === PLANNING_PHASES.NEW_ITEMS && <NewItemsReview />}

            {phase === PLANNING_PHASES.VIBE_PLAN && (
              <div className="px-3 py-4 sm:px-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Plan Week
                </h2>
                <p className="text-gray-500">Planning content will go here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 