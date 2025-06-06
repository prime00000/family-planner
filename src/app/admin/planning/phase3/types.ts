export interface TaskAssignment {
  id: string
  description: string
  importance: number
  urgency: number
  tags: string[]
  
  // Time-specific fields (optional)
  scheduledTime?: {
    start?: string     // "14:00" format
    end?: string       // "16:00" format
    duration?: number  // minutes
  }
  
  // UI state
  selected?: boolean
  source: 'task' | 'objective' | 'maintenance'
}

export interface VibePlanFile {
  title?: string
  assignments: {
    [userId: string]: {
      user_name: string
      monday: TaskAssignment[]
      tuesday: TaskAssignment[]
      wednesday: TaskAssignment[]
      thursday: TaskAssignment[]
      friday: TaskAssignment[]
      saturday: TaskAssignment[]
      sunday: TaskAssignment[]
      anytime_this_week: TaskAssignment[]
      deck: TaskAssignment[]
    }
  }
  metadata: {
    priorityGuidance?: string
    generatedAt: string
    version: number
  }
  statistics: {
    total_tasks: number
    tasks_per_person: { [userId: string]: number }
    high_priority_count: number
    scheduled_tasks_count: number
  }
}

export interface ConversationExchange {
  userMessage: string
  aiResponse: string
  timestamp: string
}

export interface DeploymentPreview {
  tasksToArchive: number
  tasksToBacklog: number
  tasksToCreate: number
  weekStartDate: string
}