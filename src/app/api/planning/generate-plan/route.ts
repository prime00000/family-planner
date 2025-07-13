import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { VibePlanFile } from '@/app/admin/planning/phase3/types'
import { TEAM_ID } from '@/lib/constants'
import { AgentOrchestrator } from '@/lib/planning/agents/agent-orchestrator'

// Using Claude Sonnet 3.7 - excellent balance of capability and speed
// Can override with ANTHROPIC_MODEL env var if needed
const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-20250219"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Task {
  id: string
  description: string
  importance?: number
  urgency?: number
}

interface Objective {
  id: string
  description: string
  importance?: number
}

interface MaintenanceItem {
  id: string
  description: string
  frequency?: string
}

interface TeamMember {
  id: string
  name: string
  email: string
}

interface GeneratePlanRequest {
  priorityGuidance?: string
  incompleteTasks: Task[]
  newItems: {
    objectives: Objective[]
    tasks: Task[]
    maintenance: MaintenanceItem[]
  }
  teamMembers: TeamMember[]
}


// Helper function to sanitize AI response
function sanitizeAIResponse(response: string): string {
  // Remove markdown code blocks
  response = response.replace(/```json\s*/gi, '').replace(/```\s*/gi, '')
  
  // Remove any text before first { and after last }
  const firstBrace = response.indexOf('{')
  const lastBrace = response.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) {
    response = response.substring(firstBrace, lastBrace + 1)
  }
  
  // Remove any leading/trailing whitespace
  response = response.trim()
  
  // Log what we're sanitizing
  console.log('Sanitized response preview:', response.substring(0, 200) + '...')
  
  return response
}

// Helper function to validate the plan structure
function validateVibePlanFile(data: any): boolean {
  if (!data || typeof data !== 'object') {
    console.error('Response is not an object')
    return false
  }
  
  if (!data.assignments || typeof data.assignments !== 'object') {
    console.error('Missing or invalid assignments')
    return false
  }
  
  // Check each user has all required days
  for (const [userId, userPlan] of Object.entries(data.assignments)) {
    const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'anytime_this_week', 'deck']
    for (const day of requiredDays) {
      if (!Array.isArray((userPlan as any)[day])) {
        console.error(`User ${userId} missing or invalid ${day} array`)
        return false
      }
    }
    
    // Check user_name exists
    if (!(userPlan as any).user_name) {
      console.error(`User ${userId} missing user_name`)
      return false
    }
  }
  
  // Check metadata
  if (!data.metadata || typeof data.metadata !== 'object') {
    console.error('Missing or invalid metadata')
    return false
  }
  
  // Check statistics
  if (!data.statistics || typeof data.statistics !== 'object') {
    console.error('Missing or invalid statistics')
    return false
  }
  
  console.log('Validation passed')
  return true
}

const FAMILY_CONTEXT = `
You are planning tasks for the Theobald family:
- Kurt (adult, father): Tech professional, handles complex work tasks and family planning
- Jessica (adult, mother): Manages household, education oversight, and family logistics
- Barb (adult, grandmother): Helps with household tasks and grandchildren activities
- Benjamin (18): College student, can handle adult-level responsibilities
- Eliana (16): High school student, can handle moderate responsibilities
- Elikai (14): Middle school student, lighter workload
- Konrad (12): Elementary student, age-appropriate tasks only
- Avi Grace (10): Elementary student, simple age-appropriate tasks only

Consider:
- Age-appropriate task distribution
- School schedules (kids have less availability Mon-Fri)
- Balance workload fairly
- Adults can handle more complex/urgent tasks
- Younger children need simpler, shorter tasks
`

