import { create } from 'zustand'
import { PLANNING_PHASES } from '@/lib/constants'
import type { OrganizingAgentDialogueOutput } from '@/lib/planning/agents/types'
import type { 
  ReviewSession, 
  ReviewCheckpointState, 
  SkipPreferences,
  ReviewAction,
  ReviewUIState 
} from '@/lib/planning/agents/review-types'

export type PlanningPhase = typeof PLANNING_PHASES[keyof typeof PLANNING_PHASES]

interface ReviewedItem {
  id: string
  type: 'objective' | 'task' | 'maintenance'
  adjustments?: {
    importance?: number
    urgency?: number
    tags?: string[]
    status?: string
  }
}

interface NewItemsData {
  reviewedItems: ReviewedItem[]
  adjustmentsMade: number
  decisionsLog: string[]
}

interface VibePlanData {
  selectedDays: string[]
  vibeNotes: string
  energyLevel: number
}

// New dialogue-related interfaces
interface DialogueState {
  isActive: boolean
  sessionId?: string
  proposedApproach?: OrganizingAgentDialogueOutput['proposedApproach']
  identifiedTasks?: OrganizingAgentDialogueOutput['identifiedTasks']
  needsClarification: boolean
  adminFeedback?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'adjusted'
  adjustments?: string
}

interface AgentProgress {
  currentAgent?: 'organizing' | 'selection' | 'editing'
  currentPhase?: string
  message?: string
  percentage?: number
}

interface PlanningState {
  phase: PlanningPhase
  phaseData: {
    past_week?: {
      completedCount: number
      incompleteCount: number
    }
    new_items?: NewItemsData
    vibe_plan?: VibePlanData
  }
  // New dialogue state
  dialogueState: DialogueState
  agentProgress: AgentProgress
  useNewPlanningSystem: boolean
  
  // Layer 2: Review checkpoint state
  reviewSession: ReviewSession | null
  reviewUIState: ReviewUIState
  skipPreferences: SkipPreferences
  
  // Existing actions
  setPhase: (phase: PlanningPhase) => void
  updatePhaseData: <T extends keyof PlanningState['phaseData']>(
    phase: T,
    data: Partial<NonNullable<PlanningState['phaseData'][T]>>
  ) => void
  setNewItemsData: (data: NewItemsData) => void
  addReviewedItem: (item: ReviewedItem) => void
  addDecisionLog: (log: string) => void
  
  // New dialogue actions
  startDialogue: (sessionId: string, adminInstructions: string) => void
  setProposedApproach: (approach: OrganizingAgentDialogueOutput) => void
  provideAdminFeedback: (feedback: string) => void
  approveApproach: (adjustments?: string) => void
  rejectApproach: () => void
  clearDialogue: () => void
  updateAgentProgress: (progress: AgentProgress) => void
  setUseNewPlanningSystem: (use: boolean) => void
  
  // Layer 2: Review checkpoint actions
  startReviewSession: (planningSessionId: string) => void
  updateReviewCheckpoint: (checkpoint: ReviewCheckpointState) => void
  processReviewAction: (action: ReviewAction) => void
  updateReviewUIState: (updates: Partial<ReviewUIState>) => void
  updateSkipPreferences: (preferences: Partial<SkipPreferences>) => void
  completeReviewCheckpoint: (type: 'selection' | 'assignment') => void
  skipReviewCheckpoint: (type: 'selection' | 'assignment', reason: string) => void
}

// Default skip preferences
const defaultSkipPreferences: SkipPreferences = {
  skipSelectionReview: false,
  selectionSkipConditions: {
    maxTasks: 20,
    minCapacityUtilization: 70,
    noWarnings: true
  },
  skipAssignmentReview: false,
  assignmentSkipConditions: {
    balancedWorkload: true,
    noOverload: true,
    noWarnings: true
  },
  autoContinue: {
    enabled: false,
    delaySeconds: 30,
    pauseOnWarnings: true
  },
  reEnableConditions: {
    afterErrors: true,
    afterMajorChanges: true,
    everyNthRun: 5,
    onDemand: true
  }
}

