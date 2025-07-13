import { OrganizingAgent } from './organizing-agent'
import { SelectionAgent } from './selection-agent'
import { EditingAgent } from './editing-agent'
import { 
  transformSelectionForReview, 
  transformAssignmentForReview 
} from '@/lib/planning/review-utils'
import { shouldSkipCheckpoint } from '@/lib/planning/review-config'
import type {
  AgentContext,
  OrganizingAgentInput,
  OrganizingAgentDialogueOutput,
  OrganizingAgentExecutionOutput,
  SelectionAgentInput,
  SelectionAgentOutput,
  EditingAgentInput,
  EditingAgentOutput,
  VibePlanFile,
  TaskWithMetadata,
  TeamMember,
  Task,
  OrchestratorSession,
  DialogueState
} from './types'
import type {
  SelectionReviewData,
  AssignmentReviewData,
  SkipPreferences
} from './review-types'

export interface OrchestratorInput {
  adminInstructions: string
  teamMembers: TeamMember[]
  availableBacklog: TaskWithMetadata[]
  activeObjectives: any[]
  precedingPlans: any[]
  recurringTasksDue: any[]
  weekStartDate: string
  userId: string
  teamId: string
}

export interface OrchestratorOutput {
  dialogueResult?: OrganizingAgentDialogueOutput
  needsApproval: boolean
  finalPlan?: VibePlanFile
  error?: string
  // Review checkpoint data
  needsSelectionReview?: boolean
  selectionReviewData?: SelectionReviewData
  needsAssignmentReview?: boolean
  assignmentReviewData?: AssignmentReviewData
}

export class AgentOrchestrator {
  private organizingAgent: OrganizingAgent
  private selectionAgent: SelectionAgent
  private editingAgent: EditingAgent
  private session: OrchestratorSession | null = null
  private static instance: AgentOrchestrator | null = null
  private skipPreferences: SkipPreferences | null = null
  private reviewRunCount: number = 0
  
  constructor() {
    this.organizingAgent = new OrganizingAgent()
    this.selectionAgent = new SelectionAgent()
    this.editingAgent = new EditingAgent()
  }
  
