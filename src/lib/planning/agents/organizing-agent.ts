import { BaseAgent, AgentContext } from './base-agent'
import type {
  OrganizingAgentInput,
  OrganizingAgentOutput,
  OrganizingAgentDialogueOutput,
  OrganizingAgentExecutionOutput
} from './types'

export class OrganizingAgent extends BaseAgent {
  constructor() {
    super({
      model: process.env.ORGANIZING_AGENT_MODEL || 'claude-opus-4-20250514',
      maxTokens: parseInt(process.env.ORGANIZING_AGENT_MAX_TOKENS || '4000'),
      temperature: parseFloat(process.env.ORGANIZING_AGENT_TEMPERATURE || '0.2'),
      timeout: parseInt(process.env.AGENT_DEFAULT_TIMEOUT || '25000'),
      maxRetries: parseInt(process.env.AGENT_MAX_RETRIES || '3')
    })
  }
  
  async execute(input: OrganizingAgentInput, context: AgentContext): Promise<OrganizingAgentOutput> {
    if (input.phase === 'dialogue' || !input.phase) {
      return this.conductDialogue(input, context)
    } else {
      return this.executeExecution(input, context)
    }
  }
  
  private async conductDialogue(
    input: OrganizingAgentInput,
    context: AgentContext
  ): Promise<OrganizingAgentDialogueOutput> {
    try {
      const prompt = this.buildDialoguePrompt(input)
      
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
      
      const result = this.extractJSON<OrganizingAgentDialogueOutput>(content.text)
      return result
      
    } catch (error) {
      this.handleError(error, 'Organizing Agent dialogue phase')
    }
  }
  
  private buildDialoguePrompt(input: OrganizingAgentInput): string {
    const { adminInstructions, context } = input
    const { teamMembers, availableBacklog, activeObjectives, precedingPlans, recurringTasksDue } = context
    
    return `You are a professional family planning assistant helping to organize weekly tasks for the Theobald family. Your role is to understand the admin's planning priorities and propose a clear approach.

CONTEXT:
- Week starting: ${context.weekStartDate}
- Team members: ${teamMembers.map(m => `${m.name} (ID: ${m.id})`).join(', ')}
- Backlog tasks available: ${availableBacklog.length}
- Active objectives: ${activeObjectives.length}
- Recurring tasks due: ${recurringTasksDue.length}

${precedingPlans.length > 0 ? `
RECENT PLANNING HISTORY:
${precedingPlans.slice(0, 2).map(p => 
  `- Week of ${p.week_start_date}: "${p.title}" (${p.task_count} tasks, ${p.completion_rate || 0}% complete)`
).join('\n')}
` : ''}

ADMIN'S PLANNING REQUEST:
"${adminInstructions}"

${availableBacklog.length > 0 ? `
SAMPLE BACKLOG TASKS:
${availableBacklog.slice(0, 5).map(t => 
  `- ${t.description} (importance: ${t.importance || 'not set'}, urgency: ${t.urgency || 'not set'})`
).join('\n')}
${availableBacklog.length > 5 ? `... and ${availableBacklog.length - 5} more tasks` : ''}
` : ''}

${activeObjectives.length > 0 ? `
ACTIVE OBJECTIVES:
${activeObjectives.map(o => 
  `- ${o.description} (importance: ${o.importance || 'not set'})`
).join('\n')}
` : ''}

Your task is to analyze the admin's request and propose a planning approach. Consider:
1. What are the key priorities based on their instructions?
2. What strategy would best achieve their goals?
3. Are there any ambiguities that need clarification?
4. What would be a balanced workload distribution?

Return ONLY a JSON object with this structure:
{
  "proposedApproach": {
    "summary": "A 1-2 sentence summary of your proposed approach",
    "priorities": [
      "First priority based on admin instructions",
      "Second priority",
      "Additional priorities as needed"
    ],
    "strategy": "Detailed explanation of how you'll approach the planning (2-3 sentences)",
    "questionsForAdmin": [
      "Any clarifying questions if the instructions are ambiguous (optional)"
    ]
  },
  "identifiedTasks": {
    "newItems": [
      {
        "type": "task",
        "description": "New task that needs to be created based on admin request",
        "metadata": {
          "importance": 3,
          "urgency": 4,
          "tags": ["relevant", "tags"]
        }
      }
    ],
    "modificationsNeeded": [
      {
        "targetId": "existing-task-id",
        "operation": "modify",
        "changes": {
          "description": "Updated description if needed"
        },
        "reasoning": "Why this change is needed"
      }
    ],
    "estimatedWorkload": {
      "user-id-1": {
        "name": "User Name",
        "estimatedHours": 5,
        "taskCount": 10
      }
    }
  },
  "needsClarification": false
}

Important notes:
- Set needsClarification to true ONLY if the admin's instructions are genuinely unclear
- Propose new tasks only if explicitly mentioned in the admin's request
- Focus on understanding their priorities and planning approach
- Be concise and actionable`
  }
  