function createTaskPrompt(params: GeneratePlanRequest & { teamMembersWithUUIDs: TeamMember[] }): string {
  const { priorityGuidance, incompleteTasks, newItems, teamMembersWithUUIDs } = params
  
  // Create example UUIDs for the prompt
  const exampleUUID1 = teamMembersWithUUIDs[0]?.id || '86f09a81-66c9-483b-9667-2ef9937b1119'
  const exampleUUID2 = teamMembersWithUUIDs[1]?.id || 'b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7'
  const exampleName1 = teamMembersWithUUIDs[0]?.name || 'First User'
  const exampleName2 = teamMembersWithUUIDs[1]?.name || 'Second User'
  
  const prompt = `You are a family task planning AI. Create a weekly task plan for the Theobald family.

${FAMILY_CONTEXT}

Team members available with their UUIDs:
${teamMembersWithUUIDs.map(m => `- UUID: ${m.id} | Name: ${m.name} | Email: ${m.email}`).join('\n')}

CRITICAL INSTRUCTION: You MUST use the exact UUID as the key in the assignments object.
WRONG EXAMPLE: "kurt": { ... }
CORRECT EXAMPLE: "${exampleUUID1}": { ... }

${priorityGuidance ? `Admin priority guidance: ${priorityGuidance}\n` : ''}

Incomplete tasks from previous weeks (consider including these):
${incompleteTasks.map(t => `- ${t.description} (importance: ${t.importance || 'not set'}, urgency: ${t.urgency || 'not set'})`).join('\n')}

New objectives to work towards:
${newItems.objectives.map(o => `- ${o.description} (importance: ${o.importance || 'not set'})`).join('\n')}

New tasks to assign:
${newItems.tasks.map(t => `- ${t.description} (importance: ${t.importance || 'not set'}, urgency: ${t.urgency || 'not set'})`).join('\n')}

Maintenance items to schedule:
${newItems.maintenance.map(m => `- ${m.description} (frequency: ${m.frequency || 'as needed'})`).join('\n')}

Create a balanced weekly plan. For each person, assign tasks to specific days (Monday-Friday) or mark as "anytime_this_week" for flexible tasks. You can also put lower priority tasks in their "deck" for later.

IMPORTANT: Create an entry in the assignments object for EACH team member listed above using their exact UUID as the key. Do not use names as keys.

CRITICAL: Your response must be ONLY a valid JSON object. No markdown, no code blocks, no explanations before or after the JSON.

Return EXACTLY this structure (starting with { and ending with }):
{
  "title": "Suggested plan title that captures the week's theme or main focus",
  "assignments": {
    "${exampleUUID1}": {
      "user_name": "${exampleName1}",
      "monday": [
        {
          "id": "task-${Date.now()}-1",
          "description": "Complete homework assignment",
          "importance": 4,
          "urgency": 5,
          "tags": ["school", "high-priority"],
          "source": "task"
        }
      ],
      "tuesday": [],
      "wednesday": [],
      "thursday": [],
      "friday": [],
      "saturday": [],
      "sunday": [],
      "anytime_this_week": [],
      "deck": []
    },
    "${exampleUUID2}": {
      "user_name": "${exampleName2}",
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
    "priorityGuidance": "${priorityGuidance || 'No specific guidance provided'}",
    "generatedAt": "${new Date().toISOString()}",
    "version": 1
  },
  "statistics": {
    "total_tasks": ${incompleteTasks.length + newItems.tasks.length + newItems.objectives.length + newItems.maintenance.length},
    "tasks_per_person": {
      "${exampleUUID1}": 1,
      "${exampleUUID2}": 0
    },
    "high_priority_count": 1,
    "scheduled_tasks_count": 1
  }
}

Each task should have:
{
  "id": "unique-id",
  "description": "task description",
  "importance": 1-5,
  "urgency": 1-5,
  "tags": ["tag1", "tag2"],
  "source": "task" | "objective" | "maintenance",
  "scheduledTime": { // optional
    "start": "HH:MM",
    "duration": minutes
  }
}

Rules for JSON generation:
- Each day array contains task objects
- All fields shown are required
- NO comments allowed in JSON
- NO trailing commas
- Use double quotes only
- Response starts with { and ends with }
- Each task must have: id, description, importance (1-5), urgency (1-5), tags (array), source

Important task assignment rules:
- Balance workload by age and availability
- School-age children should have fewer tasks on weekdays
- High importance/urgency tasks should go to adults
- Keep task descriptions clear and actionable
- Use appropriate tags like "school", "home", "work", "family"

Remember: Return ONLY the JSON object. Do not include any text before the { or after the closing }`

  return prompt
}

