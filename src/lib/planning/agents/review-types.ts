import type { Task, TeamMember } from './types'

/**
 * Layer 2: Review Checkpoints Type Definitions
 * Supports manual and AI-powered adjustments at key decision points
 */

// ============================================
// Selection Review Types (Post-Selection Agent)
// ============================================

/**
 * Data structure for reviewing Selection Agent's task selections
 */
export interface SelectionReviewData {
  // Original selections by the SA
  selectedTasks: {
    task: Task
    selectionReason: string
    priority: 'high' | 'medium' | 'low'
    estimatedHours: number
  }[]
  
  // Tasks that were considered but not selected
  deselectedTasks: {
    task: Task
    deselectionReason: string
  }[]
  
  // Overall selection metrics
  metrics: {
    totalTasksSelected: number
    totalEstimatedHours: number
    capacityUtilization: number // percentage
    priorityDistribution: {
      high: number
      medium: number
      low: number
    }
  }
  
  // SA's reasoning summary
  selectionSummary: string
  
  // Warnings or concerns from SA
  warnings?: string[]
}

/**
 * Manual adjustments to selection
 */
export interface SelectionManualAdjustments {
  // Tasks to add (checked by admin)
  addedTaskIds: string[]
  
  // Tasks to remove (unchecked by admin)
  removedTaskIds: string[]
  
  // Priority overrides
  priorityOverrides: Record<string, 'high' | 'medium' | 'low'>
  
  // Admin notes
  notes?: string
}

/**
 * AI-powered adjustments to selection
 */
export interface SelectionAIAdjustments {
  // Natural language command from admin
  command: string
  
  // AI's interpretation of the command
  interpretation: {
    action: 'add' | 'remove' | 'reprioritize' | 'rebalance' | 'custom'
    targets: string[] // task IDs or categories
    parameters?: Record<string, any>
  }
  
  // Resulting changes
  changes: {
    addedTaskIds: string[]
    removedTaskIds: string[]
    priorityChanges: Record<string, 'high' | 'medium' | 'low'>
    rebalancingNotes?: string
  }
  
  // AI's explanation of changes
  explanation: string
}

// ============================================
// Assignment Review Types (Post-OA Assignment)
// ============================================

/**
 * Individual task assignment
 */
export interface TaskAssignment {
  taskId: string
  task: Task
  assignedTo: string // user ID
  assignedToName: string
  scheduledFor: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'anytime_this_week' | 'deck'
  assignmentReason: string
  estimatedDuration?: number // in minutes
  scheduledTime?: {
    start: string // HH:MM format
    duration: number // minutes
  }
}

/**
 * Data structure for reviewing OA's task assignments
 */
export interface AssignmentReviewData {
  // Assignments organized by person
  assignmentsByPerson: Record<string, {
    member: TeamMember
    assignments: TaskAssignment[]
    totalTasks: number
    totalEstimatedHours: number
    daysWithTasks: string[]
    workloadRating: 'light' | 'moderate' | 'heavy' | 'overloaded'
  }>
  
  // Assignments organized by day
  assignmentsByDay: Record<string, {
    assignments: TaskAssignment[]
    totalTasks: number
    totalEstimatedHours: number
  }>
  
  // Overall assignment metrics
  metrics: {
    totalAssignments: number
    averageTasksPerPerson: number
    busiestDay: string
    mostLoadedPerson: string
    unassignedTasks: string[] // should be empty
  }
  
  // OA's assignment strategy summary
  assignmentSummary: string
  
  // Warnings about workload or scheduling conflicts
  warnings?: string[]
}

/**
 * Manual adjustments to assignments (drag-drop, etc.)
 */
export interface AssignmentManualAdjustments {
  // Reassignments (task moved to different person/day)
  reassignments: Array<{
    taskId: string
    fromPerson: string
    toPerson: string
    fromDay: string
    toDay: string
    reason?: string
  }>
  
  // Time adjustments
  timeAdjustments: Record<string, {
    start?: string
    duration?: number
  }>
  
  // Tasks moved to deck (deprioritized)
  movedToDeck: string[]
  
  // Admin notes
  notes?: string
}

/**
 * AI-powered adjustments to assignments
 */
export interface AssignmentAIAdjustments {
  // Natural language command
  command: string
  
  // AI's interpretation
  interpretation: {
    action: 'reassign' | 'balance' | 'compress' | 'spread' | 'swap' | 'custom'
    targets: {
      people?: string[]
      days?: string[]
      tasks?: string[]
    }
    constraints?: Record<string, any>
  }
  
  // Resulting changes
  changes: {
    reassignments: Array<{
      taskId: string
      fromPerson: string
      toPerson: string
      fromDay: string
      toDay: string
    }>
    workloadChanges: Record<string, {
      before: number
      after: number
    }>
  }
  
  // AI's explanation
  explanation: string
}

// ============================================
// Review Checkpoint State Management
// ============================================

/**
 * Combined review adjustments
 */
