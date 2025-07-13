import type {
  TeamMember,
  TaskWithMetadata,
  Objective,
  PlanSummary,
  RecurringTaskInstance,
  AgentContext
} from '../types'

// Mock data generators
export const createMockTeamMember = (overrides?: Partial<TeamMember>): TeamMember => ({
  id: 'user-' + Math.random().toString(36).substr(2, 9),
  name: 'Test User',
  email: 'test@example.com',
  ...overrides
})

export const createMockTask = (overrides?: Partial<TaskWithMetadata>): TaskWithMetadata => ({
  id: 'task-' + Math.random().toString(36).substr(2, 9),
  description: 'Test task',
  importance: 3,
  urgency: 3,
  tags: ['test'],
  status: 'active',
  ...overrides
})

export const createMockObjective = (overrides?: Partial<Objective>): Objective => ({
  id: 'obj-' + Math.random().toString(36).substr(2, 9),
  description: 'Test objective',
  importance: 4,
  ...overrides
})

export const createMockPlanSummary = (overrides?: Partial<PlanSummary>): PlanSummary => ({
  id: 'plan-' + Math.random().toString(36).substr(2, 9),
  week_start_date: '2024-01-01',
  title: 'Test Plan',
  task_count: 10,
  completion_rate: 75,
  ...overrides
})

export const createMockRecurringTask = (overrides?: Partial<RecurringTaskInstance>): RecurringTaskInstance => ({
  id: 'recurring-' + Math.random().toString(36).substr(2, 9),
  description: 'Test recurring task',
  frequency: 'weekly',
  last_completed_date: '2023-12-25',
  next_due_date: '2024-01-01',
  ...overrides
})

export const createMockContext = (overrides?: Partial<AgentContext>): AgentContext => ({
  sessionId: 'session-' + Math.random().toString(36).substr(2, 9),
  teamId: 'team-123',
  userId: 'user-admin',
  ...overrides
})

// Mock family data
export const mockFamilyMembers = {
  parents: [
    createMockTeamMember({ id: 'user-kurt', name: 'Kurt', email: 'kurt@example.com' }),
    createMockTeamMember({ id: 'user-jessica', name: 'Jessica', email: 'jessica@example.com' }),
    createMockTeamMember({ id: 'user-barb', name: 'Barb', email: 'barb@example.com' })
  ],
  children: [
    createMockTeamMember({ id: 'user-benjamin', name: 'Benjamin', email: 'benjamin@example.com' }),
    createMockTeamMember({ id: 'user-eliana', name: 'Eliana', email: 'eliana@example.com' }),
    createMockTeamMember({ id: 'user-elikai', name: 'Elikai', email: 'elikai@example.com' }),
    createMockTeamMember({ id: 'user-konrad', name: 'Konrad', email: 'konrad@example.com' }),
    createMockTeamMember({ id: 'user-avi', name: 'Avi Grace', email: 'avi@example.com' })
  ]
}

// Common test tasks
export const mockSchoolTasks = [
  createMockTask({ 
    id: 'task-math-hw',
    description: 'Complete math homework', 
    importance: 5, 
    urgency: 5,
    tags: ['school', 'homework', 'math']
  }),
  createMockTask({ 
    id: 'task-science-project',
    description: 'Work on science project', 
    importance: 4, 
    urgency: 4,
    tags: ['school', 'project', 'science']
  }),
  createMockTask({ 
    id: 'task-history-reading',
    description: 'Read history chapter 5', 
    importance: 3, 
    urgency: 3,
    tags: ['school', 'reading', 'history']
  }),
  createMockTask({ 
    id: 'task-english-essay',
    description: 'Write English essay', 
    importance: 4, 
    urgency: 5,
    tags: ['school', 'writing', 'english']
  })
]

export const mockHouseholdTasks = [
  createMockTask({ 
    id: 'task-dishes',
    description: 'Wash dishes', 
    importance: 2, 
    urgency: 3,
    tags: ['chores', 'kitchen']
  }),
  createMockTask({ 
    id: 'task-laundry',
    description: 'Do laundry', 
    importance: 2, 
    urgency: 2,
    tags: ['chores', 'cleaning']
  }),
  createMockTask({ 
    id: 'task-vacuum',
    description: 'Vacuum living room', 
    importance: 2, 
    urgency: 2,
    tags: ['chores', 'cleaning']
  }),
  createMockTask({ 
    id: 'task-groceries',
    description: 'Buy groceries', 
    importance: 3, 
    urgency: 4,
    tags: ['errands', 'shopping']
  })
]

// Mock objectives
export const mockObjectives = [
  createMockObjective({ 
    id: 'obj-grades',
    description: 'Maintain good grades', 
    importance: 5 
  }),
  createMockObjective({ 
    id: 'obj-health',
    description: 'Stay healthy and active', 
    importance: 4 
  }),
  createMockObjective({ 
    id: 'obj-family',
    description: 'Spend quality time as a family', 
    importance: 5 
  })
]

// Mock recurring tasks
export const mockRecurringTasks = [
  createMockRecurringTask({
    id: 'recurring-piano',
    description: 'Piano practice',
    frequency: 'daily',
    last_completed_date: '2023-12-31'
  }),
  createMockRecurringTask({
    id: 'recurring-trash',
    description: 'Take out trash',
    frequency: 'weekly',
    last_completed_date: '2023-12-28'
  }),
  createMockRecurringTask({
    id: 'recurring-lawn',
    description: 'Mow the lawn',
    frequency: 'biweekly',
    last_completed_date: '2023-12-20'
  })
]

// Mock Anthropic response helper
export function createMockAnthropicResponse(content: any) {
  return {
    content: [{
      type: 'text',
      text: typeof content === 'string' ? content : JSON.stringify(content)
    }],
    usage: {
      input_tokens: Math.floor(Math.random() * 1000) + 100,
      output_tokens: Math.floor(Math.random() * 500) + 50
    }
  }
}

// Mock validation helpers
export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

export function validateTaskAssignment(assignment: any): boolean {
  const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'anytime_this_week', 'deck']
  return requiredDays.every(day => Array.isArray(assignment[day]))
}

// Test environment setup
export function setupTestEnvironment() {
  // Set test environment variables
  process.env.USE_NEW_PLANNING_SYSTEM = 'true'
  process.env.ORGANIZING_AGENT_MODEL = 'claude-test-model'
  process.env.SELECTION_AGENT_MODEL = 'claude-test-model'
  process.env.EDITING_AGENT_MODEL = 'claude-test-model'
  process.env.AGENT_DEFAULT_TIMEOUT = '5000'
  process.env.AGENT_MAX_RETRIES = '2'
}

// Clean up test environment
export function cleanupTestEnvironment() {
  // Clear environment variables
  delete process.env.USE_NEW_PLANNING_SYSTEM
  delete process.env.ORGANIZING_AGENT_MODEL
  delete process.env.SELECTION_AGENT_MODEL
  delete process.env.EDITING_AGENT_MODEL
  delete process.env.AGENT_DEFAULT_TIMEOUT
  delete process.env.AGENT_MAX_RETRIES
}