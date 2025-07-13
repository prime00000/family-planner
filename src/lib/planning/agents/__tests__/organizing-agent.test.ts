import { OrganizingAgent } from '../organizing-agent'
import type { OrganizingAgentInput, AgentContext } from '../types'

// Mock Anthropic SDK
const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate
      }
    }))
  }
})

describe('OrganizingAgent', () => {
  let agent: OrganizingAgent
  let mockContext: AgentContext
  
  beforeEach(() => {
    jest.clearAllMocks()
    agent = new OrganizingAgent()
    
    mockContext = {
      sessionId: 'test-session',
      teamId: 'team-123',
      userId: 'user-admin'
    }
  })
  
  describe('Dialogue Phase', () => {
    it('should propose approach based on admin instructions', async () => {
      const input: OrganizingAgentInput = {
        sessionId: 'test-session',
        adminInstructions: 'Focus on homework this week',
        context: {
          weekStartDate: '2024-01-01',
          teamMembers: [
            { id: 'user-1', name: 'Benjamin', email: 'ben@example.com' }
          ],
          availableBacklog: [
            { id: 'task-1', description: 'Math homework', importance: 5 }
          ],
          activeObjectives: [],
          precedingPlans: [],
          recurringTasksDue: []
        },
        phase: 'dialogue'
      }
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            proposedApproach: {
              summary: "Focus on completing homework assignments",
              priorities: ["Complete math homework", "Review for tests"],
              strategy: "Prioritize homework early in the week",
              questionsForAdmin: []
            },
            identifiedTasks: {
              newItems: [],
              modificationsNeeded: [],
              estimatedWorkload: {
                'user-1': { name: 'Benjamin', estimatedHours: 5, taskCount: 8 }
              }
            },
            needsClarification: false
          })
        }],
        usage: { input_tokens: 100, output_tokens: 50 }
      })
      
      const result = await agent.execute(input, mockContext)
      
      expect(result).toHaveProperty('proposedApproach')
      expect(result).toHaveProperty('identifiedTasks')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.stringContaining('claude'),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Focus on homework this week')
            })
          ])
        })
      )
    })
    
    it('should identify clarification needs when instructions are vague', async () => {
      const input: OrganizingAgentInput = {
        sessionId: 'test-session',
        adminInstructions: 'Make things better',
        context: {
          weekStartDate: '2024-01-01',
          teamMembers: [],
          availableBacklog: [],
          activeObjectives: [],
          precedingPlans: [],
          recurringTasksDue: []
        },
        phase: 'dialogue'
      }
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            proposedApproach: {
              summary: "Need more specific guidance",
              priorities: [],
              strategy: "Awaiting clarification",
              questionsForAdmin: [
                "What specific areas would you like to improve?",
                "Are there particular tasks or objectives to focus on?"
              ]
            },
            identifiedTasks: {
              newItems: [],
              modificationsNeeded: [],
              estimatedWorkload: {}
            },
            needsClarification: true
          })
        }],
        usage: { input_tokens: 50, output_tokens: 30 }
      })
      
      const result = await agent.execute(input, mockContext)
      
      expect(result.needsClarification).toBe(true)
      expect(result.proposedApproach?.questionsForAdmin).toHaveLength(2)
    })
  })
  
  describe('Execution Phase', () => {
    it('should create execution guides after approval', async () => {
      const input: OrganizingAgentInput = {
        sessionId: 'test-session',
        adminInstructions: 'Focus on homework',
        context: {
          weekStartDate: '2024-01-01',
          teamMembers: [
            { id: 'user-1', name: 'Benjamin', email: 'ben@example.com' }
          ],
          availableBacklog: [
            { id: 'task-1', description: 'Math homework', importance: 5 },
            { id: 'task-2', description: 'Clean room', importance: 2 }
          ],
          activeObjectives: [],
          precedingPlans: [],
          recurringTasksDue: []
        },
        phase: 'execution',
        adminApproval: {
          approved: true
        }
      }
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            categorization: {
              priorities: [{
                type: 'focus',
                target: 'homework',
                weight: 0.8,
                reasoning: 'Admin requested homework focus'
              }],
              newContent: [],
              editRequests: [],
              assignmentChanges: []
            },
            selectionCriteria: {
              mustIncludeTasks: ['task-1'],
              preferredTasks: [],
              avoidTasks: ['task-2'],
              capacityGuidance: {
                'user-1': { maxTasks: 10, focusAreas: ['homework'] }
              }
            },
            selectionNotes: ['Focus on academic tasks'],
            nextPhase: 'selection'
          })
        }],
        usage: { input_tokens: 150, output_tokens: 80 }
      })
      
      const result = await agent.execute(input, mockContext)
      
      expect(result).toHaveProperty('categorization')
      expect(result).toHaveProperty('selectionCriteria')
      expect(result.selectionCriteria?.mustIncludeTasks).toContain('task-1')
    })
    
    it('should handle admin adjustments', async () => {
      const input: OrganizingAgentInput = {
        sessionId: 'test-session',
        adminInstructions: 'Focus on homework',
        context: {
          weekStartDate: '2024-01-01',
          teamMembers: [],
          availableBacklog: [],
          activeObjectives: [],
          precedingPlans: [],
          recurringTasksDue: []
        },
        phase: 'execution',
        adminApproval: {
          approved: true,
          adjustments: 'Also include some outdoor activities'
        }
      }
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            categorization: {
              priorities: [
                { type: 'focus', target: 'homework', weight: 0.6, reasoning: 'Primary focus' },
                { type: 'focus', target: 'outdoor activities', weight: 0.4, reasoning: 'Admin adjustment' }
              ],
              newContent: [{
                type: 'task',
                description: 'Family bike ride',
                metadata: { importance: 3, tags: ['outdoor', 'family'] }
              }],
              editRequests: [],
              assignmentChanges: []
            },
            editingGuide: {
              newElements: [{
                type: 'task',
                description: 'Family bike ride',
                metadata: { importance: 3, tags: ['outdoor', 'family'] }
              }],
              modifications: [],
              deletions: []
            },
            selectionCriteria: {
              mustIncludeTasks: [],
              preferredTasks: [],
              avoidTasks: [],
              capacityGuidance: {}
            },
            selectionNotes: [],
            nextPhase: 'editing'
          })
        }],
        usage: { input_tokens: 120, output_tokens: 90 }
      })
      
      const result = await agent.execute(input, mockContext)
      
      expect(result.categorization?.priorities).toHaveLength(2)
      expect(result.categorization?.newContent).toHaveLength(1)
      expect(result.nextPhase).toBe('editing')
    })
  })
  
  describe('Assignment Phase', () => {
    it('should assign tasks to team members', async () => {
      const selectedTaskIds = ['task-1', 'task-2']
      const tasks = [
        { id: 'task-1', description: 'Math homework', importance: 5, urgency: 5 },
        { id: 'task-2', description: 'Science project', importance: 4, urgency: 3 }
      ]
      const context = {
        teamMembers: [
          { id: 'user-1', name: 'Benjamin', email: 'ben@example.com' },
          { id: 'user-2', name: 'Eliana', email: 'eli@example.com' }
        ],
        weekStartDate: '2024-01-01'
      }
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            assignments: [
              {
                taskId: 'task-1',
                assignTo: 'user-1',
                scheduleFor: 'monday',
                reasoning: 'Benjamin handles math, urgent task early in week'
              },
              {
                taskId: 'task-2',
                assignTo: 'user-2',
                scheduleFor: 'wednesday',
                reasoning: 'Eliana takes science project, mid-week timing'
              }
            ],
            summary: {
              byPerson: {
                'user-1': { name: 'Benjamin', taskCount: 1, days: ['monday'] },
                'user-2': { name: 'Eliana', taskCount: 1, days: ['wednesday'] }
              },
              byDay: {
                monday: 1,
                wednesday: 1
              }
            }
          })
        }],
        usage: { input_tokens: 100, output_tokens: 60 }
      })
      
      const result = await agent.assignTasks(selectedTaskIds, tasks, context)
      
      expect(result.assignments).toHaveLength(2)
      expect(result.assignments[0].assignTo).toBe('user-1')
      expect(result.assignments[1].scheduleFor).toBe('wednesday')
    })
  })
  
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const input: OrganizingAgentInput = {
        sessionId: 'test-session',
        adminInstructions: 'Test',
        context: {
          weekStartDate: '2024-01-01',
          teamMembers: [],
          availableBacklog: [],
          activeObjectives: [],
          precedingPlans: [],
          recurringTasksDue: []
        },
        phase: 'dialogue'
      }
      
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'))
      
      await expect(agent.execute(input, mockContext)).rejects.toThrow('AI service error')
    })
    
    it('should handle invalid JSON responses', async () => {
      const input: OrganizingAgentInput = {
        sessionId: 'test-session',
        adminInstructions: 'Test',
        context: {
          weekStartDate: '2024-01-01',
          teamMembers: [],
          availableBacklog: [],
          activeObjectives: [],
          precedingPlans: [],
          recurringTasksDue: []
        },
        phase: 'dialogue'
      }
      
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Invalid JSON response'
        }],
        usage: { input_tokens: 10, output_tokens: 5 }
      })
      
      await expect(agent.execute(input, mockContext)).rejects.toThrow('No JSON object found in response')
    })
  })
})