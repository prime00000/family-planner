'use client'

import { useAgentProgress } from '@/hooks/useAgentProgress'
import { generateInitialPlan } from '@/app/admin/planning/phase3/lib/ai-service'

// Example of how to use agent progress updates in your planning flow
export function AgentProgressExample() {
  const { setProgress, clearProgress } = useAgentProgress()
  
  const handleGeneratePlan = async () => {
    try {
      // Phase 1: Organizing Agent - Dialogue
      setProgress('organizing', 'dialogue', 'dialogue', 10)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Phase 2: Organizing Agent - Execution
      setProgress('organizing', 'execution', 'execution', 30)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Phase 3: Selection Agent
      setProgress('selection', 'analysis', 'analyzing', 50)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setProgress('selection', 'optimization', 'optimizing', 70)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Phase 4: Editing Agent
      setProgress('editing', 'generation', 'generating', 90)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setProgress('editing', 'finalization', 'finalizing', 100)
      
      // Clear progress after completion
      setTimeout(clearProgress, 2000)
      
    } catch (error) {
      console.error('Error in planning flow:', error)
      clearProgress()
    }
  }
  
  return null // This is just an example component
}

// Example integration with actual API calls
export async function generatePlanWithProgress(params: any) {
  const { setProgress } = useAgentProgress.getState()
  
  try {
    // Start with organizing agent
    setProgress('organizing', 'analysis', 'dialogue', 10)
    
    const result = await generateInitialPlan(params)
    
    // Update to show completion
    setProgress('editing', 'complete', 'finalizing', 100)
    
    return result
  } catch (error) {
    throw error
  }
}