export async function POST(request: NextRequest) {
  console.log('=== GENERATE PLAN API CALLED ===')
  console.log('USE_NEW_PLANNING_SYSTEM env var:', process.env.USE_NEW_PLANNING_SYSTEM)
  console.log('Is new system enabled?:', process.env.USE_NEW_PLANNING_SYSTEM === 'true')
  console.log('API key present:', !!process.env.ANTHROPIC_API_KEY)
  console.log('Using AI model:', AI_MODEL)
  
  try {
    const body = await request.json() as GeneratePlanRequest

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }
    
    // Check if we should use the new planning system
    if (process.env.USE_NEW_PLANNING_SYSTEM === 'true') {
      return handleNewPlanningSystem(request, body)
    }
    
    // Use legacy system
    return legacyPlanGeneration(body)
  } catch (error) {
    console.error('Error generating plan:', error)
    console.error('Error details:', {
      type: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      anthropicKeyPresent: !!process.env.ANTHROPIC_API_KEY,
      supabaseUrlPresent: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate plan' },
      { status: 500 }
    )
  }
}

// Handler for the new multi-agent planning system
async function handleNewPlanningSystem(
  request: NextRequest,
  body: GeneratePlanRequest
): Promise<NextResponse> {
  console.log('Using new multi-agent planning system')
  
  try {
    // Get user ID from session/auth (simplified for now)
    const userId = request.headers.get('x-user-id') || 'system'
    
    // Prepare data in the format the orchestrator expects
    const teamMembers = body.teamMembers.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email
    }))
    
    const availableBacklog = [
      ...body.incompleteTasks.map(t => ({
        ...t,
        tags: [] as string[],
        status: 'active' as const
      })),
      ...body.newItems.tasks.map(t => ({
        ...t,
        id: `new-task-${Date.now()}-${Math.random()}`,
        tags: [] as string[],
        status: 'new' as const
      }))
    ]
    
    const activeObjectives = body.newItems.objectives
    
    // Convert maintenance items to recurring tasks
    const recurringTasksDue = body.newItems.maintenance.map(m => ({
      id: m.id,
      description: m.description,
      frequency: m.frequency || 'weekly',
      last_completed_date: null,
      next_due_date: new Date().toISOString()
    }))
    
    // Initialize orchestrator
    const orchestrator = new AgentOrchestrator()
    
    // If we have priority guidance, use it as admin instructions
    const adminInstructions = body.priorityGuidance || 'Create a balanced weekly plan for the family'
    
    // Start with dialogue phase
    const dialogueResult = await orchestrator.startDialogue({
      adminInstructions,
      teamMembers,
      availableBacklog,
      activeObjectives,
      precedingPlans: [], // Could fetch from DB if needed
      recurringTasksDue,
      weekStartDate: new Date().toISOString().split('T')[0],
      userId,
      teamId: TEAM_ID
    })
    
    if (dialogueResult.error) {
      throw new Error(dialogueResult.error)
    }
    
    // For backward compatibility, auto-approve and execute the plan
    console.log('Auto-approving plan for backward compatibility')
    const executionResult = await orchestrator.executeApprovedPlan(
      {
        adminInstructions,
        teamMembers,
        availableBacklog,
        activeObjectives,
        precedingPlans: [],
        recurringTasksDue,
        weekStartDate: new Date().toISOString().split('T')[0],
        userId,
        teamId: TEAM_ID
      },
      {
        approved: true,
        adjustments: undefined
      }
    )
    
    if (executionResult.error) {
      throw new Error(executionResult.error)
    }
    
    if (!executionResult.finalPlan) {
      throw new Error('No plan generated by new system')
    }
    
    // Log agent system usage
    console.log('=== NEW PLANNING SYSTEM COMPLETE ===')
    console.log('Plan title:', executionResult.finalPlan.title)
    console.log('Total tasks:', executionResult.finalPlan.statistics.total_tasks)
    console.log('Used multi-agent orchestration')
    console.log('===================================')
    
    return NextResponse.json(executionResult.finalPlan)
    
  } catch (error) {
    console.error('New planning system error:', error)
    console.log('Falling back to legacy system due to error')
    
    // Fallback to legacy system on error
    return legacyPlanGeneration(body)
  }
}

