import type { VibePlanFile, TaskAssignment, ConversationExchange } from '../types'

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