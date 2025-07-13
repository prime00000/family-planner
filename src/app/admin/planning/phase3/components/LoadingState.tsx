'use client'

import { AgentLoadingState } from '@/app/admin/planning/components/AgentLoadingState'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  // Use the new agent-aware loading state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <AgentLoadingState fallbackMessage={message} showProgress={true} />
    </div>
  )
}