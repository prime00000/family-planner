import type { 
  Task, 
  SelectionAgentOutput, 
  AssignmentResult,
  TeamMember 
} from './agents/types'
import type { 
  SelectionReviewData, 
  AssignmentReviewData,
  TaskAssignment,
  ReviewAdjustments,
  SelectionManualAdjustments,
  AssignmentManualAdjustments
} from './agents/review-types'

/**
 * Transform Selection Agent output into review data
 */
export function transformSelectionForReview(
  selectionOutput: SelectionAgentOutput,
  allTasks: Task[],
  teamMembers: TeamMember[]
): SelectionReviewData {
  const taskMap = new Map(allTasks.map(t => [t.id, t]))
  
  // Calculate total capacity
  const totalCapacity = Object.values(selectionOutput.capacityAnalysis)
    .reduce((sum, member) => sum + member.availableCapacity, 0)
  
  // Calculate actual utilization
  const totalSelected = selectionOutput.selectedTasks.reduce(
    (sum, st) => sum + st.estimatedHours, 0
  )
  const capacityUtilization = Math.round((totalSelected / totalCapacity) * 100)
  
  // Group by priority
  const priorityDistribution = selectionOutput.selectedTasks.reduce(
    (dist, st) => {
      const priority = st.priority as 'high' | 'medium' | 'low'
      dist[priority] = (dist[priority] || 0) + 1
      return dist
    },
    {} as Record<string, number>
  )
  
  // Get deselected tasks
  const selectedIds = new Set(selectionOutput.selectedTaskIds)
  const deselectedTasks = selectionOutput.consideredTasks
    .filter(ct => !selectedIds.has(ct.taskId))
    .map(ct => ({
      task: taskMap.get(ct.taskId)!,
      deselectionReason: ct.selectionReason || 'Not selected due to capacity constraints'
    }))
    .filter(dt => dt.task) // Filter out any missing tasks
  
  return {
    selectedTasks: selectionOutput.selectedTasks.map(st => ({
      task: taskMap.get(st.taskId)!,
      selectionReason: st.reason,
      priority: st.priority as 'high' | 'medium' | 'low',
      estimatedHours: st.estimatedHours
    })).filter(st => st.task),
    
    deselectedTasks,
    
    metrics: {
      totalTasksSelected: selectionOutput.selectedTasks.length,
      totalEstimatedHours: totalSelected,
      capacityUtilization,
      priorityDistribution: {
        high: priorityDistribution.high || 0,
        medium: priorityDistribution.medium || 0,
        low: priorityDistribution.low || 0
      }
    },
    
    selectionSummary: selectionOutput.selectionSummary,
    warnings: selectionOutput.warnings
  }
}

/**
 * Transform Assignment result into review data
 */
