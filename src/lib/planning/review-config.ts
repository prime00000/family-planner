import type { ReviewCheckpointConfig } from './agents/review-types'

/**
 * Default configuration for Layer 2 review checkpoints
 */
export const defaultReviewConfig: ReviewCheckpointConfig = {
  // Global enable/disable
  enabled: true,
  
  // Default preferences for skip behavior
  defaultPreferences: {
    // Selection review skip settings
    skipSelectionReview: false,
    selectionSkipConditions: {
      maxTasks: 20, // Skip if fewer than 20 tasks selected
      minCapacityUtilization: 70, // Skip if utilization > 70%
      noWarnings: true // Skip if no warnings from SA
    },
    
    // Assignment review skip settings
    skipAssignmentReview: false,
    assignmentSkipConditions: {
      balancedWorkload: true, // Skip if workload variance < 20%
      noOverload: true, // Skip if no one has > 85% capacity
      noWarnings: true // Skip if no warnings from OA
    },
    
    // Auto-continue behavior
    autoContinue: {
      enabled: false, // Disabled by default for safety
      delaySeconds: 10, // 10 second countdown
      pauseOnWarnings: true // Always pause if warnings present
    },
    
    // When to force showing reviews
    reEnableConditions: {
      afterErrors: true, // Always show after errors
      afterMajorChanges: true, // Show if > 30% changes
      everyNthRun: 5, // Show every 5th run regardless
      onDemand: true // User can always request
    }
  },
  
  // Checkpoint-specific settings
  checkpoints: {
    selection: {
      enabled: true,
      showMetrics: true, // Show utilization, priority distribution
      allowAICommands: true // Enable AI-powered adjustments
    },
    assignment: {
      enabled: true,
      showCalendarView: true, // Enable week calendar view
      allowDragDrop: true, // Enable drag-drop reassignment
      allowAICommands: true // Enable AI-powered rebalancing
    }
  }
}

/**
 * Helper to check if a checkpoint should be skipped
 */
export function shouldSkipCheckpoint(
  type: 'selection' | 'assignment',
  data: any,
  preferences: any,
  runCount: number
): { skip: boolean; reason?: string } {
  // Check re-enable conditions first
  if (runCount % preferences.reEnableConditions.everyNthRun === 0) {
    return { skip: false, reason: 'Periodic review required' }
  }
  
  if (type === 'selection') {
    if (!preferences.skipSelectionReview) {
      return { skip: false }
    }
    
    const conditions = preferences.selectionSkipConditions
    
    // Check task count
    if (data.metrics.totalTasksSelected > conditions.maxTasks) {
      return { skip: false, reason: 'Too many tasks selected' }
    }
    
    // Check capacity utilization
    if (data.metrics.capacityUtilization < conditions.minCapacityUtilization) {
      return { skip: false, reason: 'Low capacity utilization' }
    }
    
    // Check warnings
    if (conditions.noWarnings && data.warnings?.length > 0) {
      return { skip: false, reason: 'Warnings present' }
    }
    
    return { skip: true, reason: 'All skip conditions met' }
  }
  
  if (type === 'assignment') {
    if (!preferences.skipAssignmentReview) {
      return { skip: false }
    }
    
    const conditions = preferences.assignmentSkipConditions
    
    // Check workload balance
    if (conditions.balancedWorkload) {
      const workloads = Object.values(data.assignmentsByPerson).map((p: any) => p.totalTasks)
      const avg = workloads.reduce((a, b) => a + b, 0) / workloads.length
      const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / workloads.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = stdDev / avg
      
      if (coefficientOfVariation > 0.2) {
        return { skip: false, reason: 'Unbalanced workload distribution' }
      }
    }
    
    // Check for overload
    if (conditions.noOverload) {
      const hasOverload = Object.values(data.assignmentsByPerson).some(
        (p: any) => p.workloadRating === 'overloaded'
      )
      if (hasOverload) {
        return { skip: false, reason: 'Team member overloaded' }
      }
    }
    
    // Check warnings
    if (conditions.noWarnings && data.warnings?.length > 0) {
      return { skip: false, reason: 'Warnings present' }
    }
    
    return { skip: true, reason: 'All skip conditions met' }
  }
  
  return { skip: false }
}

/**
 * AI command examples for each checkpoint type
 */
export const AI_COMMAND_EXAMPLES = {
  selection: [
    "Add all homework tasks",
    "Remove low priority maintenance",
    "Prioritize tasks with deadlines",
    "Balance between urgent and important",
    "Add tasks for Benjamin and Eliana only",
    "Focus on outdoor activities"
  ],
  assignment: [
    "Give Kurt more technical tasks",
    "Balance Jessica's Monday workload",
    "Move all homework to early week",
    "Spread Barb's tasks across the week",
    "No tasks for kids on Wednesday",
    "Compress everything into 3 days"
  ]
}

/**
 * Review checkpoint event types for analytics
 */
export const REVIEW_EVENT_TYPES = {
  CHECKPOINT_STARTED: 'review.checkpoint.started',
  CHECKPOINT_COMPLETED: 'review.checkpoint.completed',
  CHECKPOINT_SKIPPED: 'review.checkpoint.skipped',
  MANUAL_ADJUSTMENT: 'review.manual.adjustment',
  AI_COMMAND_EXECUTED: 'review.ai.command',
  AUTO_CONTINUE_PAUSED: 'review.auto.paused',
  AUTO_CONTINUE_RESUMED: 'review.auto.resumed',
  PREFERENCES_UPDATED: 'review.preferences.updated'
}