// Default review UI state
const defaultReviewUIState: ReviewUIState = {
  activeView: 'grid',
  filters: {},
  selectedTasks: new Set(),
  aiCommand: {
    isOpen: false,
    value: '',
    isProcessing: false,
    history: []
  }
}

// Initialize preferences on store creation
const initializePreferences = async () => {
  try {
    const response = await fetch('/api/planning/v2/preferences')
    if (response.ok) {
      const { preferences } = await response.json()
      if (preferences) {
        usePlanningStore.setState({ skipPreferences: preferences })
      }
    }
  } catch (error) {
    console.error('Failed to load planning preferences:', error)
  }
}

export const usePlanningStore = create<PlanningState>((set) => ({
  phase: PLANNING_PHASES.PAST_WEEK,
  phaseData: {},
  
  // Initialize dialogue state
  dialogueState: {
    isActive: false,
    needsClarification: false
  },
  agentProgress: {},
  useNewPlanningSystem: false,
  
  // Initialize review state
  reviewSession: null,
  reviewUIState: defaultReviewUIState,
  skipPreferences: defaultSkipPreferences,
  
  // Existing actions
  setPhase: (phase) => set({ phase }),
  
  updatePhaseData: (phase, data) => set((state) => ({
    phaseData: {
      ...state.phaseData,
      [phase]: {
        ...state.phaseData[phase],
        ...data
      }
    }
  })),

  setNewItemsData: (data) => set((state) => ({
    phaseData: {
      ...state.phaseData,
      new_items: data
    }
  })),

  addReviewedItem: (item) => set((state) => {
    const currentData = state.phaseData.new_items || {
      reviewedItems: [],
      adjustmentsMade: 0,
      decisionsLog: []
    }
    
    return {
      phaseData: {
        ...state.phaseData,
        new_items: {
          ...currentData,
          reviewedItems: [...currentData.reviewedItems, item]
        }
      }
    }
  }),

  addDecisionLog: (log) => set((state) => {
    const currentData = state.phaseData.new_items || {
      reviewedItems: [],
      adjustmentsMade: 0,
      decisionsLog: []
    }
    
    return {
      phaseData: {
        ...state.phaseData,
        new_items: {
          ...currentData,
          decisionsLog: [...currentData.decisionsLog, log]
        }
      }
    }
  }),
  
  // New dialogue actions
  startDialogue: (sessionId, adminInstructions) => set({
    dialogueState: {
      isActive: true,
      sessionId,
      needsClarification: false,
      approvalStatus: 'pending',
      adminFeedback: adminInstructions
    },
    agentProgress: {
      currentAgent: 'organizing',
      currentPhase: 'dialogue',
      message: 'Analyzing your planning request...',
      percentage: 10
    }
  }),
  
  setProposedApproach: (approach) => set((state) => ({
    dialogueState: {
      ...state.dialogueState,
      proposedApproach: approach.proposedApproach,
      identifiedTasks: approach.identifiedTasks,
      needsClarification: approach.needsClarification
    },
    agentProgress: {
      currentAgent: 'organizing',
      currentPhase: 'dialogue',
      message: 'Proposed approach ready for your review',
      percentage: 100
    }
  })),
  
  provideAdminFeedback: (feedback) => set((state) => ({
    dialogueState: {
      ...state.dialogueState,
      adminFeedback: feedback
    }
  })),
  
  approveApproach: (adjustments) => set((state) => ({
    dialogueState: {
      ...state.dialogueState,
      approvalStatus: adjustments ? 'adjusted' : 'approved',
      adjustments
    },
    agentProgress: {
      currentAgent: 'organizing',
      currentPhase: 'execution',
      message: 'Executing approved plan...',
      percentage: 0
    }
  })),
  
  rejectApproach: () => set((state) => ({
    dialogueState: {
      ...state.dialogueState,
      approvalStatus: 'rejected'
    },
    agentProgress: {}
  })),
  
  clearDialogue: () => set({
    dialogueState: {
      isActive: false,
      needsClarification: false
    },
    agentProgress: {}
  }),
  
  updateAgentProgress: (progress) => set({ agentProgress: progress }),
  
  setUseNewPlanningSystem: (use) => set({ useNewPlanningSystem: use }),
  
  // Layer 2: Review checkpoint actions
  startReviewSession: (planningSessionId) => set({
    reviewSession: {
      sessionId: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      planningSessionId,
      checkpoints: {},
      metrics: {
        totalReviewTime: 0,
        adjustmentsMade: 0,
        aiCommandsUsed: 0,
        checkpointsSkipped: 0
      },
      preferences: defaultSkipPreferences
    }
  }),
  
  updateReviewCheckpoint: (checkpoint) => set((state) => ({
    reviewSession: state.reviewSession ? {
      ...state.reviewSession,
      checkpoints: {
        ...state.reviewSession.checkpoints,
        [checkpoint.type]: checkpoint
      }
    } : null
  })),
  
  processReviewAction: (action) => set((state) => {
    if (!state.reviewSession) return state
    
    // Update UI state based on action
    const newUIState = { ...state.reviewUIState }
    
    switch (action.type) {
      case 'SELECT_TASK':
        newUIState.selectedTasks = new Set(state.reviewUIState.selectedTasks).add(action.taskId)
        break
      case 'DESELECT_TASK':
        const tasks = new Set(state.reviewUIState.selectedTasks)
        tasks.delete(action.taskId)
        newUIState.selectedTasks = tasks
        break
      case 'APPLY_AI_COMMAND':
        newUIState.aiCommand = {
          ...newUIState.aiCommand,
          value: action.command,
          history: [...newUIState.aiCommand.history, action.command]
        }
        break
      case 'PAUSE_AUTO_CONTINUE':
        // Handle in checkpoint update
        break
    }
    
    // Track metrics
    const metrics = { ...state.reviewSession.metrics }
    if (action.type === 'APPLY_AI_COMMAND') {
      metrics.aiCommandsUsed++
    }
    if (['SELECT_TASK', 'DESELECT_TASK', 'REASSIGN_TASK', 'CHANGE_PRIORITY'].includes(action.type)) {
      metrics.adjustmentsMade++
    }
    
    return {
      reviewUIState: newUIState,
      reviewSession: {
        ...state.reviewSession,
        metrics
      }
    }
  }),
  
  updateReviewUIState: (updates) => set((state) => ({
    reviewUIState: { ...state.reviewUIState, ...updates }
  })),
  
  updateSkipPreferences: (preferences) => set((state) => ({
    skipPreferences: { ...state.skipPreferences, ...preferences },
    reviewSession: state.reviewSession ? {
      ...state.reviewSession,
      preferences: { ...state.reviewSession.preferences, ...preferences }
    } : null
  })),
  
  completeReviewCheckpoint: (type) => set((state) => {
    if (!state.reviewSession?.checkpoints[type]) return state
    
    const checkpoint = state.reviewSession.checkpoints[type]!
    const completedCheckpoint: ReviewCheckpointState = {
      ...checkpoint,
      status: 'approved',
      completedAt: new Date(),
      reviewDuration: checkpoint.startedAt ? Date.now() - checkpoint.startedAt.getTime() : 0
    }
    
    return {
      reviewSession: {
        ...state.reviewSession,
        checkpoints: {
          ...state.reviewSession.checkpoints,
          [type]: completedCheckpoint
        },
        metrics: {
          ...state.reviewSession.metrics,
          totalReviewTime: state.reviewSession.metrics.totalReviewTime + (completedCheckpoint.reviewDuration || 0)
        }
      }
    }
  }),
  
  skipReviewCheckpoint: (type, reason) => set((state) => {
    if (!state.reviewSession) return state
    
    return {
      reviewSession: {
        ...state.reviewSession,
        checkpoints: {
          ...state.reviewSession.checkpoints,
          [type]: {
            type,
            status: 'skipped',
            reviewData: {} as any, // Will be populated when checkpoint is created
            skipped: true,
            skipReason: reason,
            completedAt: new Date(),
            autoContinue: {
              active: false,
              paused: false
            }
          }
        },
        metrics: {
          ...state.reviewSession.metrics,
          checkpointsSkipped: state.reviewSession.metrics.checkpointsSkipped + 1
        }
      }
    }
  })
}))

// Initialize preferences on store load
if (typeof window !== 'undefined') {
  initializePreferences()
} 