  private async executeExecution(
    input: OrganizingAgentInput,
    context: AgentContext
  ): Promise<OrganizingAgentExecutionOutput> {
    try {
      const prompt = this.buildExecutionPrompt(input)
      
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
      
      const result = this.extractJSON<OrganizingAgentExecutionOutput>(content.text)
      return result
      
    } catch (error) {
      this.handleError(error, 'Organizing Agent execution phase')
    }
  }
  
  private buildExecutionPrompt(input: OrganizingAgentInput): string {
    const { adminInstructions, context, adminApproval } = input
    const { teamMembers, availableBacklog, activeObjectives, recurringTasksDue } = context
    
    return `You are now executing the approved planning approach for the Theobald family.

APPROVED APPROACH:
${adminApproval?.approved ? 'Admin approved the approach' : 'Proceeding with plan'}
${adminApproval?.adjustments ? `Admin adjustments: "${adminApproval.adjustments}"` : ''}

ORIGINAL REQUEST:
"${adminInstructions}"

CONTEXT:
- Week starting: ${context.weekStartDate}
- Team members: ${teamMembers.map(m => `${m.name} (ID: ${m.id})`).join(', ')}
- Available backlog tasks: ${availableBacklog.length}
- Active objectives: ${activeObjectives.length}
- Recurring tasks due: ${recurringTasksDue.length}

${availableBacklog.length > 0 ? `
BACKLOG TASKS:
${availableBacklog.map(t => 
  `- ID: ${t.id} | ${t.description} (importance: ${t.importance || 0}, urgency: ${t.urgency || 0})`
).join('\n')}
` : ''}

Your task is to prepare execution guides for other agents:

1. CATEGORIZE the admin's instructions into:
   - Priority indicators (what to focus on/avoid)
   - New content to create
   - Edits to existing items
   - Assignment preferences

2. CREATE GUIDES:
   - Editing guide for new/modified items
   - Selection criteria for choosing tasks
   - Capacity guidance per team member

3. DETERMINE NEXT PHASE based on what needs to be done

Return ONLY a JSON object with this structure:
{
  "categorization": {
    "priorities": [
      {
        "type": "focus",
        "target": "homework tasks",
        "weight": 0.8,
        "reasoning": "Admin specifically mentioned homework"
      }
    ],
    "newContent": [
      {
        "type": "task",
        "description": "Complete the science project",
        "metadata": {
          "importance": 4,
          "urgency": 5,
          "tags": ["school", "project"]
        }
      }
    ],
    "editRequests": [
      {
        "targetId": "existing-task-id",
        "operation": "modify",
        "changes": {
          "urgency": 5
        },
        "reasoning": "Admin said this is now urgent"
      }
    ],
    "assignmentChanges": []
  },
  "editingGuide": {
    "newElements": [
      {
        "type": "task",
        "description": "Complete the science project",
        "metadata": {
          "importance": 4,
          "urgency": 5,
          "tags": ["school", "project"]
        }
      }
    ],
    "modifications": [],
    "deletions": []
  },
  "selectionCriteria": {
    "mustIncludeTasks": ["task-id-1", "task-id-2"],
    "preferredTasks": ["task-id-3"],
    "avoidTasks": [],
    "capacityGuidance": {
      "user-id": {
        "maxTasks": 15,
        "focusAreas": ["homework", "chores"]
      }
    }
  },
  "selectionNotes": [
    "Focus on school-related tasks",
    "Balance workload across week"
  ],
  "nextPhase": "editing"
}

IMPORTANT:
- nextPhase should be "editing" if new items need creation, "selection" if only choosing from backlog
- Use actual task IDs from the backlog when referencing tasks
- Set realistic maxTasks based on age and availability
- Only include editingGuide if there are actual edits needed`
  }
  