// Extract legacy plan generation into separate function
async function legacyPlanGeneration(body: GeneratePlanRequest): Promise<NextResponse> {
  console.log('Using legacy planning system')
  
  // Fetch team members with UUIDs from the database
  const { data: teamMembersFromDB, error: teamError } = await supabase
    .from('team_members')
    .select('user_id, display_name, users!inner(full_name, email)')
    .eq('team_id', TEAM_ID)

  if (teamError || !teamMembersFromDB) {
    throw new Error(`Failed to fetch team members: ${teamError?.message}`)
  }

  // Convert database format to TeamMember format with UUIDs
  interface DBMember {
    user_id: string
    display_name?: string | null
    users?: {
      full_name?: string | null
      email?: string
    } | null
  }
  const teamMembersWithUUIDs: TeamMember[] = teamMembersFromDB.map((member: DBMember) => ({
    id: member.user_id,
    name: member.display_name || member.users?.full_name || 'Unknown',
    email: member.users?.email || 'unknown@email.com'
  }))

  console.log('Team members with UUIDs:', teamMembersWithUUIDs)
  console.log('Number of team members:', teamMembersWithUUIDs.length)
  teamMembersWithUUIDs.forEach((member, idx) => {
    console.log(`Team member ${idx + 1}: ${member.id} - ${member.name}`)
  })

  const prompt = createTaskPrompt({ ...body, teamMembersWithUUIDs })

  console.log('Starting AI request with model:', AI_MODEL)
  console.log('Prompt length:', prompt.length, 'characters')
  
  // Create the message with a timeout wrapper
  const messagePromise = anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 20000,
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })
  
  // Add timeout handling (290 seconds to stay under 300s Vercel limit)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('AI request timed out after 290 seconds')), 290000)
  })
  
  const message = await Promise.race([messagePromise, timeoutPromise]) as Awaited<typeof messagePromise>

  // Log token usage
  console.log('=== PLAN GENERATION COMPLETE ===')
  console.log('Token usage:', {
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    total_tokens: message.usage.input_tokens + message.usage.output_tokens
  })
  console.log('================================')

  // Extract JSON from the response
  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI')
  }

  // Log raw AI response for debugging
  console.log('=== RAW AI RESPONSE START ===')
  console.log(content.text)
  console.log('=== RAW AI RESPONSE END ===')
  console.log('Response type:', typeof content.text)
  console.log('Response length:', content.text.length)

  // Parse the JSON response
  let planData: VibePlanFile
  try {
    // Sanitize the response first
    const sanitized = sanitizeAIResponse(content.text)
    
    // Try to parse the sanitized response
    planData = JSON.parse(sanitized)
    console.log('Successfully parsed JSON')
    
  } catch (error) {
    console.error('JSON Parse Error:', error)
    console.error('Failed to parse:', content.text.substring(0, 500))
    
    // Return a proper error response instead of throwing
    return NextResponse.json({
      error: 'Failed to generate valid plan',
      details: 'AI response was not in expected JSON format',
      retry: true,
      debugInfo: {
        responseStart: content.text.substring(0, 200),
        responseType: typeof content.text
      }
    }, { status: 500 })
  }

  // Validate the response structure
  if (!validateVibePlanFile(planData)) {
    console.error('Validation failed for parsed data:', planData)
    return NextResponse.json({
      error: 'Generated plan failed validation',
      details: 'The AI response was parsed but has invalid structure',
      retry: true
    }, { status: 500 })
  }

  // Ensure all user IDs from teamMembersWithUUIDs are included
  for (const member of teamMembersWithUUIDs) {
    if (!planData.assignments[member.id]) {
      planData.assignments[member.id] = {
        user_name: member.name,
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
        anytime_this_week: [],
        deck: []
      }
    }
  }

  // Validate that assignment keys are UUIDs
  console.log('Assignment keys in response:', Object.keys(planData.assignments))
  console.log('Number of users with assignments:', Object.keys(planData.assignments).length)
  console.log('Tasks per person:', planData.statistics.tasks_per_person)
  
  // Log first few assignments for debugging
  Object.entries(planData.assignments).slice(0, 2).forEach(([userId, userPlan]) => {
    const taskCount = Object.values(userPlan).filter(v => Array.isArray(v))
      .reduce((sum, tasks) => sum + tasks.length, 0)
    console.log(`User ${userId} (${userPlan.user_name}): ${taskCount} tasks`)
  })
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const invalidKeys = Object.keys(planData.assignments).filter(key => !uuidRegex.test(key))
  
  if (invalidKeys.length > 0) {
    console.warn('AI response contains non-UUID keys:', invalidKeys)
    console.warn('This may cause plan_tasks creation to fail')
  }

  return NextResponse.json(planData)
}