  static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator()
    }
    return AgentOrchestrator.instance
  }
  
  setSkipPreferences(preferences: SkipPreferences): void {
    this.skipPreferences = preferences
  }
  
  async startDialogue(input: OrchestratorInput): Promise<OrchestratorOutput> {
    try {
      // Initialize session
      this.session = this.createSession(input)
      const context = this.createAgentContext(input)
      
      // Phase 1: OA Dialogue
      console.log('Starting OA dialogue phase...')
      const dialogueInput: OrganizingAgentInput = {
        sessionId: this.session.sessionId,
        adminInstructions: input.adminInstructions,
        context: {
          weekStartDate: input.weekStartDate,
          teamMembers: input.teamMembers,
          availableBacklog: input.availableBacklog,
          activeObjectives: input.activeObjectives,
          precedingPlans: input.precedingPlans,
          recurringTasksDue: input.recurringTasksDue
        },
        phase: 'dialogue'
      }
      
      const dialogueResult = await this.organizingAgent.execute(
        dialogueInput, 
        context
      ) as OrganizingAgentDialogueOutput
      
      // Update session state
      this.session.dialogueState.approach = dialogueResult.proposedApproach
      this.session.dialogueState.phase = 'initial'
      
      return {
        dialogueResult,
        needsApproval: true
      }
      
    } catch (error) {
      console.error('Orchestrator dialogue error:', error)
      return {
        needsApproval: false,
        error: error instanceof Error ? error.message : 'Unknown error in dialogue phase'
      }
    }
  }
  
  async executeApprovedPlan(
    input: OrchestratorInput,
    adminApproval: { approved: boolean; adjustments?: string }
  ): Promise<OrchestratorOutput> {
    try {
      // If no session exists, create one (for stateless execution)
      if (!this.session) {
        this.session = this.createSession(input)
        // Skip dialogue phase since we're executing directly
        this.session.dialogueState.phase = 'approved'
      }
      
      const context = this.createAgentContext(input)
      
      // Phase 2: OA Execution
      console.log('Starting OA execution phase...')
      const executionInput: OrganizingAgentInput = {
        sessionId: this.session.sessionId,
        adminInstructions: input.adminInstructions,
        context: {
          weekStartDate: input.weekStartDate,
          teamMembers: input.teamMembers,
          availableBacklog: input.availableBacklog,
          activeObjectives: input.activeObjectives,
          precedingPlans: input.precedingPlans,
          recurringTasksDue: input.recurringTasksDue
        },
        phase: 'execution',
        adminApproval
      }
      
      const executionResult = await this.organizingAgent.execute(
        executionInput,
        context
      ) as OrganizingAgentExecutionOutput
      
      // Store execution result
      if (!this.session.executionState) {
        this.session.executionState = {
          currentPhase: 'execution',
          completedPhases: [],
          results: {}
        }
      }
      this.session.executionState.results.organizingResults = executionResult
      
      // Phase 3: Conditional Editing Agent for new/modified items
      let updatedBacklog = [...input.availableBacklog]
      if (executionResult.editingGuide && 
          (executionResult.editingGuide.newElements.length > 0 || 
           executionResult.editingGuide.modifications.length > 0)) {
        
        console.log('Starting EA for task creation/modification...')
        const editingInput: EditingAgentInput = {
          sessionId: this.session.sessionId,
          editingGuide: executionResult.editingGuide,
          existingTasks: updatedBacklog,
          teamMembers: input.teamMembers,
          context: {
            weekStartDate: input.weekStartDate,
            teamId: input.teamId
          },
          operation: 'create'
        }
        
        try {
          const editingResult = await this.editingAgent.execute(editingInput, context)
          console.log('Editing Agent completed successfully')
          this.session.executionState.results.editingResults = editingResult
        } catch (error) {
          console.error('Editing Agent failed:', error)
          throw new Error(`Editing Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
        
        // Update backlog with new tasks (in real implementation, these would be saved to DB)
        editingResult.changes.newElements.forEach(element => {
          updatedBacklog.push({
            id: element.tempId,
            description: element.data.description,
            importance: element.data.importance,
            urgency: element.data.urgency,
            tags: element.data.tags
          })
        })
        
        this.session.executionState.completedPhases.push('editing')
      }
      
      // Phase 4: Selection Agent
      console.log('Starting SA for task selection...')
      const teamCapacity = this.calculateTeamCapacity(input.teamMembers)
      
      const selectionInput: SelectionAgentInput = {
        sessionId: this.session.sessionId,
        availableTasks: updatedBacklog,
        selectionCriteria: executionResult.selectionCriteria,
        priorities: executionResult.categorization.priorities,
        teamCapacity,
        context: {
          weekStartDate: input.weekStartDate,
          precedingPlans: input.precedingPlans
        }
      }
      
      let selectionResult
      try {
        selectionResult = await this.selectionAgent.execute(selectionInput, context)
        console.log('Selection Agent completed successfully')
        this.session.executionState.results.selectionResults = selectionResult
        this.session.executionState.completedPhases.push('selection')
      } catch (error) {
        console.error('Selection Agent failed:', error)
        throw new Error(`Selection Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      // Check if we need to pause for selection review
      const selectionReviewResult = await this.pauseForSelectionReview(
        selectionResult,
        updatedBacklog,
        input.teamMembers
      )
      
      if (selectionReviewResult.needsReview) {
        console.log('Pausing for selection review...')
        return {
          needsApproval: false,
          needsSelectionReview: true,
          selectionReviewData: selectionReviewResult.reviewData
        }
      }
      
      // Apply any selection adjustments from previous review
      if (this.session.executionState.results.reviewedSelection) {
        console.log('Using reviewed selection from previous review')
        selectionResult = {
          ...selectionResult,
          selectedTaskIds: this.session.executionState.results.reviewedSelection.selectedTaskIds,
          selectedTasks: this.session.executionState.results.reviewedSelection.selectedTasks
        }
      }
      
      // Phase 5: OA Assignment
      console.log('Starting OA assignment phase...')
      const selectedTasks = updatedBacklog.filter(t => 
        selectionResult.selectedTaskIds.includes(t.id)
      )
      
      const assignmentResult = await this.organizingAgent.assignTasks(
        selectionResult.selectedTaskIds,
        selectedTasks,
        {
          teamMembers: input.teamMembers,
          weekStartDate: input.weekStartDate
        }
      )
      
      this.session.executionState.results.assignmentResults = assignmentResult
      this.session.executionState.completedPhases.push('assignment')
      
      // Check if we need to pause for assignment review
      const assignmentReviewResult = await this.pauseForAssignmentReview(
        assignmentResult,
        selectedTasks,
        input.teamMembers
      )
      
      if (assignmentReviewResult.needsReview) {
        console.log('Pausing for assignment review...')
        return {
          needsApproval: false,
          needsAssignmentReview: true,
          assignmentReviewData: assignmentReviewResult.reviewData
        }
      }
      
      // Apply any assignment adjustments from previous review
      let finalAssignments = assignmentResult.assignments
      if (this.session.executionState.results.reviewedAssignments) {
        console.log('Using reviewed assignments from previous review')
        finalAssignments = this.session.executionState.results.reviewedAssignments.assignments
      }
      
      // Phase 6: EA Final Plan Generation
      console.log('Starting EA final plan generation...')
      const planGenerationInput: EditingAgentInput = {
        sessionId: this.session.sessionId,
        editingGuide: { newElements: [], modifications: [], deletions: [] },
        existingTasks: updatedBacklog,
        teamMembers: input.teamMembers,
        context: {
          weekStartDate: input.weekStartDate,
          teamId: input.teamId
        },
        operation: 'generatePlan',
        planData: {
          selectedTasks,
          assignments: finalAssignments,
          title: this.generatePlanTitle(executionResult, input.adminInstructions),
          metadata: {
            priorityGuidance: input.adminInstructions,
            organizingNotes: executionResult.selectionNotes
          }
        }
      }
      
      let finalPlanResult
      try {
        console.log('Starting final plan generation with Editing Agent...')
        finalPlanResult = await this.editingAgent.execute(planGenerationInput, context)
        console.log('Editing Agent completed plan generation')
        
        if (!finalPlanResult.planJSON) {
          throw new Error('Editing Agent failed to generate plan JSON')
        }
      } catch (error) {
        console.error('Final plan generation failed:', error)
        throw new Error(`Plan generation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      this.session.executionState.results.finalPlan = finalPlanResult.planJSON
      this.session.executionState.completedPhases.push('plan-generation')
      
      return {
        needsApproval: false,
        finalPlan: finalPlanResult.planJSON
      }
      
    } catch (error) {
      console.error('Orchestrator execution error:', error)
      return {
        needsApproval: false,
        error: error instanceof Error ? error.message : 'Unknown error in execution phase'
      }
    }
  }
  
  private createSession(input: OrchestratorInput): OrchestratorSession {
    return {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: input.userId,
      teamId: input.teamId,
      startTime: new Date(),
      dialogueState: {
        phase: 'initial',
        iterationCount: 0
      }
    }
  }
  
  private createAgentContext(input: OrchestratorInput): AgentContext {
    return {
      sessionId: this.session?.sessionId || '',
      teamId: input.teamId,
      userId: input.userId
    }
  }
  
  private calculateTeamCapacity(teamMembers: TeamMember[]): any {
    // Simple capacity calculation - in real implementation would be more sophisticated
    const capacity: any = {}
    
    teamMembers.forEach(member => {
      // Rough capacity based on typical family roles
      let maxTasks = 10 // default
      
      if (member.name.toLowerCase().includes('avi') || 
          member.name.toLowerCase().includes('konrad')) {
        maxTasks = 5 // younger children
      } else if (member.name.toLowerCase().includes('elikai') || 
                 member.name.toLowerCase().includes('eliana')) {
        maxTasks = 8 // teenagers
      } else if (member.name.toLowerCase().includes('benjamin')) {
        maxTasks = 12 // older teen
      } else {
        maxTasks = 15 // adults
      }
      
      capacity[member.id] = {
        name: member.name,
        maxTasks,
        currentLoad: 0,
        skills: [] // Would be populated from user profiles
      }
    })
    
    return capacity
  }
  
  private generatePlanTitle(
    executionResult: OrganizingAgentExecutionOutput,
    adminInstructions: string
  ): string {
    // Generate a title based on priorities
    const topPriority = executionResult.categorization.priorities[0]
    if (topPriority) {
      return `Week focused on ${topPriority.target}`
    }
    
    // Fallback to extracting from admin instructions
    const shortInstruction = adminInstructions.substring(0, 50)
    return shortInstruction.length < adminInstructions.length 
      ? `${shortInstruction}...` 
      : shortInstruction
  }
  
  getSession(sessionId?: string): OrchestratorSession | null {
    if (sessionId && this.session?.sessionId !== sessionId) {
      console.warn(`Session ID mismatch: expected ${sessionId}, got ${this.session?.sessionId}`)
      return null
    }
    return this.session
  }
  
  async updateSessionState(sessionId: string, updates: any): Promise<void> {
    if (!this.session || this.session.sessionId !== sessionId) {
      // Create a minimal session if it doesn't exist
      if (!this.session) {
        this.session = {
          sessionId,
          phase: 'execution',
          dialogueState: null,
          executionState: {
            currentPhase: 'review',
            completedPhases: [],
            results: {},
            errors: []
          },
          context: {
            weekStartDate: new Date().toISOString(),
            teamMembers: [],
            availableBacklog: [],
            activeObjectives: [],
            recurringTasksDue: [],
            precedingPlans: []
          }
        }
      } else {
        throw new Error(`Session ID mismatch: expected ${sessionId}, got ${this.session.sessionId}`)
      }
    }
    
    // Update execution results with review data
    this.session.executionState.results = {
      ...this.session.executionState.results,
      ...updates
    }
    
    console.log('[Orchestrator] Session state updated:', {
      sessionId,
      updates: Object.keys(updates)
    })
  }
  
  clearSession(): void {
    this.session = null
  }
  
  private async pauseForSelectionReview(
    selectionOutput: SelectionAgentOutput,
    allTasks: Task[],
    teamMembers: TeamMember[]
  ): Promise<{ needsReview: boolean; reviewData?: SelectionReviewData }> {
    // Transform selection output to review format
    const reviewData = transformSelectionForReview(
      selectionOutput,
      allTasks,
      teamMembers
    )
    
    // Check if we should skip this review
    if (this.skipPreferences) {
      this.reviewRunCount++
      const skipCheck = shouldSkipCheckpoint(
        'selection',
        reviewData,
        this.skipPreferences,
        this.reviewRunCount
      )
      
      if (skipCheck.skip) {
        console.log(`Skipping selection review: ${skipCheck.reason}`)
        return { needsReview: false }
      }
    }
    
    return { needsReview: true, reviewData }
  }
  
  private async pauseForAssignmentReview(
    assignmentResult: any,
    tasks: Task[],
    teamMembers: TeamMember[]
  ): Promise<{ needsReview: boolean; reviewData?: AssignmentReviewData }> {
    // Transform assignment result to review format
    const reviewData = transformAssignmentForReview(
      assignmentResult,
      tasks,
      teamMembers
    )
    
    // Check if we should skip this review
    if (this.skipPreferences) {
      const skipCheck = shouldSkipCheckpoint(
        'assignment',
        reviewData,
        this.skipPreferences,
        this.reviewRunCount
      )
      
      if (skipCheck.skip) {
        console.log(`Skipping assignment review: ${skipCheck.reason}`)
        return { needsReview: false }
      }
    }
    
    return { needsReview: true, reviewData }
  }
  
  continueAfterSelectionReview(): void {
    if (!this.session) {
      throw new Error('No active session')
    }
    
    // Mark that we've completed selection review
    this.session.executionState.completedPhases.push('selection-review')
    console.log('Continuing after selection review')
  }
  
  continueAfterAssignmentReview(): void {
    if (!this.session) {
      throw new Error('No active session')
    }
    
    // Mark that we've completed assignment review
    this.session.executionState.completedPhases.push('assignment-review')
    console.log('Continuing after assignment review')
  }
}