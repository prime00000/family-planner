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
import { generateInitialPlan, refinePlan, savePlan, startPlanningDialogue, approvePlanningApproach } from './lib/ai-service'
import { supabase } from '@/lib/supabase'
import { ApproachDialogue } from '../components/ApproachDialogue'
import { SelectionReview } from '../components/SelectionReview'
import { AssignmentReview } from '../components/AssignmentReview'
import type { DialoguePhase } from '@/lib/planning/agents/types'
import type { 
  SelectionReviewData, 
  AssignmentReviewData,
  SelectionManualAdjustments,
  AssignmentManualAdjustments 
} from '@/lib/planning/agents/review-types'
import type { VibePlanFile, ConversationExchange } from './types'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function Phase3PlanningPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading, isAdmin } = useAuth()
  const { phase, setPhase } = usePlanningStore()
  const { toast } = useToast()
  
  // Edit mode state
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)
  const [showEditWarning, setShowEditWarning] = useState(false)
  
  // Local state for Phase 3
  const [priorityGuidance, setPriorityGuidance] = useState('')
  const [skipPriority, setSkipPriority] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<VibePlanFile | null>(null)
  const [planVersion, setPlanVersion] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [conversation, setConversation] = useState<ConversationExchange[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [planTitle, setPlanTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  
  // New state for dialogue flow
  const [dialoguePhase, setDialoguePhase] = useState<DialoguePhase | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [planningData, setPlanningData] = useState<any>(null)
  
  // Review state
  const [showSelectionReview, setShowSelectionReview] = useState(false)
  const [selectionReviewData, setSelectionReviewData] = useState<SelectionReviewData | null>(null)
  const [showAssignmentReview, setShowAssignmentReview] = useState(false)
  const [assignmentReviewData, setAssignmentReviewData] = useState<AssignmentReviewData | null>(null)
  
  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/')
    }
  }, [authLoading, isAdmin, router])
  
  // Set the new planning system flag in the store and pass skip preferences
  useEffect(() => {
    const { setUseNewPlanningSystem, skipPreferences } = usePlanningStore.getState()
    const useNewSystem = process.env.NEXT_PUBLIC_USE_NEW_PLANNING_SYSTEM === 'true'
    setUseNewPlanningSystem(useNewSystem)
    
    // Pass skip preferences to orchestrator
    if (useNewSystem) {
      import('@/lib/planning/agents/agent-orchestrator').then(({ AgentOrchestrator }) => {
        const orchestrator = AgentOrchestrator.getInstance()
        orchestrator.setSkipPreferences(skipPreferences)
      })
    }
  }, [])

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
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

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
    
    // Update agent progress if using new system
    const { updateAgentProgress, useNewPlanningSystem } = usePlanningStore.getState()
    if (useNewPlanningSystem) {
      updateAgentProgress({
        currentAgent: 'organizing',
        currentPhase: 'dialogue',
        message: 'Analyzing your planning request...',
        percentage: 10
      })
    }
    
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

      // Store planning data for later use
      const data = {
        priorityGuidance: guidance || undefined,
        incompleteTasks: (incompleteTasks || []).map(t => ({
          id: t.id,
          description: t.description,
          importance: t.importance ?? undefined,
          urgency: t.urgency ?? undefined
        })),
        newItems: {
          objectives: (objectives || []).map(o => ({
            id: o.id,
            description: o.description,
            importance: o.importance ?? undefined
          })),
          tasks: (newTasks || []).map(t => ({
            id: t.id,
            description: t.description,
            importance: t.importance ?? undefined,
            urgency: t.urgency ?? undefined
          })),
          maintenance: (maintenance || []).map(m => ({
            id: m.id,
            description: m.description || '',
            frequency: m.frequency ?? undefined
          }))
        },
        teamMembers: transformedMembers
      }
      setPlanningData(data)
      
      // Check if new planning system is enabled
      const useNewSystem = process.env.NEXT_PUBLIC_USE_NEW_PLANNING_SYSTEM === 'true'
      
      if (useNewSystem) {
        // Use new dialogue flow
        console.log('Using new planning system - starting dialogue')
        
        // Update progress while waiting for dialogue
        updateAgentProgress({
          currentAgent: 'organizing',
          currentPhase: 'dialogue',
          message: 'Organizing Agent is analyzing your requirements and context...',
          percentage: 30
        })
        
        const result = await startPlanningDialogue(data)
        console.log('Dialogue result:', result)
        
        // Update progress to complete
        updateAgentProgress({
          currentAgent: 'organizing',
          currentPhase: 'dialogue',
          message: 'Approach proposal ready for review',
          percentage: 100
        })
        
        setDialoguePhase(result.dialoguePhase)
        setSessionId(result.sessionId)
        setIsGenerating(false) // Stop loading once dialogue is received
        // Don't show success toast here - wait for actual plan generation
      } else {
        // Use legacy system
        const plan = await generateInitialPlan(data)
        setCurrentPlan(plan)
        setPlanVersion(1)
        // Set the AI's suggested title
        if (plan.title) {
          setPlanTitle(plan.title)
        }
        
        // Show success toast only for legacy system
        toast({
          title: "Plan generated successfully",
          description: "Your weekly plan has been created.",
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      toast({
        title: "Plan generation failed",
        description: error instanceof Error ? error.message : "Failed to generate plan",
        variant: "destructive",
        duration: 5000,
      })
      setIsGenerating(false)
    }
  }

  const handleRefinement = async (feedback: string) => {
    if (!currentPlan || isProcessing) return
    
    setIsProcessing(true)
    
    // Update agent progress if using new system
    const { updateAgentProgress, useNewPlanningSystem } = usePlanningStore.getState()
    if (useNewPlanningSystem) {
      updateAgentProgress({
        currentAgent: 'organizing',
        currentPhase: 'refinement',
        message: 'Processing your feedback...',
        percentage: 20
      })
    }
    
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
      
      // Show success toast
      toast({
        title: "Plan refined successfully",
        description: "Your plan has been updated based on your feedback.",
        duration: 3000,
      })
    } catch (error) {
      console.error('Error refining plan:', error)
      toast({
        title: "Refinement failed",
        description: error instanceof Error ? error.message : "Failed to refine plan",
        variant: "destructive",
        duration: 5000,
      })
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
    setDialoguePhase(null)
    setSessionId(null)
    setPlanningData(null)
    setShowSelectionReview(false)
    setSelectionReviewData(null)
    setShowAssignmentReview(false)
    setAssignmentReviewData(null)
  }
  
  const handleSelectionReviewApprove = async (adjustments?: SelectionManualAdjustments) => {
    if (!sessionId || !selectionReviewData) return
    
    setIsProcessing(true)
    const { updateAgentProgress } = usePlanningStore.getState()
    
    try {
      // Send review adjustments to backend
      const response = await fetch('/api/planning/v2/review/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          reviewData: selectionReviewData,
          adjustments
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to process selection review')
      }
      
      // Hide review and continue with plan generation
      setShowSelectionReview(false)
      setSelectionReviewData(null)
      
      // Continue plan generation
      updateAgentProgress({
        currentAgent: 'organizing',
        currentPhase: 'assignment',
        message: 'Assigning tasks to team members...',
        percentage: 80
      })
      
      // Call approve again to continue
      await handleApproveApproach(true)
      
    } catch (error) {
      console.error('Error processing selection review:', error)
      toast({
        title: "Review processing failed",
        description: error instanceof Error ? error.message : "Failed to process review",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsProcessing(false)
    }
  }
  
  const handleSelectionReviewSkip = (reason: string) => {
    console.log('Skipping selection review:', reason)
    setShowSelectionReview(false)
    setSelectionReviewData(null)
    
    // Continue with plan generation
    const { updateAgentProgress } = usePlanningStore.getState()
    updateAgentProgress({
      currentAgent: 'organizing',
      currentPhase: 'assignment',
      message: 'Assigning tasks to team members...',
      percentage: 80
    })
    
    // Call approve again to continue
    handleApproveApproach(true)
  }
  
  const handleAssignmentReviewApprove = async (adjustments?: AssignmentManualAdjustments) => {
    if (!sessionId || !assignmentReviewData) return
    
    setIsProcessing(true)
    const { updateAgentProgress } = usePlanningStore.getState()
    
    try {
      // Send review adjustments to backend
      const response = await fetch('/api/planning/v2/review/assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          reviewData: assignmentReviewData,
          adjustments
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to process assignment review')
      }
      
      // Hide review and continue with plan generation
      setShowAssignmentReview(false)
      setAssignmentReviewData(null)
      
      // Continue plan generation
      updateAgentProgress({
        currentAgent: 'editing',
        currentPhase: 'finalizing',
        message: 'Generating final plan...',
        percentage: 95
      })
      
      // Call approve again to continue
      await handleApproveApproach(true)
      
    } catch (error) {
      console.error('Error processing assignment review:', error)
      toast({
        title: "Review processing failed",
        description: error instanceof Error ? error.message : "Failed to process review",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsProcessing(false)
    }
  }
  
  const handleAssignmentReviewSkip = (reason: string) => {
    console.log('Skipping assignment review:', reason)
    setShowAssignmentReview(false)
    setAssignmentReviewData(null)
    
    // Continue with plan generation
    const { updateAgentProgress } = usePlanningStore.getState()
    updateAgentProgress({
      currentAgent: 'editing',
      currentPhase: 'finalizing',
      message: 'Generating final plan...',
      percentage: 95
    })
    
    // Call approve again to continue
    handleApproveApproach(true)
  }
  
  const handleApproveApproach = async (approved: boolean, adjustments?: string) => {
    if (!sessionId || !planningData) return
    
    setIsGenerating(true)
    
    // Update agent progress
    const { updateAgentProgress } = usePlanningStore.getState()
    
    // If adjustments are provided, we need to get a revised approach first
    if (adjustments) {
      updateAgentProgress({
        currentAgent: 'organizing',
        currentPhase: 'dialogue',
        message: 'Revising approach based on your feedback...',
        percentage: 20
      })
      
      try {
        // Call dialogue endpoint again with adjustments and previous approach as context
        const previousApproach = dialoguePhase ? {
          summary: dialoguePhase.proposedApproach.summary,
          priorities: dialoguePhase.proposedApproach.priorities,
          strategy: dialoguePhase.proposedApproach.strategy,
          identifiedTasks: dialoguePhase.identifiedTasks
        } : null
        
        const contextualizedInstructions = `${planningData.priorityGuidance || 'Create a balanced weekly plan for the family'}

PREVIOUS APPROACH:
${previousApproach ? `
Summary: ${previousApproach.summary}
Priorities: ${previousApproach.priorities.join(', ')}
Strategy: ${previousApproach.strategy}
Identified ${previousApproach.identifiedTasks.newItems.length} new tasks and ${previousApproach.identifiedTasks.modificationsNeeded.length} modifications.
` : 'No previous approach available'}

ADJUSTMENTS REQUESTED:
${adjustments}

Please revise the approach based on the above feedback while maintaining the good aspects of the previous approach.`
        
        const revisedData = {
          ...planningData,
          priorityGuidance: contextualizedInstructions
        }
        
        const result = await startPlanningDialogue(revisedData)
        
        updateAgentProgress({
          currentAgent: 'organizing',
          currentPhase: 'dialogue',
          message: 'Revised approach ready for review',
          percentage: 100
        })
        
        // Update the dialogue phase with revised approach
        setDialoguePhase(result.dialoguePhase)
        setSessionId(result.sessionId)
        setIsGenerating(false)
        
        // Don't continue to plan generation - wait for approval of revised approach
        return
      } catch (error) {
        console.error('Error revising approach:', error)
        toast({
          title: "Failed to revise approach",
          description: error instanceof Error ? error.message : "Failed to process adjustments",
          variant: "destructive",
          duration: 5000,
        })
        setIsGenerating(false)
        return
      }
    }
    
    // If no adjustments (direct approval), proceed with plan generation
    updateAgentProgress({
      currentAgent: 'organizing',
      currentPhase: 'execution',
      message: 'Creating detailed planning guides...',
      percentage: 10
    })
    
    try {
      // Simulate progress updates (in production, these would come from the backend)
      const timer1 = setTimeout(() => {
        updateAgentProgress({
          currentAgent: 'editing',
          currentPhase: 'task-creation',
          message: 'Editing Agent is creating and formatting tasks...',
          percentage: 30
        })
      }, 3000)
      
      const timer2 = setTimeout(() => {
        updateAgentProgress({
          currentAgent: 'selection',
          currentPhase: 'optimization',
          message: 'Selection Agent is optimizing task distribution...',
          percentage: 60
        })
      }, 8000)
      
      const timer3 = setTimeout(() => {
        updateAgentProgress({
          currentAgent: 'organizing',
          currentPhase: 'assignment',
          message: 'Finalizing task assignments...',
          percentage: 85
        })
      }, 12000)
      
      const result = await approvePlanningApproach({
        sessionId,
        approved,
        adjustments,
        ...planningData
      })
      
      // Clear timers
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      
      // Check if we need to show a review
      if ('needsSelectionReview' in result && result.needsSelectionReview) {
        console.log('Need selection review', result)
        setSelectionReviewData(result.selectionReviewData)
        setShowSelectionReview(true)
        setIsGenerating(false)
        
        // Update progress to show we're in review
        updateAgentProgress({
          currentAgent: 'selection',
          currentPhase: 'review',
          message: 'Review and adjust task selections',
          percentage: 70
        })
        return
      }
      
      if ('needsAssignmentReview' in result && result.needsAssignmentReview) {
        console.log('Need assignment review', result)
        setAssignmentReviewData(result.assignmentReviewData)
        setShowAssignmentReview(true)
        setIsGenerating(false)
        
        // Update progress to show we're in review
        updateAgentProgress({
          currentAgent: 'organizing',
          currentPhase: 'review',
          message: 'Review and adjust task assignments',
          percentage: 90
        })
        return
      }
      
      // If we get here, we have a final plan
      const plan = result as VibePlanFile
      
      // Final progress update
      updateAgentProgress({
        currentAgent: 'organizing',
        currentPhase: 'complete',
        message: 'Plan generation complete!',
        percentage: 100
      })
      
      setCurrentPlan(plan)
      setPlanVersion(1)
      setDialoguePhase(null)
      // Set the AI's suggested title
      if (plan.title) {
        setPlanTitle(plan.title)
      }
      
      // Clear progress after a moment
      setTimeout(() => {
        updateAgentProgress({})
      }, 1000)
      
      // Show success toast
      toast({
        title: "Plan generated successfully",
        description: "Your weekly plan has been created.",
        duration: 3000,
      })
    } catch (error) {
      console.error('Error approving plan:', error)
      toast({
        title: "Plan generation failed",
        description: error instanceof Error ? error.message : "Failed to generate plan",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsGenerating(false)
    }
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

  // Show loading while generating (show this before dialogue to handle adjustments)
  if (isGenerating) {
    console.log('Still generating, showing loading state')
    return <LoadingState message="AI is creating your weekly plan..." />
  }
  
  // Show dialogue phase if active (after loading check)
  if (dialoguePhase && !currentPlan) {
    console.log('Showing ApproachDialogue with dialoguePhase:', dialoguePhase)
    return (
      <ApproachDialogue
        dialoguePhase={dialoguePhase}
        onApprove={(adjustments) => handleApproveApproach(true, adjustments)}
        onReject={() => handleStartOver()}
        isProcessing={false}  // Don't show processing in the button since we'll show full loading state
      />
    )
  }
  
  // Show selection review if active
  if (showSelectionReview && selectionReviewData) {
    console.log('Showing SelectionReview')
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <SelectionReview
          reviewData={selectionReviewData}
          onApprove={handleSelectionReviewApprove}
          onSkip={handleSelectionReviewSkip}
          isProcessing={isProcessing}
          autoContinueEnabled={false}
        />
      </div>
    )
  }
  
  // Show assignment review if active
  if (showAssignmentReview && assignmentReviewData) {
    console.log('Showing AssignmentReview')
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <AssignmentReview
          reviewData={assignmentReviewData}
          onApprove={handleAssignmentReviewApprove}
          onSkip={handleAssignmentReviewSkip}
          isProcessing={isProcessing}
          autoContinueEnabled={false}
        />
      </div>
    )
  }
  
  console.log('Current state:', {
    dialoguePhase,
    currentPlan,
    isGenerating,
    skipPriority
  })

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