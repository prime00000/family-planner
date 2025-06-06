'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function Phase3PlanningPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading, isAdmin } = useAuth()
  const { phase, setPhase } = usePlanningStore()
  
  // Edit mode state
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)
  const [showEditWarning, setShowEditWarning] = useState(false)
  
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
  const [planTitle, setPlanTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  
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

  // Load plan if editing
  useEffect(() => {
    const planId = searchParams.get('edit')
    if (planId && !editPlanId) {
      setEditPlanId(planId)
      loadPlanForEditing(planId)
    }
  }, [searchParams])

  const loadPlanForEditing = async (planId: string) => {
    setIsLoadingPlan(true)
    try {
      const response = await fetch(`/api/planning/load-plan?planId=${planId}`)
      if (!response.ok) {
        throw new Error('Failed to load plan')
      }

      const data = await response.json()
      const { plan } = data

      // Set all the state from the loaded plan
      setCurrentPlan(plan.vibePlan)
      setConversation(plan.conversation || [])
      setPlanTitle(plan.title || '')
      setScheduledDate(plan.scheduledActivation || null)
      setSkipPriority(true) // Skip priority prompt when editing
      setPlanVersion((plan.conversation?.length || 0) + 1)
      
      // Show edit warning
      setShowEditWarning(true)
    } catch (error) {
      console.error('Error loading plan:', error)
      // TODO: Show error toast
      router.push('/admin/planning')
    } finally {
      setIsLoadingPlan(false)
    }
  }

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
      // Set the AI's suggested title
      if (plan.title) {
        setPlanTitle(plan.title)
      }
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
      // Update title if AI provides a new one
      if (result.updatedPlan.title) {
        setPlanTitle(result.updatedPlan.title)
      }
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

  const handleSave = async () => {
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
  if (authLoading || phase !== PLANNING_PHASES.VIBE_PLAN || isLoadingPlan) {
    return <LoadingState />
  }

  // Don't render for non-admins
  if (!isAdmin) {
    return <LoadingState />
  }

  // Show edit warning if editing an existing plan
  if (showEditWarning && editPlanId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-semibold mb-4">Editing Existing Plan</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Warning</p>
                <p>Editing this plan will replace all existing tasks. This action cannot be undone.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/planning')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowEditWarning(false)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Continue Editing
            </Button>
          </div>
        </div>
      </div>
    )
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
          onApprove={handleSave}
          onStartOver={handleStartOver}
          isProcessing={isProcessing}
          conversation={conversation}
        />
        
        {showDeployDialog && (
          <DeployDialog
            plan={currentPlan}
            title={planTitle}
            onTitleChange={setPlanTitle}
            scheduledDate={scheduledDate}
            onScheduledDateChange={setScheduledDate}
            onClose={() => setShowDeployDialog(false)}
            onDeploy={async () => {
              if (!user) {
                console.error('No user found')
                return
              }
              
              if (!planTitle.trim()) {
                console.error('Plan title is required')
                // TODO: Show error toast
                return
              }
              
              try {
                const result = await savePlan({
                  plan: { ...currentPlan, title: planTitle },
                  conversationHistory: conversation,
                  userId: user.id,
                  scheduledActivation: scheduledDate,
                  planId: editPlanId // Pass planId if editing
                })
                
                if (result.success) {
                  console.log('Plan saved successfully:', result.summary)
                  router.push('/admin/planning')
                }
              } catch (error) {
                console.error('Error saving plan:', error)
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