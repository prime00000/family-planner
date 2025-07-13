import type { VibePlanFile, TaskAssignment, ConversationExchange } from '@/app/admin/planning/phase3/types'

// Base types for tasks and objectives
export interface BaseTask {
  id: string
  description: string
  importance?: number
  urgency?: number
  tags?: string[]
}

export interface Objective {
  id: string
  description: string
  importance?: number
}

export interface MaintenanceItem {
  id: string
  description: string
  frequency?: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
}

// Task with additional metadata
export interface TaskWithMetadata extends BaseTask {
  assigned_to?: string | null
  status?: string
  day_assignment?: string
  last_plan_id?: string
  created_at?: string
}

// Plan summary for context
export interface PlanSummary {
  id: string
  week_start_date: string
  title: string
  task_count: number
  completion_rate?: number
}

// Recurring task instance
export interface RecurringTaskInstance {
  id: string
  description: string
  frequency: string
  last_completed_date?: string
  next_due_date?: string
}

// Common agent input/output types
export interface AgentCheckpoint {
  phase: string
  completedSteps: string[]
  partialResults?: any
  timestamp: string
}

// Organizing Agent Types
export interface OrganizingAgentInput {
  sessionId: string
  adminInstructions: string
  planStartDate?: Date
  context: {
    weekStartDate: string
    teamMembers: TeamMember[]
    availableBacklog: TaskWithMetadata[]
    activeObjectives: Objective[]
    precedingPlans: PlanSummary[]
    recurringTasksDue: RecurringTaskInstance[]
  }
  checkpoint?: AgentCheckpoint
  phase?: 'dialogue' | 'execution'
  adminApproval?: {
    approved: boolean
    adjustments?: string
  }
}

export interface PriorityIndicator {
  type: 'focus' | 'avoid' | 'balance'
  target: string
  weight: number
  reasoning?: string
}

export interface NewContentItem {
  type: 'task' | 'objective' | 'maintenance'
  description: string
  metadata?: {
    importance?: number
    urgency?: number
    frequency?: string
    tags?: string[]
  }
}

export interface EditRequest {
  targetId: string
  operation: 'modify' | 'delete' | 'reschedule'
  changes?: Partial<TaskWithMetadata>
  reasoning?: string
}

export interface AssignmentChange {
  taskId: string
  assignTo?: string
  scheduleFor?: string
  reasoning?: string
}

export interface OrganizingAgentDialogueOutput {
  proposedApproach: {
    summary: string
    priorities: string[]
    strategy: string
    questionsForAdmin?: string[]
  }
  identifiedTasks: {
    newItems: NewContentItem[]
    modificationsNeeded: EditRequest[]
    estimatedWorkload: {
      [userId: string]: {
        name: string
        estimatedHours: number
        taskCount: number
      }
    }
  }
  needsClarification: boolean
}

export interface EditingGuide {
  newElements: Array<{
    type: 'task' | 'objective' | 'maintenance'
    description: string
    metadata: any
  }>
  modifications: Array<{
    elementId: string
    changes: any
  }>
  deletions: string[]
}

export interface OrganizingAgentExecutionOutput {
  categorization: {
    priorities: PriorityIndicator[]
    newContent: NewContentItem[]
    editRequests: EditRequest[]
    assignmentChanges: AssignmentChange[]
  }
  editingGuide?: EditingGuide
  selectionCriteria: {
    mustIncludeTasks: string[]
    preferredTasks: string[]
    avoidTasks: string[]
    capacityGuidance: {
      [userId: string]: {
        maxTasks: number
        focusAreas: string[]
      }
    }
  }
  selectionNotes: string[]
  nextPhase: 'editing' | 'selection' | 'assignment' | 'review'
}

export type OrganizingAgentOutput = OrganizingAgentDialogueOutput | OrganizingAgentExecutionOutput

// Selection Agent Types
export interface SelectionAgentInput {
  sessionId: string
  availableTasks: TaskWithMetadata[]
  selectionCriteria: OrganizingAgentExecutionOutput['selectionCriteria']
  priorities: PriorityIndicator[]
  teamCapacity: {
    [userId: string]: {
      name: string
      maxTasks: number
      currentLoad: number
      skills?: string[]
    }
  }
  context: {
    weekStartDate: string
    precedingPlans: PlanSummary[]
  }
}

export interface TaskPriority {
  taskId: string
  score: number
  rationale: string
  suggestedTiming?: string
  suggestedAssignee?: string
}

export interface SelectionReasoning {
  totalAvailable: number
  totalSelected: number
  capacityUtilization: {
    [userId: string]: {
      assigned: number
      capacity: number
      percentage: number
    }
  }
  priorityAlignment: string
  deferralReasons: {
    [taskId: string]: string
  }
}

export interface SelectionAgentOutput {
  selectedTaskIds: string[]
  taskPriorities: Record<string, TaskPriority>
  deferredTaskIds: string[]
  reasoning: SelectionReasoning
  warnings?: string[]
}

// Editing Agent Types
export interface EditingAgentInput {
  sessionId: string
  editingGuide: EditingGuide
  existingTasks: TaskWithMetadata[]
  teamMembers: TeamMember[]
  context: {
    weekStartDate: string
    teamId: string
  }
  operation: 'create' | 'modify' | 'generatePlan'
  planData?: {
    selectedTasks: TaskWithMetadata[]
    assignments: AssignmentChange[]
    title?: string
    metadata?: any
  }
}

export interface CreatedElement {
  tempId: string
  type: 'task' | 'objective' | 'maintenance'
  data: {
    description: string
    importance?: number
    urgency?: number
    frequency?: string
    tags?: string[]
    team_id: string
    submitted_by: string
  }
}

export interface CompletedEdit {
  elementId: string
  changes: Partial<TaskWithMetadata>
  validation: {
    found: boolean
    applied: boolean
    warnings?: string[]
  }
}

export interface CompletedDeletion {
  elementId: string
  validation: {
    found: boolean
    deleted: boolean
  }
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  field?: string
  message: string
}

export interface EditingAgentOutput {
  changes: {
    newElements: CreatedElement[]
    modifications: CompletedEdit[]
    deletions: CompletedDeletion[]
    validationIssues?: ValidationIssue[]
  }
  planJSON?: VibePlanFile
  summary: {
    elementsCreated: number
    elementsModified: number
    elementsDeleted: number
    validationErrors: number
    validationWarnings: number
  }
}

// Agent Orchestrator Types
export interface DialogueState {
  phase: 'initial' | 'clarification' | 'approved'
  approach?: OrganizingAgentDialogueOutput['proposedApproach']
  adminFeedback?: string[]
  iterationCount: number
}

export interface OrchestratorSession {
  sessionId: string
  userId: string
  teamId: string
  startTime: Date
  dialogueState: DialogueState
  executionState?: {
    currentPhase: string
    completedPhases: string[]
    results: {
      organizingResults?: OrganizingAgentExecutionOutput
      editingResults?: EditingAgentOutput
      selectionResults?: SelectionAgentOutput
      finalPlan?: VibePlanFile
    }
  }
}

// Re-export common types for convenience
export type { VibePlanFile, TaskAssignment, ConversationExchange }