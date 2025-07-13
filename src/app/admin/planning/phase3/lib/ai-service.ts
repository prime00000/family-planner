import type { VibePlanFile, ConversationExchange } from '../types'
import type { DialoguePhase } from '@/lib/planning/agents/types'

interface Task {
  id: string
  description: string
  importance?: number
  urgency?: number
}

interface Objective {
  id: string
  description: string
  importance?: number
}

interface MaintenanceItem {
  id: string
  description: string
  frequency?: string
}

interface TeamMember {
  id: string
  name: string
  email: string
}

export async function generateInitialPlan(params: {
  priorityGuidance?: string
  incompleteTasks: Task[]
  newItems: {
    objectives: Objective[]
    tasks: Task[]
    maintenance: MaintenanceItem[]
  }
  teamMembers: TeamMember[]
}): Promise<VibePlanFile> {
  const response = await fetch('/api/planning/generate-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate plan')
  }

  return response.json()
}

export async function refinePlan(params: {
  currentPlan: VibePlanFile
  feedback: string
  selectedTaskIds?: string[]
  conversationHistory: ConversationExchange[]
}): Promise<{
  updatedPlan: VibePlanFile
  explanation: string
}> {
  const response = await fetch('/api/planning/refine-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to refine plan')
  }

  return response.json()
}

export async function savePlan(params: {
  plan: VibePlanFile
  conversationHistory: ConversationExchange[]
  userId: string
  scheduledActivation?: string | null
  planId?: string | null
}): Promise<{
  success: boolean
  weeklyPlanId: string
  summary: {
    tasksCreated: number
  }
}> {
  const response = await fetch('/api/planning/save-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to save plan')
  }

  return response.json()
}

// New functions for v2 endpoints
export async function startPlanningDialogue(params: {
  priorityGuidance?: string
  incompleteTasks: Task[]
  newItems: {
    objectives: Objective[]
    tasks: Task[]
    maintenance: MaintenanceItem[]
  }
  teamMembers: TeamMember[]
}): Promise<{
  dialoguePhase: DialoguePhase
  sessionId: string
}> {
  // Transform priorityGuidance to adminInstructions for the API
  const apiParams = {
    adminInstructions: params.priorityGuidance || 'Create a balanced weekly plan for the family',
    incompleteTasks: params.incompleteTasks,
    newItems: params.newItems,
    teamMembers: params.teamMembers
  }
  
  const response = await fetch('/api/planning/v2/dialogue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiParams),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to start planning dialogue')
  }

  return response.json()
}

export async function approvePlanningApproach(params: {
  sessionId: string
  approved: boolean
  adjustments?: string
  priorityGuidance?: string
  incompleteTasks: Task[]
  newItems: {
    objectives: Objective[]
    tasks: Task[]
    maintenance: MaintenanceItem[]
  }
  teamMembers: TeamMember[]
}): Promise<VibePlanFile | {
  needsSelectionReview?: boolean
  selectionReviewData?: any
  needsAssignmentReview?: boolean
  assignmentReviewData?: any
  sessionId?: string
}> {
  // Transform parameters for the API
  const apiParams = {
    sessionId: params.sessionId,
    approved: params.approved,
    adjustments: params.adjustments,
    adminInstructions: params.priorityGuidance || 'Create a balanced weekly plan for the family',
    incompleteTasks: params.incompleteTasks,
    newItems: params.newItems,
    teamMembers: params.teamMembers
  }
  
  const response = await fetch('/api/planning/v2/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiParams),
  })

  if (!response.ok) {
    let errorMessage = 'Failed to approve planning approach'
    try {
      const error = await response.json()
      errorMessage = error.error || errorMessage
    } catch (e) {
      // If response isn't JSON, try to get text
      try {
        const errorText = await response.text()
        errorMessage = errorText || `HTTP ${response.status} error`
      } catch {
        errorMessage = `HTTP ${response.status} error`
      }
    }
    throw new Error(errorMessage)
  }

  try {
    return await response.json()
  } catch (error) {
    console.error('Failed to parse response as JSON:', error)
    throw new Error('Invalid JSON in AI response')
  }
}