  async assignTasks(
    selectedTasks: string[],
    teamMembers: any[],
    context: any
  ): Promise<any> {
    try {
      const prompt = this.buildAssignmentPrompt(selectedTasks, teamMembers, context)
      
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
      
      return this.extractJSON(content.text)
      
    } catch (error) {
      this.handleError(error, 'Organizing Agent assignment phase')
    }
  }
  
  private buildAssignmentPrompt(
    selectedTaskIds: string[],
    tasks: any[],
    context: any
  ): string {
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    const selectedTasks = selectedTaskIds.map(id => taskMap.get(id)).filter(Boolean)
    
    return `You are assigning the selected tasks to team members and days of the week.

SELECTED TASKS (${selectedTasks.length}):
${selectedTasks.map(t => 
  `- ${t.id}: ${t.description} (importance: ${t.importance || 0}, urgency: ${t.urgency || 0})`
).join('\n')}

TEAM MEMBERS:
${context.teamMembers.map((m: any) => 
  `- ${m.name} (ID: ${m.id}) - ${m.role || 'member'}`
).join('\n')}

Week starting: ${context.weekStartDate}

Assign each task to:
1. A specific person based on their age, skills, and availability
2. A specific day (monday-sunday) or "anytime_this_week" or "deck"

Consider:
- Age-appropriate assignments (don't give complex tasks to young children)
- School schedule (kids have less time Mon-Fri)
- Urgency (urgent tasks early in week)
- Balance workload across days
- Family members' typical responsibilities

Return a JSON object with this structure:
{
  "assignments": [
    {
      "taskId": "task-id",
      "assignTo": "user-id",
      "scheduleFor": "monday",
      "reasoning": "Kurt handles tech tasks, scheduled early for urgency"
    }
  ],
  "summary": {
    "byPerson": {
      "user-id": {
        "name": "Person Name",
        "taskCount": 5,
        "days": ["monday", "wednesday", "friday"]
      }
    },
    "byDay": {
      "monday": 3,
      "tuesday": 2
    }
  }
}

IMPORTANT:
- Use actual user IDs and task IDs
- Valid days: monday, tuesday, wednesday, thursday, friday, saturday, sunday, anytime_this_week, deck
- Every selected task must be assigned`
  }
  
  async interpretSelectionAdjustment(
    command: string,
    currentSelection: any,
    context: AgentContext
  ): Promise<any> {
    try {
      const prompt = this.buildSelectionAdjustmentPrompt(command, currentSelection, context)
      
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
      
      return this.extractJSON(content.text)
      
    } catch (error) {
      this.handleError(error, 'Organizing Agent selection adjustment')
    }
  }
  
