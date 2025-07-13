import { AgentOrchestrator } from '../agent-orchestrator'
import { OrganizingAgent } from '../organizing-agent'
import { SelectionAgent } from '../selection-agent'
import { EditingAgent } from '../editing-agent'
import type {
  OrganizingAgentDialogueOutput,
  OrganizingAgentExecutionOutput,
  SelectionAgentOutput,
  EditingAgentOutput,
  VibePlanFile,
  OrchestratorInput
} from '../types'

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn()
      }
    }))
  }
})

// Mock agent responses
const mockOrganizingDialogueResponse: OrganizingAgentDialogueOutput = {
  proposedApproach: {
    summary: "Focus on homework and school preparation while maintaining household balance",
    priorities: [
      "Complete all pending homework assignments",
      "Prepare for upcoming tests and projects",
      "Maintain essential household tasks"
    ],
    strategy: "Prioritize academic tasks early in the week, distribute chores evenly among family members, and keep weekends lighter for family time.",
    questionsForAdmin: []
  },
  identifiedTasks: {
    newItems: [
      {
        type: 'task',
        description: 'Study for math test on Friday',
        metadata: {
          importance: 5,
          urgency: 5,
          tags: ['school', 'test', 'math']
        }
      }
    ],
    modificationsNeeded: [],
    estimatedWorkload: {
      'user-1': {
        name: 'Benjamin',
        estimatedHours: 8,
        taskCount: 15
      },
      'user-2': {
        name: 'Eliana',
        estimatedHours: 6,
        taskCount: 12
      }
    }
  },
  needsClarification: false
}

const mockOrganizingExecutionResponse: OrganizingAgentExecutionOutput = {
  categorization: {
    priorities: [
      {
        type: 'focus',
        target: 'homework and test preparation',
        weight: 0.8,
        reasoning: 'Admin specifically mentioned homework focus'
      }
    ],
    newContent: [
      {
        type: 'task',
        description: 'Study for math test on Friday',
        metadata: {
          importance: 5,
          urgency: 5,
          tags: ['school', 'test', 'math']
        }
      }
    ],
    editRequests: [],
    assignmentChanges: []
  },
  editingGuide: {
    newElements: [
      {
        type: 'task',
        description: 'Study for math test on Friday',
        metadata: {
          importance: 5,
          urgency: 5,
          tags: ['school', 'test', 'math']
        }
      }
    ],
    modifications: [],
    deletions: []
  },
  selectionCriteria: {
    mustIncludeTasks: ['task-1', 'task-2'],
    preferredTasks: ['task-3', 'task-4'],
    avoidTasks: [],
    capacityGuidance: {
      'user-1': {
        maxTasks: 15,
        focusAreas: ['homework', 'test prep']
      },
      'user-2': {
        maxTasks: 12,
        focusAreas: ['homework', 'chores']
      }
    }
  },
  selectionNotes: [
    'Focus on school-related tasks',
    'Balance workload across the week'
  ],
  nextPhase: 'editing'
}

const mockSelectionResponse: SelectionAgentOutput = {
  selectedTaskIds: ['task-1', 'task-2', 'task-3', 'new-task-1'],
  taskPriorities: {
    'task-1': {
      taskId: 'task-1',
      score: 95,
      rationale: 'Math homework due tomorrow - highest urgency',
      suggestedTiming: 'early-week',
      suggestedAssignee: 'user-1'
    },
    'task-2': {
      taskId: 'task-2',
      score: 90,
      rationale: 'Science project preparation - high importance',
      suggestedTiming: 'mid-week',
      suggestedAssignee: 'user-2'
    }
  },
  deferredTaskIds: ['task-5', 'task-6'],
  reasoning: {
    totalAvailable: 10,
    totalSelected: 4,
    capacityUtilization: {
      'user-1': {
        assigned: 8,
        capacity: 15,
        percentage: 53
      },
      'user-2': {
        assigned: 6,
        capacity: 12,
        percentage: 50
      }
    },
    priorityAlignment: 'Selected tasks align with homework focus (3/4 tasks)',
    deferralReasons: {
      'task-5': 'Low priority, no alignment with current focus',
      'task-6': 'Can be deferred to next week'
    }
  }
}

const mockEditingResponse: EditingAgentOutput = {
  changes: {
    newElements: [
      {
        tempId: 'temp-123456-1',
        type: 'task',
        data: {
          description: 'Study for math test on Friday',
          importance: 5,
          urgency: 5,
          tags: ['school', 'test', 'math'],
          team_id: 'team-123',
          submitted_by: 'user-admin'
        }
      }
    ],
    modifications: [],
    deletions: [],
    validationIssues: []
  },
  summary: {
    elementsCreated: 1,
    elementsModified: 0,
    elementsDeleted: 0,
    validationErrors: 0,
    validationWarnings: 0
  }
}