export interface ReviewAdjustments {
  selection?: {
    manual?: SelectionManualAdjustments
    ai?: SelectionAIAdjustments[]
  }
  assignment?: {
    manual?: AssignmentManualAdjustments
    ai?: AssignmentAIAdjustments[]
  }
}

/**
 * Skip preferences for review checkpoints
 */
export interface SkipPreferences {
  // Whether to skip selection review
  skipSelectionReview: boolean
  selectionSkipConditions?: {
    maxTasks?: number // Skip if fewer than X tasks
    minCapacityUtilization?: number // Skip if utilization above X%
    noWarnings?: boolean // Skip if no warnings
  }
  
  // Whether to skip assignment review
  skipAssignmentReview: boolean
  assignmentSkipConditions?: {
    balancedWorkload?: boolean // Skip if workload is balanced
    noOverload?: boolean // Skip if no one is overloaded
    noWarnings?: boolean // Skip if no warnings
  }
  
  // Auto-continue settings
  autoContinue: {
    enabled: boolean
    delaySeconds: number // How long to show review before auto-continuing
    pauseOnWarnings: boolean // Pause auto-continue if warnings present
  }
  
  // Re-enable conditions (when to force showing reviews again)
  reEnableConditions: {
    afterErrors: boolean // Show reviews after any error
    afterMajorChanges: boolean // Show reviews if significant changes detected
    everyNthRun: number // Show reviews every Nth planning run
    onDemand: boolean // User can manually request reviews
  }
}

/**
 * Current state of a review checkpoint
 */
export interface ReviewCheckpointState {
  // Which checkpoint
  type: 'selection' | 'assignment'
  
  // Current status
  status: 'pending' | 'reviewing' | 'approved' | 'adjusted' | 'skipped'
  
  // Review data based on type
  reviewData: SelectionReviewData | AssignmentReviewData
  
  // Any adjustments made
  adjustments?: ReviewAdjustments
  
  // Skip decision
  skipped: boolean
  skipReason?: string
  
  // Timing
  startedAt?: Date
  completedAt?: Date
  reviewDuration?: number // milliseconds
  
  // Auto-continue state
  autoContinue: {
    active: boolean
    remainingSeconds?: number
    paused: boolean
    pauseReason?: string
  }
}

/**
 * Review session tracking
 */
export interface ReviewSession {
  sessionId: string
  planningSessionId: string // Links to main planning session
  
  // Checkpoints in this session
  checkpoints: {
    selection?: ReviewCheckpointState
    assignment?: ReviewCheckpointState
  }
  
  // Overall review metrics
  metrics: {
    totalReviewTime: number
    adjustmentsMade: number
    aiCommandsUsed: number
    checkpointsSkipped: number
  }
  
  // User preferences for this session
  preferences: SkipPreferences
}

// ============================================
// UI Support Types
// ============================================

/**
 * Review action types for UI interactions
 */
export type ReviewAction = 
  | { type: 'SELECT_TASK'; taskId: string }
  | { type: 'DESELECT_TASK'; taskId: string }
  | { type: 'CHANGE_PRIORITY'; taskId: string; priority: 'high' | 'medium' | 'low' }
  | { type: 'REASSIGN_TASK'; taskId: string; toPerson: string; toDay: string }
  | { type: 'MOVE_TO_DECK'; taskId: string }
  | { type: 'APPLY_AI_COMMAND'; command: string }
  | { type: 'APPROVE_REVIEW' }
  | { type: 'SKIP_REVIEW' }
  | { type: 'PAUSE_AUTO_CONTINUE' }
  | { type: 'RESUME_AUTO_CONTINUE' }

/**
 * Review UI state
 */
export interface ReviewUIState {
  // Current view
  activeView: 'grid' | 'list' | 'calendar'
  
  // Filtering/sorting
  filters: {
    person?: string
    day?: string
    priority?: 'high' | 'medium' | 'low'
    showOnlyWarnings?: boolean
  }
  
  // Selection state (for bulk operations)
  selectedTasks: Set<string>
  
  // AI command input
  aiCommand: {
    isOpen: boolean
    value: string
    isProcessing: boolean
    history: string[]
  }
  
  // Drag and drop state
  dragState?: {
    taskId: string
    sourceDay: string
    sourcePerson: string
  }
}

// ============================================
// Integration Types
// ============================================

/**
 * Review checkpoint configuration
 */
export interface ReviewCheckpointConfig {
  // Whether reviews are enabled globally
  enabled: boolean
  
  // Default skip preferences
  defaultPreferences: SkipPreferences
  
  // Checkpoint-specific settings
  checkpoints: {
    selection: {
      enabled: boolean
      showMetrics: boolean
      allowAICommands: boolean
    }
    assignment: {
      enabled: boolean
      showCalendarView: boolean
      allowDragDrop: boolean
      allowAICommands: boolean
    }
  }
}

/**
 * Review event for analytics/logging
 */
export interface ReviewEvent {
  timestamp: Date
  sessionId: string
  checkpointType: 'selection' | 'assignment'
  action: ReviewAction
  metadata?: Record<string, any>
  userId: string
}