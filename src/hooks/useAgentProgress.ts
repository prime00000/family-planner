import { useCallback } from 'react'
import { usePlanningStore } from '@/stores/planningStore'
import { AGENT_MESSAGES } from '@/app/admin/planning/components/AgentLoadingState'

type AgentType = 'organizing' | 'selection' | 'editing'

export function useAgentProgress() {
  const { updateAgentProgress, useNewPlanningSystem } = usePlanningStore()
  
  const setProgress = useCallback((
    agent: AgentType,
    phase: string,
    messageKey: keyof typeof AGENT_MESSAGES[AgentType],
    percentage?: number
  ) => {
    if (!useNewPlanningSystem) return
    
    const messages = AGENT_MESSAGES[agent] as Record<string, string>
    const message = messages[messageKey as string] || 'Processing...'
    
    updateAgentProgress({
      currentAgent: agent,
      currentPhase: phase,
      message,
      percentage
    })
  }, [updateAgentProgress, useNewPlanningSystem])
  
  const clearProgress = useCallback(() => {
    updateAgentProgress({})
  }, [updateAgentProgress])
  
  const setCustomProgress = useCallback((
    agent: AgentType,
    phase: string,
    message: string,
    percentage?: number
  ) => {
    if (!useNewPlanningSystem) return
    
    updateAgentProgress({
      currentAgent: agent,
      currentPhase: phase,
      message,
      percentage
    })
  }, [updateAgentProgress, useNewPlanningSystem])
  
  return {
    setProgress,
    clearProgress,
    setCustomProgress,
    isNewSystem: useNewPlanningSystem
  }
}