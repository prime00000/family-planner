'use client'

import React from 'react'
import { Loader2, Brain, Search, Edit3, CheckCircle2 } from 'lucide-react'
import { usePlanningStore } from '@/stores/planningStore'
import { Progress } from '@/components/ui/progress'

interface AgentLoadingStateProps {
  fallbackMessage?: string
  showProgress?: boolean
}

export function AgentLoadingState({ 
  fallbackMessage = 'Processing your request...', 
  showProgress = true 
}: AgentLoadingStateProps) {
  const { agentProgress, useNewPlanningSystem } = usePlanningStore()
  
  // If not using new system, show simple loading
  if (!useNewPlanningSystem || !agentProgress.currentAgent) {
    return <SimpleLoadingState message={fallbackMessage} />
  }

  const getAgentIcon = () => {
    switch (agentProgress.currentAgent) {
      case 'organizing':
        return <Brain className="h-8 w-8 text-purple-600" />
      case 'selection':
        return <Search className="h-8 w-8 text-blue-600" />
      case 'editing':
        return <Edit3 className="h-8 w-8 text-green-600" />
      default:
        return <Loader2 className="h-8 w-8 text-gray-600 animate-spin" />
    }
  }

  const getAgentColor = () => {
    switch (agentProgress.currentAgent) {
      case 'organizing':
        return 'text-purple-600'
      case 'selection':
        return 'text-blue-600'
      case 'editing':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getProgressColor = () => {
    switch (agentProgress.currentAgent) {
      case 'organizing':
        return 'bg-purple-600'
      case 'selection':
        return 'bg-blue-600'
      case 'editing':
        return 'bg-green-600'
      default:
        return 'bg-gray-600'
    }
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Agent Icon with Animation */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-20 h-20 rounded-full ${getProgressColor()} opacity-20 animate-ping`} />
          </div>
          <div className="relative">
            {getAgentIcon()}
          </div>
        </div>

        {/* Agent Name */}
        <div className={`text-lg font-semibold ${getAgentColor()}`}>
          {agentProgress.currentAgent === 'organizing' && 'AI Planning Assistant'}
          {agentProgress.currentAgent === 'selection' && 'Task Optimizer'}
          {agentProgress.currentAgent === 'editing' && 'Plan Finalizer'}
        </div>

        {/* Status Message */}
        <p className="text-gray-700 text-base">
          {agentProgress.message || fallbackMessage}
        </p>

        {/* Progress Bar */}
        {showProgress && agentProgress.percentage !== undefined && (
          <div className="space-y-2">
            <Progress 
              value={agentProgress.percentage} 
              className="h-2"
              indicatorClassName={getProgressColor()}
            />
            <p className="text-sm text-gray-500">
              {agentProgress.percentage}% complete
            </p>
          </div>
        )}

        {/* Phase Details */}
        {agentProgress.currentPhase && (
          <p className="text-sm text-gray-500">
            Phase: {agentProgress.currentPhase}
          </p>
        )}

        {/* Completed Steps Indicator */}
        {agentProgress.currentAgent === 'editing' && agentProgress.percentage === 100 && (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Plan generation complete!</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Simple fallback loading state
function SimpleLoadingState({ message }: { message: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
        <p className="text-gray-700 text-base">{message}</p>
      </div>
    </div>
  )
}

// Export specific loading messages for different operations
export const AGENT_MESSAGES = {
  // Organizing Agent Messages
  organizing: {
    dialogue: 'Analyzing your planning request...',
    proposing: 'Preparing planning approach...',
    execution: 'Creating task guidelines...',
    assignment: 'Distributing tasks to team members...',
  },
  
  // Selection Agent Messages
  selection: {
    analyzing: 'Analyzing available tasks...',
    prioritizing: 'Prioritizing based on your guidance...',
    optimizing: 'Optimizing workload distribution...',
    selecting: 'Selecting optimal tasks for the week...',
  },
  
  // Editing Agent Messages
  editing: {
    creating: 'Creating new tasks...',
    modifying: 'Updating existing tasks...',
    generating: 'Generating your weekly plan...',
    finalizing: 'Finalizing plan details...',
  },
  
  // General Messages
  general: {
    starting: 'Initializing AI planning system...',
    saving: 'Saving your plan...',
    error: 'An error occurred. Please try again.',
  }
}