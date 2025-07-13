import { BaseAgent, AgentContext } from './base-agent'
import type {
  SelectionAgentInput,
  SelectionAgentOutput,
  TaskPriority,
  SelectionReasoning
} from './types'

export class SelectionAgent extends BaseAgent {
  constructor() {
    super({
      model: process.env.SELECTION_AGENT_MODEL || 'claude-opus-4-20250514',
      maxTokens: parseInt(process.env.SELECTION_AGENT_MAX_TOKENS || '4000'),
      temperature: parseFloat(process.env.SELECTION_AGENT_TEMPERATURE || '0.3'),
      timeout: parseInt(process.env.AGENT_DEFAULT_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.AGENT_MAX_RETRIES || '3')
    })
  }
  
  async execute(input: SelectionAgentInput, context: AgentContext): Promise<SelectionAgentOutput> {
    try {
      const prompt = this.buildSelectionPrompt(input)
      
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
      
      const result = this.extractJSON<SelectionAgentOutput>(content.text)
      
      // Validate capacity utilization
      this.validateCapacityUtilization(result, input.teamCapacity)
      
      return result
      
    } catch (error) {
      this.handleError(error, 'Selection Agent')
    }
  }
  
  private buildSelectionPrompt(input: SelectionAgentInput): string {
    const { availableTasks, selectionCriteria, priorities, teamCapacity, context } = input
    
    // Calculate total capacity
    const totalCapacity = Object.values(teamCapacity).reduce((sum, member) => sum + member.maxTasks, 0)
    const targetMin = Math.floor(totalCapacity * 0.7)
    const targetMax = Math.floor(totalCapacity * 0.85)
    
    return `You are a task selection specialist optimizing the weekly plan for the Theobald family.

WEEK STARTING: ${context.weekStartDate}

AVAILABLE TASKS (${availableTasks.length} total):
${availableTasks.map(t => 
  `- ID: ${t.id} | ${t.description} (importance: ${t.importance || 0}, urgency: ${t.urgency || 0}, tags: ${t.tags?.join(', ') || 'none'})`
).join('\n')}

TEAM CAPACITY:
${Object.entries(teamCapacity).map(([userId, member]) => 
  `- ${member.name}: ${member.currentLoad}/${member.maxTasks} tasks (${member.skills?.join(', ') || 'general'})`
).join('\n')}
Total capacity: ${totalCapacity} tasks
Target utilization: ${targetMin}-${targetMax} tasks (70-85%)

SELECTION PRIORITIES:
${priorities.map(p => 
  `- ${p.type.toUpperCase()}: ${p.target} (weight: ${p.weight})`
).join('\n')}

SELECTION CRITERIA:
Must include: ${selectionCriteria.mustIncludeTasks.join(', ') || 'none'}
Preferred: ${selectionCriteria.preferredTasks.join(', ') || 'none'}
Avoid: ${selectionCriteria.avoidTasks.join(', ') || 'none'}

${selectionCriteria.capacityGuidance ? `
CAPACITY GUIDANCE:
${Object.entries(selectionCriteria.capacityGuidance).map(([userId, guide]) => 
  `- ${guide.maxTasks} tasks max, focus: ${guide.focusAreas.join(', ')}`
).join('\n')}
` : ''}

Your selection MUST follow this priority hierarchy:
1. Admin's planning priorities (40% weight) - HIGHEST PRIORITY
2. Importance/urgency scores (20% weight)
3. Skill matching (20% weight)
4. Dependencies/blockers (10% weight)
5. Workload balance (10% weight)

SELECTION RULES:
- Target 70-85% capacity utilization (NEVER exceed 85%)
- Include all "must include" tasks
- Prioritize tasks matching the admin's focus areas
- Include 20%+ quick wins for momentum
- Balance urgent vs important tasks
- Consider task dependencies
- Leave buffer for unexpected tasks

Return ONLY a JSON object with this structure:
{
  "selectedTaskIds": ["task-id-1", "task-id-2"],
  "taskPriorities": {
    "task-id-1": {
      "taskId": "task-id-1",
      "score": 95,
      "rationale": "High urgency homework task directly matches admin priority",
      "suggestedTiming": "early-week",
      "suggestedAssignee": "user-id"
    }
  },
  "deferredTaskIds": ["task-id-3", "task-id-4"],
  "reasoning": {
    "totalAvailable": ${availableTasks.length},
    "totalSelected": 25,
    "capacityUtilization": {
      "user-id-1": {
        "assigned": 10,
        "capacity": 15,
        "percentage": 67
      }
    },
    "priorityAlignment": "Selected tasks align with homework focus (15/25 tasks)",
    "deferralReasons": {
      "task-id-3": "Low priority, no alignment with current focus",
      "task-id-4": "Would exceed 85% capacity threshold"
    }
  },
  "warnings": []
}

IMPORTANT:
- Calculate priority scores 0-100 based on alignment with priorities
- Suggest timing: "early-week" (Mon-Tue), "mid-week" (Wed-Thu), "late-week" (Fri-Sun)
- Only suggest assignees if there's a clear skill match
- Include warnings if must-include tasks would exceed capacity`
  }
  
  private validateCapacityUtilization(
    result: SelectionAgentOutput,
    teamCapacity: SelectionAgentInput['teamCapacity']
  ): void {
    const totalCapacity = Object.values(teamCapacity).reduce((sum, member) => sum + member.maxTasks, 0)
    const utilizationRate = (result.selectedTaskIds.length / totalCapacity) * 100
    
    if (utilizationRate > 85) {
      console.warn(`Capacity utilization ${utilizationRate.toFixed(1)}% exceeds 85% target`)
      if (!result.warnings) {
        result.warnings = []
      }
      result.warnings.push(`High capacity utilization: ${utilizationRate.toFixed(1)}%`)
    }
    
    if (utilizationRate < 70) {
      console.warn(`Capacity utilization ${utilizationRate.toFixed(1)}% below 70% target`)
      if (!result.warnings) {
        result.warnings = []
      }
      result.warnings.push(`Low capacity utilization: ${utilizationRate.toFixed(1)}%`)
    }
  }
}