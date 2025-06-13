import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { VibePlanFile } from '@/app/admin/planning/phase3/types'
import { TEAM_ID } from '@/lib/constants'

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

Return a JSON object with this EXACT structure - NOTE: Use UUIDs as keys in assignments:
{
  "title": "Suggested plan title that captures the week's theme or main focus",
  "assignments": {
    "${exampleUUID1}": {
      "user_name": "${exampleName1}",
      "monday": [tasks],
      "tuesday": [tasks],
      "wednesday": [tasks],
      "thursday": [tasks],
      "friday": [tasks],
      "saturday": [tasks],
      "sunday": [tasks],
      "anytime_this_week": [tasks],
      "deck": [tasks]
    },
    "${exampleUUID2}": {
      "user_name": "${exampleName2}",
      "monday": [tasks],
      "tuesday": [tasks],
      "wednesday": [tasks],
      "thursday": [tasks],
      "friday": [tasks],
      "saturday": [tasks],
      "sunday": [tasks],
      "anytime_this_week": [tasks],
      "deck": [tasks]
    }
  },
  "metadata": {
    "priorityGuidance": "user's priority guidance here",
    "generatedAt": "ISO date string",
    "version": 1
  },
  "statistics": {
    "total_tasks": number,
    "tasks_per_person": { "uuid1": count, "uuid2": count },
    "high_priority_count": number,
    "scheduled_tasks_count": number
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

Important:
- Balance workload by age and availability
- School-age children should have fewer tasks on weekdays
- High importance/urgency tasks should go to adults
- Keep task descriptions clear and actionable
- Use appropriate tags like "school", "home", "work", "family"
`

  return prompt
}

export async function POST(request: NextRequest) {
  console.log('Generate plan called, API key present:', !!process.env.ANTHROPIC_API_KEY)
  
  try {
    const body = await request.json() as GeneratePlanRequest

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

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

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Extract JSON from the response
    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI')
    }

    // Parse the JSON response
    let planData: VibePlanFile
    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.text.match(/({[\s\S]*})/)
      
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }

      planData = JSON.parse(jsonMatch[1])
    } catch {
      console.error('Failed to parse AI response:', content.text)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Validate the response structure
    if (!planData.assignments || !planData.metadata || !planData.statistics) {
      throw new Error('Invalid plan structure from AI')
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