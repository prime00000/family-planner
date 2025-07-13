import { BaseAgent, AgentContext } from './base-agent'
import type {
  EditingAgentInput,
  EditingAgentOutput,
  CreatedElement,
  CompletedEdit,
  CompletedDeletion,
  VibePlanFile,
  TaskWithMetadata
} from './types'

export class EditingAgent extends BaseAgent {
  constructor() {
    super({
      model: process.env.EDITING_AGENT_MODEL || 'claude-3-7-sonnet-20241022',
      maxTokens: parseInt(process.env.EDITING_AGENT_MAX_TOKENS || '3000'),
      temperature: parseFloat(process.env.EDITING_AGENT_TEMPERATURE || '0.1'),
      timeout: parseInt(process.env.AGENT_DEFAULT_TIMEOUT || '20000'),
      maxRetries: parseInt(process.env.AGENT_MAX_RETRIES || '3')
    })
  }
  
  async execute(input: EditingAgentInput, context: AgentContext): Promise<EditingAgentOutput> {
    try {
      if (input.operation === 'generatePlan') {
        return this.generatePlan(input, context)
      } else {
        return this.executeEdits(input, context)
      }
    } catch (error) {
      this.handleError(error, 'Editing Agent')
    }
  }
  
  private async executeEdits(
    input: EditingAgentInput,
    context: AgentContext
  ): Promise<EditingAgentOutput> {
    const prompt = this.buildEditingPrompt(input)
    
    const response = await this.callAnthropic([
      {
        role: 'user',
        content: prompt
      }
    ])
    
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI')
    }
    
    const result = this.extractJSON<EditingAgentOutput>(content.text)
    
    // Validate the result
    this.validateEditingOutput(result, input)
    
