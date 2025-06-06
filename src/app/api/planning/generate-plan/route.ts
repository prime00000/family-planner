import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { VibePlanFile, TaskAssignment } from '@/app/admin/planning/phase3/types'

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

function createTaskPrompt(params: GeneratePlanRequest): string {
  const { priorityGuidance, incompleteTasks, newItems, teamMembers } = params
  
  let prompt = `You are a family task planning AI. Create a weekly task plan for the Theobald family.

${FAMILY_CONTEXT}

Team members available:
${teamMembers.map(m => `- ${m.name} (${m.email})`).join('\n')}

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

Return a JSON object with this EXACT structure:
{
  "assignments": {
    "[userId]": {
      "user_name": "Name",
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
    "priorityGuidance": "${priorityGuidance || ''}",
    "generatedAt": "${new Date().toISOString()}",
    "version": 1
  },
  "statistics": {
    "total_tasks": number,
    "tasks_per_person": { "[userId]": count },
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
  try {
    const body = await request.json() as GeneratePlanRequest

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const prompt = createTaskPrompt(body)

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
    } catch (parseError) {
      console.error('Failed to parse AI response:', content.text)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Validate the response structure
    if (!planData.assignments || !planData.metadata || !planData.statistics) {
      throw new Error('Invalid plan structure from AI')
    }

    // Ensure all user IDs from teamMembers are included
    for (const member of body.teamMembers) {
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

    return NextResponse.json(planData)
  } catch (error) {
    console.error('Error generating plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate plan' },
      { status: 500 }
    )
  }
}