const mockFinalPlanResponse: EditingAgentOutput = {
  changes: {
    newElements: [],
    modifications: [],
    deletions: [],
    validationIssues: []
  },
  planJSON: {
    title: 'Week focused on homework and test preparation',
    assignments: {
      'user-1': {
        user_name: 'Benjamin',
        monday: [
          {
            id: 'task-1',
            description: 'Complete math homework',
            importance: 5,
            urgency: 5,
            tags: ['school', 'homework', 'math'],
            source: 'task'
          }
        ],
        tuesday: [],
        wednesday: [
          {
            id: 'new-task-1',
            description: 'Study for math test on Friday',
            importance: 5,
            urgency: 5,
            tags: ['school', 'test', 'math'],
            source: 'task'
          }
        ],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
        anytime_this_week: [],
        deck: []
      },
      'user-2': {
        user_name: 'Eliana',
        monday: [],
        tuesday: [
          {
            id: 'task-2',
            description: 'Work on science project',
            importance: 4,
            urgency: 4,
            tags: ['school', 'project', 'science'],
            source: 'task'
          }
        ],
        wednesday: [],
        thursday: [
          {
            id: 'task-3',
            description: 'Read history chapter',
            importance: 3,
            urgency: 3,
            tags: ['school', 'reading', 'history'],
            source: 'task'
          }
        ],
        friday: [],
        saturday: [],
        sunday: [],
        anytime_this_week: [],
        deck: []
      }
    },
    metadata: {
      priorityGuidance: 'Focus on homework and school preparation',
      generatedAt: new Date().toISOString(),
      version: 1
    },
    statistics: {
      total_tasks: 4,
      tasks_per_person: {
        'user-1': 2,
        'user-2': 2
      },
      high_priority_count: 3,
      scheduled_tasks_count: 4
    }
  },
  summary: {
    elementsCreated: 0,
    elementsModified: 0,
    elementsDeleted: 0,
    validationErrors: 0,
    validationWarnings: 0
  }
}

// Mock implementation of agent execute methods
const mockAgentExecute = (agent: any, response: any) => {
  jest.spyOn(agent, 'execute').mockResolvedValue(response)
}

const mockAssignTasks = {
  assignments: [
    {
      taskId: 'task-1',
      assignTo: 'user-1',
      scheduleFor: 'monday',
      reasoning: 'Benjamin handles math homework, scheduled early for urgency'
    },
    {
      taskId: 'task-2',
      assignTo: 'user-2',
      scheduleFor: 'tuesday',
      reasoning: 'Eliana works on science project'
    },
    {
      taskId: 'new-task-1',
      assignTo: 'user-1',
      scheduleFor: 'wednesday',
      reasoning: 'Benjamin studies for math test'
    },
    {
      taskId: 'task-3',
      assignTo: 'user-2',
      scheduleFor: 'thursday',
      reasoning: 'Eliana reads history chapter'
    }
  ],
  summary: {
    byPerson: {
      'user-1': {
        name: 'Benjamin',
        taskCount: 2,
        days: ['monday', 'wednesday']
      },
      'user-2': {
        name: 'Eliana',
        taskCount: 2,
        days: ['tuesday', 'thursday']
      }
    },
    byDay: {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1
    }
  }
}