export function transformAssignmentForReview(
  assignmentResult: AssignmentResult,
  tasks: Task[],
  teamMembers: TeamMember[]
): AssignmentReviewData {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const memberMap = new Map(teamMembers.map(m => [m.id, m]))
  
  // Build assignments by person
  const assignmentsByPerson: AssignmentReviewData['assignmentsByPerson'] = {}
  const assignmentsByDay: AssignmentReviewData['assignmentsByDay'] = {}
  
  // Initialize structures
  teamMembers.forEach(member => {
    assignmentsByPerson[member.id] = {
      member,
      assignments: [],
      totalTasks: 0,
      totalEstimatedHours: 0,
      daysWithTasks: [],
      workloadRating: 'light'
    }
  })
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'anytime_this_week', 'deck']
  days.forEach(day => {
    assignmentsByDay[day] = {
      assignments: [],
      totalTasks: 0,
      totalEstimatedHours: 0
    }
  })
  
  // Process assignments
  assignmentResult.assignments.forEach(assignment => {
    const task = taskMap.get(assignment.taskId)
    const member = memberMap.get(assignment.assignTo)
    
    if (!task || !member) return
    
    const taskAssignment: TaskAssignment = {
      taskId: assignment.taskId,
      task,
      assignedTo: assignment.assignTo,
      assignedToName: member.name,
      scheduledFor: assignment.scheduleFor as any,
      assignmentReason: assignment.reasoning,
      estimatedDuration: task.estimatedMinutes,
      scheduledTime: assignment.scheduledTime
    }
    
    // Add to person's assignments
    const personData = assignmentsByPerson[assignment.assignTo]
    if (personData) {
      personData.assignments.push(taskAssignment)
      personData.totalTasks++
      personData.totalEstimatedHours += (task.estimatedMinutes || 60) / 60
      if (!personData.daysWithTasks.includes(assignment.scheduleFor)) {
        personData.daysWithTasks.push(assignment.scheduleFor)
      }
    }
    
    // Add to day's assignments
    const dayData = assignmentsByDay[assignment.scheduleFor]
    if (dayData) {
      dayData.assignments.push(taskAssignment)
      dayData.totalTasks++
      dayData.totalEstimatedHours += (task.estimatedMinutes || 60) / 60
    }
  })
  
  // Calculate workload ratings
  Object.values(assignmentsByPerson).forEach(person => {
    const hoursPerDay = person.totalEstimatedHours / (person.daysWithTasks.length || 1)
    if (hoursPerDay < 2) person.workloadRating = 'light'
    else if (hoursPerDay < 4) person.workloadRating = 'moderate'
    else if (hoursPerDay < 6) person.workloadRating = 'heavy'
    else person.workloadRating = 'overloaded'
  })
  
  // Calculate metrics
  const taskCounts = Object.values(assignmentsByPerson).map(p => p.totalTasks)
  const avgTasks = taskCounts.reduce((a, b) => a + b, 0) / taskCounts.length
  
  const dayCounts = Object.entries(assignmentsByDay)
    .filter(([day]) => !['anytime_this_week', 'deck'].includes(day))
    .map(([_, data]) => data.totalTasks)
  const busiestDay = Object.entries(assignmentsByDay)
    .filter(([day]) => !['anytime_this_week', 'deck'].includes(day))
    .sort((a, b) => b[1].totalTasks - a[1].totalTasks)[0]?.[0] || 'monday'
  
  const mostLoadedPerson = Object.entries(assignmentsByPerson)
    .sort((a, b) => b[1].totalTasks - a[1].totalTasks)[0]?.[0] || ''
  
  // Check for warnings
  const warnings: string[] = []
  
  // Check for overloaded members
  Object.entries(assignmentsByPerson).forEach(([id, data]) => {
    if (data.workloadRating === 'overloaded') {
      warnings.push(`${data.member.name} is overloaded with ${data.totalTasks} tasks`)
    }
  })
  
  // Check for unbalanced days
  const maxDayTasks = Math.max(...dayCounts)
  const minDayTasks = Math.min(...dayCounts)
  if (maxDayTasks > minDayTasks * 2) {
    warnings.push('Workload is unbalanced across days')
  }
  
  return {
    assignmentsByPerson,
    assignmentsByDay,
    metrics: {
      totalAssignments: assignmentResult.assignments.length,
      averageTasksPerPerson: avgTasks,
      busiestDay,
      mostLoadedPerson,
      unassignedTasks: [] // Should be empty if OA did its job
    },
    assignmentSummary: assignmentResult.summary?.byPerson 
      ? `Distributed ${assignmentResult.assignments.length} tasks across ${teamMembers.length} team members`
      : 'Tasks assigned based on availability and skills',
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * Apply manual adjustments to selection
 */
export function applySelectionAdjustments(
  reviewData: SelectionReviewData,
  adjustments: SelectionManualAdjustments
): SelectionReviewData {
  const updatedData = { ...reviewData }
  
  // Remove deselected tasks
  updatedData.selectedTasks = updatedData.selectedTasks.filter(
    st => !adjustments.removedTaskIds.includes(st.task.id)
  )
  
  // Add selected tasks from deselected list
  adjustments.addedTaskIds.forEach(taskId => {
    const deselected = updatedData.deselectedTasks.find(dt => dt.task.id === taskId)
    if (deselected) {
      updatedData.selectedTasks.push({
        task: deselected.task,
        selectionReason: 'Manually added by admin',
        priority: adjustments.priorityOverrides[taskId] || 'medium',
        estimatedHours: (deselected.task.estimatedMinutes || 60) / 60
      })
      updatedData.deselectedTasks = updatedData.deselectedTasks.filter(
        dt => dt.task.id !== taskId
      )
    }
  })
  
  // Apply priority overrides
  updatedData.selectedTasks.forEach(st => {
    if (adjustments.priorityOverrides[st.task.id]) {
      st.priority = adjustments.priorityOverrides[st.task.id]
    }
  })
  
  // Recalculate metrics
  const totalHours = updatedData.selectedTasks.reduce((sum, st) => sum + st.estimatedHours, 0)
  const priorityDist = updatedData.selectedTasks.reduce(
    (dist, st) => {
      dist[st.priority] = (dist[st.priority] || 0) + 1
      return dist
    },
    { high: 0, medium: 0, low: 0 }
  )
  
  updatedData.metrics = {
    ...updatedData.metrics,
    totalTasksSelected: updatedData.selectedTasks.length,
    totalEstimatedHours: totalHours,
    priorityDistribution: priorityDist
  }
  
  return updatedData
}

/**
 * Apply manual adjustments to assignments
 */
export function applyAssignmentAdjustments(
  reviewData: AssignmentReviewData,
  adjustments: AssignmentManualAdjustments
): AssignmentReviewData {
  const updatedData = { ...reviewData }
  
  // Apply reassignments
  adjustments.reassignments.forEach(reassign => {
    // Remove from old person/day
    const fromPerson = updatedData.assignmentsByPerson[reassign.fromPerson]
    const fromDay = updatedData.assignmentsByDay[reassign.fromDay]
    
    if (fromPerson) {
      const taskIndex = fromPerson.assignments.findIndex(a => a.taskId === reassign.taskId)
      if (taskIndex >= 0) {
        const [task] = fromPerson.assignments.splice(taskIndex, 1)
        fromPerson.totalTasks--
        fromPerson.totalEstimatedHours -= task.estimatedDuration ? task.estimatedDuration / 60 : 1
        
        // Add to new person/day
        const toPerson = updatedData.assignmentsByPerson[reassign.toPerson]
        const toDay = updatedData.assignmentsByDay[reassign.toDay]
        
        if (toPerson && toDay) {
          task.assignedTo = reassign.toPerson
          task.assignedToName = toPerson.member.name
          task.scheduledFor = reassign.toDay as any
          task.assignmentReason = reassign.reason || 'Manually reassigned'
          
          toPerson.assignments.push(task)
          toPerson.totalTasks++
          toPerson.totalEstimatedHours += task.estimatedDuration ? task.estimatedDuration / 60 : 1
          
          // Update day assignments
          if (fromDay) {
            const dayTaskIndex = fromDay.assignments.findIndex(a => a.taskId === reassign.taskId)
            if (dayTaskIndex >= 0) {
              fromDay.assignments.splice(dayTaskIndex, 1)
              fromDay.totalTasks--
              fromDay.totalEstimatedHours -= task.estimatedDuration ? task.estimatedDuration / 60 : 1
            }
          }
          
          toDay.assignments.push(task)
          toDay.totalTasks++
          toDay.totalEstimatedHours += task.estimatedDuration ? task.estimatedDuration / 60 : 1
        }
      }
    }
  })
  
  // Apply time adjustments
  Object.entries(adjustments.timeAdjustments).forEach(([taskId, timeAdjust]) => {
    Object.values(updatedData.assignmentsByPerson).forEach(person => {
      const task = person.assignments.find(a => a.taskId === taskId)
      if (task && timeAdjust) {
        if (timeAdjust.start) task.scheduledTime = { ...task.scheduledTime!, start: timeAdjust.start }
        if (timeAdjust.duration) {
          task.estimatedDuration = timeAdjust.duration
          task.scheduledTime = { ...task.scheduledTime!, duration: timeAdjust.duration }
        }
      }
    })
  })
  
  // Move tasks to deck
  adjustments.movedToDeck.forEach(taskId => {
    Object.values(updatedData.assignmentsByPerson).forEach(person => {
      const taskIndex = person.assignments.findIndex(a => a.taskId === taskId)
      if (taskIndex >= 0) {
        const [task] = person.assignments.splice(taskIndex, 1)
        task.scheduledFor = 'deck'
        
        // Update deck assignments
        if (!updatedData.assignmentsByDay.deck) {
          updatedData.assignmentsByDay.deck = {
            assignments: [],
            totalTasks: 0,
            totalEstimatedHours: 0
          }
        }
        updatedData.assignmentsByDay.deck.assignments.push(task)
        updatedData.assignmentsByDay.deck.totalTasks++
        updatedData.assignmentsByDay.deck.totalEstimatedHours += task.estimatedDuration ? task.estimatedDuration / 60 : 1
      }
    })
  })
  
  // Recalculate workload ratings
  Object.values(updatedData.assignmentsByPerson).forEach(person => {
    person.daysWithTasks = [...new Set(person.assignments.map(a => a.scheduledFor).filter(d => d !== 'deck' && d !== 'anytime_this_week'))]
    const hoursPerDay = person.totalEstimatedHours / (person.daysWithTasks.length || 1)
    if (hoursPerDay < 2) person.workloadRating = 'light'
    else if (hoursPerDay < 4) person.workloadRating = 'moderate'
    else if (hoursPerDay < 6) person.workloadRating = 'heavy'
    else person.workloadRating = 'overloaded'
  })
  
  return updatedData
}