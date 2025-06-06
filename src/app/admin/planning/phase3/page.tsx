'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { usePlanningStore } from '@/stores/planningStore'
import { PLANNING_PHASES, TEAM_ID } from '@/lib/constants'
import { PriorityPrompt } from './components/PriorityPrompt'
import { PlanDisplay } from './components/PlanDisplay'
import { LoadingState } from './components/LoadingState'
import { DeployDialog } from './components/DeployDialog'
import { generateInitialPlan, refinePlan, savePlan } from './lib/ai-service'
import { supabase } from '@/lib/supabase'
import type { VibePlanFile, ConversationExchange } from './types'

export default function Phase3PlanningPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAdmin } = useAuth()
  const { phase, setPhase } = usePlanningStore()
  
  // Local state for Phase 3
  const [, setPriorityGuidance] = useState('')
  const [skipPriority, setSkipPriority] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<VibePlanFile | null>(null)
  const [, setPlanVersion] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [conversation, setConversation] = useState<ConversationExchange[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  
  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/')
    }
  }, [authLoading, isAdmin, router])

  // Redirect if not in vibe plan phase
  useEffect(() => {
    if (phase !== PLANNING_PHASES.VIBE_PLAN) {
      router.replace('/admin/planning')
    }
  }, [phase, router])

  const handlePrioritySubmit = async (guidance: string | null) => {
    setIsGenerating(true)
    setPriorityGuidance(guidance || '')
    setSkipPriority(true)
    
    try {
      // Fetch incomplete tasks
      const { data: incompleteTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', TEAM_ID)
        .neq('status', 'completed')

      if (tasksError) throw tasksError

      // Fetch new objectives
      const { data: objectives, error: objectivesError } = await supabase
        .from('objectives')
        .select('*')
        .eq('team_id', TEAM_ID)
        .neq('status', 'completed')

      if (objectivesError) throw objectivesError

      // Fetch new tasks (those not yet assigned to a plan)
      const { data: newTasks, error: newTasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', TEAM_ID)
        .is('assignee_id', null)
        .eq('status', 'pending')

      if (newTasksError) throw newTasksError

      // Fetch maintenance items
      const { data: maintenance, error: maintenanceError } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('team_id', TEAM_ID)

      if (maintenanceError) throw maintenanceError

      // Fetch team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('*, users!inner(id, email, full_name)')
        .eq('team_id', TEAM_ID)

      if (teamError) throw teamError

      // Transform data for API
      const transformedMembers = teamMembers.map(member => ({
        id: member.user_id,
        name: member.display_name || member.users.full_name || member.users.email.split('@')[0],
        email: member.users.email
      }))

      const plan = await generateInitialPlan({
        priorityGuidance: guidance || undefined,
        incompleteTasks: incompleteTasks || [],
        newItems: {
          objectives: objectives || [],
          tasks: newTasks || [],
          maintenance: maintenance || []
        },
        teamMembers: transformedMembers
      })
      
      setCurrentPlan(plan)
      setPlanVersion(1)
    } catch (error) {
      console.error('Error generating plan:', error)
      // TODO: Show error toast
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRefinement = async (feedback: string) => {
    if (!currentPlan || isProcessing) return
    
    setIsProcessing(true)
    
    try {
      const result = await refinePlan({
        currentPlan,
        feedback,
        selectedTaskIds: selectedTaskIds.size > 0 ? Array.from(selectedTaskIds) : undefined,
        conversationHistory: conversation
      })
      
      setCurrentPlan(result.updatedPlan)
      setPlanVersion(v => v + 1)
      setConversation([...conversation, {
        userMessage: feedback,
        aiResponse: result.explanation,
        timestamp: new Date().toISOString()
      }])
      setSelectedTaskIds(new Set()) // Clear selections after refinement
    } catch (error) {
      console.error('Error refining plan:', error)
      // TODO: Show error toast
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeploy = async () => {
    if (!currentPlan) return
    setShowDeployDialog(true)
  }

  const handleStartOver = () => {
    setCurrentPlan(null)
    setPlanVersion(0)
    setSkipPriority(false)
    setPriorityGuidance('')
    setConversation([])
    setSelectedTaskIds(new Set())
  }

  // Show loading state while checking auth
  if (authLoading || phase !== PLANNING_PHASES.VIBE_PLAN) {
    return <LoadingState />
  }

  // Don't render for non-admins
  if (!isAdmin) {
    return <LoadingState />
  }

  // Show priority prompt if not skipped
  if (!skipPriority && !currentPlan) {
    return (
      <PriorityPrompt
        onSubmit={handlePrioritySubmit}
        onBack={() => setPhase(PLANNING_PHASES.NEW_ITEMS)}
      />
    )
  }

  // Show loading while generating
  if (isGenerating) {
    return <LoadingState message="AI is creating your weekly plan..." />
  }

  // Show plan display
  if (currentPlan) {
    return (
      <>
        <PlanDisplay
          plan={currentPlan}
          selectedTaskIds={selectedTaskIds}
          onSelectionChange={setSelectedTaskIds}
          onRefinement={handleRefinement}
          onApprove={handleDeploy}
          onStartOver={handleStartOver}
          isProcessing={isProcessing}
          conversation={conversation}
        />
        
        {showDeployDialog && (
          <DeployDialog
            plan={currentPlan}
            onClose={() => setShowDeployDialog(false)}
            onDeploy={async () => {
              if (!user) {
                console.error('No user found')
                return
              }
              
              try {
                const result = await savePlan({
                  plan: currentPlan,
                  conversationHistory: conversation,
                  userId: user.id
                })
                
                if (result.success) {
                  console.log('Plan saved successfully:', result.summary)
                  router.push('/admin/planning')
                }
              } catch (error) {
                console.error('Error deploying plan:', error)
                // TODO: Show error toast
              }
            }}
          />
        )}
      </>
    )
  }

  return <LoadingState />
}