describe('Agent Orchestrator Flow', () => {
  let orchestrator: AgentOrchestrator
  let mockInput: OrchestratorInput
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Create fresh orchestrator instance
    orchestrator = new AgentOrchestrator()
    
    // Mock input data
    mockInput = {
      adminInstructions: 'Focus on homework and school preparation',
      teamMembers: [
        { id: 'user-1', name: 'Benjamin', email: 'benjamin@example.com' },
        { id: 'user-2', name: 'Eliana', email: 'eliana@example.com' }
      ],
      availableBacklog: [
        { id: 'task-1', description: 'Complete math homework', importance: 5, urgency: 5 },
        { id: 'task-2', description: 'Work on science project', importance: 4, urgency: 4 },
        { id: 'task-3', description: 'Read history chapter', importance: 3, urgency: 3 },
        { id: 'task-4', description: 'Clean room', importance: 2, urgency: 2 },
        { id: 'task-5', description: 'Organize bookshelf', importance: 1, urgency: 1 }
      ],
      activeObjectives: [
        { id: 'obj-1', description: 'Maintain good grades', importance: 5 }
      ],
      precedingPlans: [],
      recurringTasksDue: [],
      weekStartDate: '2024-01-01',
      userId: 'user-admin',
      teamId: 'team-123'
    }
    
    // Mock all agent methods
    mockAgentExecute(orchestrator['organizingAgent'], mockOrganizingDialogueResponse)
    jest.spyOn(orchestrator['organizingAgent'], 'assignTasks').mockResolvedValue(mockAssignTasks)
    mockAgentExecute(orchestrator['selectionAgent'], mockSelectionResponse)
    mockAgentExecute(orchestrator['editingAgent'], mockEditingResponse)
  })
  
  describe('Dialogue Phase', () => {
    it('should start dialogue and return proposed approach', async () => {
      const result = await orchestrator.startDialogue(mockInput)
      
      expect(result.needsApproval).toBe(true)
      expect(result.dialogueResult).toEqual(mockOrganizingDialogueResponse)
      expect(result.error).toBeUndefined()
    })
    
    it('should create a session with correct properties', async () => {
      await orchestrator.startDialogue(mockInput)
      const session = orchestrator.getSession()
      
      expect(session).toBeDefined()
      expect(session?.userId).toBe('user-admin')
      expect(session?.teamId).toBe('team-123')
      expect(session?.dialogueState.phase).toBe('initial')
    })
    
    it('should handle dialogue errors gracefully', async () => {
      mockAgentExecute(orchestrator['organizingAgent'], Promise.reject(new Error('API error')))
      
      const result = await orchestrator.startDialogue(mockInput)
      
      expect(result.needsApproval).toBe(false)
      expect(result.error).toBe('API error')
    })
  })
  
  describe('Execution Phase', () => {
    beforeEach(async () => {
      // Start dialogue first to create session
      await orchestrator.startDialogue(mockInput)
      
      // Update mocks for execution phase
      mockAgentExecute(orchestrator['organizingAgent'], mockOrganizingExecutionResponse)
    })
    
    it('should execute approved plan with all agents', async () => {
      // Mock the final plan generation
      const editingAgentMock = orchestrator['editingAgent']
      editingAgentMock.execute = jest.fn()
        .mockResolvedValueOnce(mockEditingResponse) // First call for creating new tasks
        .mockResolvedValueOnce(mockFinalPlanResponse) // Second call for final plan
      
      const result = await orchestrator.executeApprovedPlan(mockInput, {
        approved: true
      })
      
      expect(result.needsApproval).toBe(false)
      expect(result.finalPlan).toBeDefined()
      expect(result.finalPlan?.title).toBe('Week focused on homework and test preparation')
      expect(result.error).toBeUndefined()
    })
    
    it('should handle adjustments in approval', async () => {
      const editingAgentMock = orchestrator['editingAgent']
      editingAgentMock.execute = jest.fn()
        .mockResolvedValueOnce(mockEditingResponse)
        .mockResolvedValueOnce(mockFinalPlanResponse)
      
      const result = await orchestrator.executeApprovedPlan(mockInput, {
        approved: true,
        adjustments: 'Also include some outdoor activities'
      })
      
      expect(result.finalPlan).toBeDefined()
      
      // Verify the organizing agent received the adjustments
      const organizingCall = orchestrator['organizingAgent'].execute as jest.Mock
      expect(organizingCall).toHaveBeenCalledWith(
        expect.objectContaining({
          adminApproval: {
            approved: true,
            adjustments: 'Also include some outdoor activities'
          }
        }),
        expect.anything()
      )
    })
    
    it('should track execution phases in session', async () => {
      const editingAgentMock = orchestrator['editingAgent']
      editingAgentMock.execute = jest.fn()
        .mockResolvedValueOnce(mockEditingResponse)
        .mockResolvedValueOnce(mockFinalPlanResponse)
      
      await orchestrator.executeApprovedPlan(mockInput, { approved: true })
      const session = orchestrator.getSession()
      
      expect(session?.executionState?.completedPhases).toContain('editing')
      expect(session?.executionState?.completedPhases).toContain('selection')
      expect(session?.executionState?.completedPhases).toContain('plan-generation')
    })
    
    it('should handle execution errors and return error message', async () => {
      mockAgentExecute(orchestrator['selectionAgent'], Promise.reject(new Error('Selection failed')))
      
      const result = await orchestrator.executeApprovedPlan(mockInput, { approved: true })
      
      expect(result.needsApproval).toBe(false)
      expect(result.error).toBe('Selection failed')
      expect(result.finalPlan).toBeUndefined()
    })
  })
  
  describe('Agent Integration', () => {
    it('should pass correct data between agents', async () => {
      // Setup mocks
      const organizingMock = orchestrator['organizingAgent'].execute as jest.Mock
      const selectionMock = orchestrator['selectionAgent'].execute as jest.Mock
      const editingMock = orchestrator['editingAgent'].execute as jest.Mock
      
      organizingMock.mockResolvedValueOnce(mockOrganizingDialogueResponse)
        .mockResolvedValueOnce(mockOrganizingExecutionResponse)
      selectionMock.mockResolvedValueOnce(mockSelectionResponse)
      editingMock.mockResolvedValueOnce(mockEditingResponse)
        .mockResolvedValueOnce(mockFinalPlanResponse)
      
      // Execute flow
      await orchestrator.startDialogue(mockInput)
      await orchestrator.executeApprovedPlan(mockInput, { approved: true })
      
      // Verify Selection Agent received correct input from Organizing Agent
      expect(selectionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          selectionCriteria: mockOrganizingExecutionResponse.selectionCriteria,
          priorities: mockOrganizingExecutionResponse.categorization.priorities
        }),
        expect.anything()
      )
      
      // Verify Editing Agent received correct editing guide
      expect(editingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          editingGuide: mockOrganizingExecutionResponse.editingGuide
        }),
        expect.anything()
      )
    })
    
    it('should skip editing phase if no edits needed', async () => {
      // Mock execution response with no edits
      const noEditsResponse = {
        ...mockOrganizingExecutionResponse,
        editingGuide: undefined
      }
      
      const organizingMock = orchestrator['organizingAgent'].execute as jest.Mock
      const editingMock = orchestrator['editingAgent'].execute as jest.Mock
      
      organizingMock.mockResolvedValueOnce(mockOrganizingDialogueResponse)
        .mockResolvedValueOnce(noEditsResponse)
      editingMock.mockResolvedValueOnce(mockFinalPlanResponse)
      
      await orchestrator.startDialogue(mockInput)
      await orchestrator.executeApprovedPlan(mockInput, { approved: true })
      
      // Editing agent should only be called once (for final plan)
      expect(editingMock).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('Session Management', () => {
    it('should clear session correctly', async () => {
      await orchestrator.startDialogue(mockInput)
      expect(orchestrator.getSession()).toBeDefined()
      
      orchestrator.clearSession()
      expect(orchestrator.getSession()).toBeNull()
    })
    
    it('should generate unique session IDs', async () => {
      const orchestrator1 = new AgentOrchestrator()
      const orchestrator2 = new AgentOrchestrator()
      
      mockAgentExecute(orchestrator1['organizingAgent'], mockOrganizingDialogueResponse)
      mockAgentExecute(orchestrator2['organizingAgent'], mockOrganizingDialogueResponse)
      
      await orchestrator1.startDialogue(mockInput)
      await orchestrator2.startDialogue(mockInput)
      
      const session1 = orchestrator1.getSession()
      const session2 = orchestrator2.getSession()
      
      expect(session1?.sessionId).not.toBe(session2?.sessionId)
    })
  })
  
  describe('Plan Validation', () => {
    it('should validate final plan structure', async () => {
      // Setup mocks
      const organizingMock = orchestrator['organizingAgent'].execute as jest.Mock
      const selectionMock = orchestrator['selectionAgent'].execute as jest.Mock
      const editingMock = orchestrator['editingAgent'].execute as jest.Mock
      
      organizingMock.mockResolvedValueOnce(mockOrganizingDialogueResponse)
        .mockResolvedValueOnce(mockOrganizingExecutionResponse)
      selectionMock.mockResolvedValueOnce(mockSelectionResponse)
      editingMock.mockResolvedValueOnce(mockEditingResponse)
        .mockResolvedValueOnce(mockFinalPlanResponse)
      
      await orchestrator.startDialogue(mockInput)
      const result = await orchestrator.executeApprovedPlan(mockInput, { approved: true })
      
      // Verify the plan has valid structure
      expect(result.finalPlan).toBeDefined()
      expect(result.finalPlan?.assignments).toBeDefined()
      
      // Check that all assignment keys are valid UUIDs or user IDs
      const validKeyRegex = /^(user-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      Object.keys(result.finalPlan?.assignments || {}).forEach(key => {
        expect(key).toMatch(validKeyRegex)
      })
      
      // Check that each user has all required days
      Object.values(result.finalPlan?.assignments || {}).forEach(userPlan => {
        expect(userPlan).toHaveProperty('monday')
        expect(userPlan).toHaveProperty('tuesday')
        expect(userPlan).toHaveProperty('wednesday')
        expect(userPlan).toHaveProperty('thursday')
        expect(userPlan).toHaveProperty('friday')
        expect(userPlan).toHaveProperty('saturday')
        expect(userPlan).toHaveProperty('sunday')
        expect(userPlan).toHaveProperty('anytime_this_week')
        expect(userPlan).toHaveProperty('deck')
      })
    })
  })
})

// Export mock data for use in other tests
export {
  mockOrganizingDialogueResponse,
  mockOrganizingExecutionResponse,
  mockSelectionResponse,
  mockEditingResponse,
  mockFinalPlanResponse,
  mockAssignTasks
}