    return result
  }
  
  private async generatePlan(
    input: EditingAgentInput,
    context: AgentContext
  ): Promise<EditingAgentOutput> {
    const prompt = this.buildPlanGenerationPrompt(input)
    
    const response = await this.callAnthropic([
      {
        role: 'user',
        content: prompt
      }
    ])
    
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI')
    }
    
    const result = this.extractJSON<EditingAgentOutput>(content.text)
    
    // Validate plan structure
    if (result.planJSON) {
      this.validatePlanStructure(result.planJSON)
    }
    
    return result
  }
  
  private buildEditingPrompt(input: EditingAgentInput): string {
    const { editingGuide, existingTasks, teamMembers, context } = input
    
    return `You are a precise task editor for the family planning system.

EDITING GUIDE:
${JSON.stringify(editingGuide, null, 2)}

EXISTING TASKS FOR REFERENCE:
${existingTasks.slice(0, 10).map(t => 
  `- ID: ${t.id} | ${t.description}`
).join('\n')}
${existingTasks.length > 10 ? `... and ${existingTasks.length - 10} more tasks` : ''}

TEAM CONTEXT:
- Team ID: ${context.teamId}
- Week starting: ${context.weekStartDate}
- Team members: ${teamMembers.map(m => m.name).join(', ')}

Execute the editing guide with these CRITICAL RULES:
1. For new elements, generate temporary IDs like "temp-${Date.now()}-1"
2. Include team_id: "${context.teamId}" for all new elements
3. Include submitted_by: "${context.userId}" for all new elements
4. ONLY populate fields explicitly mentioned (leave others as null)
5. Check for duplicates before creating new tasks
6. Validate all modifications against existing tasks

Return ONLY a JSON object with this structure:
{
  "changes": {
    "newElements": [
      {
        "tempId": "temp-123456-1",
        "type": "task",
        "data": {
          "description": "Complete homework assignment",
          "importance": 4,
          "urgency": 5,
          "tags": ["school", "homework"],
          "team_id": "${context.teamId}",
          "submitted_by": "${context.userId}"
        }
      }
    ],
    "modifications": [
      {
        "elementId": "existing-task-id",
        "changes": {
          "urgency": 5,
          "description": "Updated description"
        },
        "validation": {
          "found": true,
          "applied": true
        }
      }
    ],
    "deletions": [
      {
        "elementId": "task-to-delete-id",
        "validation": {
          "found": true,
          "deleted": true
        }
      }
    ],
    "validationIssues": []
  },
  "summary": {
    "elementsCreated": 1,
    "elementsModified": 1,
    "elementsDeleted": 1,
    "validationErrors": 0,
    "validationWarnings": 0
  }
}

VALIDATION RULES:
- Verify element exists before modifying/deleting
- Check for duplicate descriptions before creating
- Ensure all required fields are present
- Add validation issues for any problems found`
  }
  
  private buildPlanGenerationPrompt(input: EditingAgentInput): string {
    const { planData, teamMembers, context } = input
    
    if (!planData) {
      throw new Error('Plan data required for plan generation')
    }
    
    const { selectedTasks, assignments, title, metadata } = planData
    
    // Create task map for easy lookup
    const taskMap = new Map(selectedTasks.map(t => [t.id, t]))
    
    return `You are generating the final VibePlanFile JSON for the weekly plan.

SELECTED TASKS WITH ASSIGNMENTS:
${assignments.map(a => {
  const task = taskMap.get(a.taskId)
  return task ? `- ${task.description} → ${a.assignTo} on ${a.scheduleFor}` : null
}).filter(Boolean).join('\n')}

TEAM MEMBERS:
${teamMembers.map(m => `- ${m.name} (ID: ${m.id})`).join('\n')}

PLAN METADATA:
- Title: ${title || 'Weekly Plan'}
- Week starting: ${context.weekStartDate}
- Total tasks: ${selectedTasks.length}

Generate a complete VibePlanFile with these CRITICAL RULES:
1. Use exact UUIDs as keys in assignments object (NEVER use names)
2. Each user must have all day arrays (even if empty)
3. Include accurate statistics
4. Validate all assignee_id values are actual UUIDs

Return ONLY a JSON object with this structure:
{
  "changes": {
    "newElements": [],
    "modifications": [],
    "deletions": [],
    "validationIssues": []
  },
  "planJSON": {
    "title": "${title || 'Weekly Plan'}",
    "assignments": {
      "${teamMembers[0]?.id || 'user-uuid'}": {
        "user_name": "${teamMembers[0]?.name || 'User Name'}",
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": [],
        "anytime_this_week": [],
        "deck": []
      }
    },
    "metadata": {
      "priorityGuidance": "${metadata?.priorityGuidance || ''}",
      "generatedAt": "${new Date().toISOString()}",
      "version": 1
    },
    "statistics": {
      "total_tasks": ${selectedTasks.length},
      "tasks_per_person": {},
      "high_priority_count": 0,
      "scheduled_tasks_count": 0
    }
  },
  "summary": {
    "elementsCreated": 0,
    "elementsModified": 0,
    "elementsDeleted": 0,
    "validationErrors": 0,
    "validationWarnings": 0
  }
}

IMPORTANT TASK STRUCTURE:
Each task in the day arrays must have:
{
  "id": "unique-task-id",
  "description": "task description",
  "importance": 1-5,
  "urgency": 1-5,
  "tags": ["tag1", "tag2"],
  "source": "task",
  "scheduledTime": {  // optional
    "start": "HH:MM",
    "duration": minutes
  }
}

CRITICAL VALIDATION:
- Every team member must be included with their UUID as key
- All day arrays must be present for each user
- Task counts in statistics must be accurate
- High priority = importance >= 4 OR urgency >= 4`
  }
  
  private validateEditingOutput(output: EditingAgentOutput, input: EditingAgentInput): void {
    // Validate new elements have required fields
    output.changes.newElements.forEach(element => {
      if (!element.data.description) {
        throw new Error(`New ${element.type} missing description`)
      }
      if (!element.data.team_id) {
        throw new Error(`New ${element.type} missing team_id`)
      }
    })
    
    // Validate modifications reference existing tasks
    const existingIds = new Set(input.existingTasks.map(t => t.id))
    output.changes.modifications.forEach(mod => {
      if (!existingIds.has(mod.elementId) && !mod.validation.found) {
        if (!output.changes.validationIssues) {
          output.changes.validationIssues = []
        }
        output.changes.validationIssues.push({
          type: 'error',
          field: 'elementId',
          message: `Task ${mod.elementId} not found`
        })
      }
    })
  }
  
  private validatePlanStructure(plan: VibePlanFile): void {
    // Validate all assignment keys are UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    Object.keys(plan.assignments).forEach(userId => {
      if (!uuidRegex.test(userId)) {
        throw new Error(`Invalid UUID in assignments: ${userId}`)
      }
      
      // Validate each user has all required days
      const userPlan = plan.assignments[userId]
      const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'anytime_this_week', 'deck']
      
      requiredDays.forEach(day => {
        if (!Array.isArray((userPlan as any)[day])) {
          throw new Error(`User ${userId} missing ${day} array`)
        }
      })
    })
    
    // Validate metadata
    if (!plan.metadata || !plan.metadata.generatedAt) {
      throw new Error('Plan missing required metadata')
    }
    
    // Validate statistics
    if (!plan.statistics || typeof plan.statistics.total_tasks !== 'number') {
      throw new Error('Plan missing required statistics')
    }
  }
}