  private buildSelectionAdjustmentPrompt(
    command: string,
    currentSelection: any,
    context: AgentContext
  ): string {
    return `You are helping adjust task selections based on an admin's natural language command.

CURRENT SELECTION:
- Total tasks selected: ${currentSelection.selectedTasks.length}
- Total hours: ${currentSelection.metrics.totalEstimatedHours}
- Capacity utilization: ${currentSelection.metrics.capacityUtilization}%
- Priority distribution: High: ${currentSelection.metrics.priorityDistribution.high}, Medium: ${currentSelection.metrics.priorityDistribution.medium}, Low: ${currentSelection.metrics.priorityDistribution.low}

SELECTED TASKS:
${currentSelection.selectedTasks.map((t: any) => 
  `- ${t.task.id}: ${t.task.description} (priority: ${t.priority}, ${t.estimatedHours}h)`
).join('\n')}

DESELECTED TASKS AVAILABLE:
${currentSelection.deselectedTasks.map((t: any) => 
  `- ${t.task.id}: ${t.task.description} (reason: ${t.deselectionReason})`
).join('\n')}

ADMIN COMMAND:
"${command}"

Interpret this command and determine what changes to make. Consider:
1. What tasks should be added from the deselected list?
2. What tasks should be removed from the selected list?
3. What priority changes should be made?
4. Is this a rebalancing request?

Return a JSON object with this structure:
{
  "interpretation": {
    "action": "add|remove|reprioritize|rebalance|custom",
    "targets": ["task-ids or categories"],
    "parameters": {
      "priority": "high|medium|low",
      "tags": ["specific-tags"],
      "people": ["person-names"]
    }
  },
  "changes": {
    "addedTaskIds": ["task-id-1", "task-id-2"],
    "removedTaskIds": ["task-id-3"],
    "priorityChanges": {
      "task-id-4": "high",
      "task-id-5": "low"
    },
    "rebalancingNotes": "Explanation if rebalancing was done"
  },
  "explanation": "Clear explanation of what changes were made and why",
  "warnings": ["Any concerns about the changes"]
}

Examples of commands:
- "Add all homework tasks" -> Find and add tasks with homework/school tags
- "Remove low priority maintenance" -> Remove tasks that are low priority and have maintenance tags
- "Make all urgent tasks high priority" -> Change priority based on urgency
- "Balance the workload better" -> Adjust selections to even out capacity

IMPORTANT:
- Only reference task IDs that actually exist in the lists
- Respect capacity limits when adding tasks
- Provide clear explanations for the admin`
  }
  
  async interpretAssignmentAdjustment(
    command: string,
    currentAssignments: any,
    context: AgentContext
  ): Promise<any> {
    try {
      const prompt = this.buildAssignmentAdjustmentPrompt(command, currentAssignments, context)
      
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
      
      return this.extractJSON(content.text)
      
    } catch (error) {
      this.handleError(error, 'Organizing Agent assignment adjustment')
    }
  }
  
  private buildAssignmentAdjustmentPrompt(
    command: string,
    currentAssignments: any,
    context: AgentContext
  ): string {
    return `You are helping adjust task assignments based on an admin's natural language command.

CURRENT ASSIGNMENTS BY PERSON:
${Object.entries(currentAssignments.assignmentsByPerson).map(([id, data]: any) => 
  `- ${data.member.name}: ${data.totalTasks} tasks, ${data.totalEstimatedHours.toFixed(1)}h, workload: ${data.workloadRating}`
).join('\n')}

CURRENT ASSIGNMENTS BY DAY:
${Object.entries(currentAssignments.assignmentsByDay).map(([day, data]: any) => 
  `- ${day}: ${data.totalTasks} tasks, ${data.totalEstimatedHours.toFixed(1)}h`
).join('\n')}

ADMIN COMMAND:
"${command}"

Interpret this command and determine what reassignments to make. Consider:
1. Person-to-person reassignments
2. Day-to-day rescheduling
3. Workload balancing
4. Moving tasks to deck

Return a JSON object with this structure:
{
  "interpretation": {
    "action": "reassign|balance|compress|spread|swap|custom",
    "targets": {
      "people": ["person-ids"],
      "days": ["day-names"],
      "tasks": ["task-ids"]
    },
    "constraints": {
      "maxPerDay": 5,
      "avoidDays": ["wednesday"]
    }
  },
  "changes": {
    "reassignments": [
      {
        "taskId": "task-id",
        "fromPerson": "user-id-1",
        "toPerson": "user-id-2",
        "fromDay": "monday",
        "toDay": "tuesday",
        "reason": "Balancing Kurt's Monday workload"
      }
    ],
    "workloadChanges": {
      "user-id-1": {
        "before": 10,
        "after": 8
      }
    }
  },
  "explanation": "Clear explanation of the reassignments made",
  "warnings": ["Any concerns about the new assignments"]
}

Examples of commands:
- "Give Kurt more technical tasks" -> Find tech tasks assigned to others and reassign to Kurt
- "Balance Jessica's Monday" -> Move some of Jessica's Monday tasks to other days
- "No tasks for kids on Wednesday" -> Move all children's Wednesday tasks to other days
- "Compress everything into 3 days" -> Consolidate all tasks into Mon/Tue/Wed

IMPORTANT:
- Maintain task validity (don't assign adult tasks to children)
- Keep workloads reasonable
- Explain the reasoning for each change`
  }
}