import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { VibePlanFile, ConversationExchange } from '@/app/admin/planning/phase3/types'

// Using Claude Opus 4 - most capable model for complex family planning logic
// Can override with ANTHROPIC_MODEL env var if needed
const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-20250514"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface RefinePlanRequest {
  currentPlan: VibePlanFile
  feedback: string
  selectedTaskIds?: string[]
  conversationHistory: ConversationExchange[]
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
`

function createRefinementPrompt(params: RefinePlanRequest): string {
  const { currentPlan, feedback, selectedTaskIds, conversationHistory } = params
  
  // Create a detailed view of the current plan
  let currentPlanDetails = 'CURRENT PLAN DETAILS:\n\n'
  
  for (const [userId, assignments] of Object.entries(currentPlan.assignments)) {
    currentPlanDetails += `${assignments.user_name} (${userId}):\n`
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'anytime_this_week', 'deck']
    
    for (const day of days) {
      const tasks = assignments[day as keyof typeof assignments]
      if (Array.isArray(tasks) && tasks.length > 0) {
        currentPlanDetails += `  ${day}:\n`
        tasks.forEach(task => {
          currentPlanDetails += `    - [${task.id}] ${task.description}`
          currentPlanDetails += ` (importance: ${task.importance}, urgency: ${task.urgency})`
          if (task.tags.length > 0) {
            currentPlanDetails += ` [tags: ${task.tags.join(', ')}]`
          }
          if (task.scheduledTime) {
            currentPlanDetails += ` [scheduled: ${task.scheduledTime.start}`
            if (task.scheduledTime.duration) {
              currentPlanDetails += ` for ${task.scheduledTime.duration}min`
            }
            currentPlanDetails += `]`
          }
          currentPlanDetails += '\n'
        })
      }
    }
    currentPlanDetails += '\n'
  }
  
  const prompt = `You are refining a family task plan based on user feedback.

${FAMILY_CONTEXT}

${currentPlanDetails}

Plan Statistics:
- Total tasks: ${currentPlan.statistics.total_tasks}
- High priority tasks: ${currentPlan.statistics.high_priority_count}
- Tasks per person: ${Object.entries(currentPlan.statistics.tasks_per_person)
    .map(([id, count]) => `${currentPlan.assignments[id]?.user_name || id}: ${count}`)
    .join(', ')}

Previous conversation:
${conversationHistory.length > 0 ? conversationHistory.map(exchange => 
  `User: ${exchange.userMessage}\nAssistant: ${exchange.aiResponse}`
).join('\n\n') : 'No previous conversation'}

User feedback: ${feedback}

${selectedTaskIds && selectedTaskIds.length > 0 ? `\nIMPORTANT: The user has selected these specific task IDs for this feedback: ${selectedTaskIds.join(', ')}. Make sure your changes focus on these selected tasks.\n` : ''}

Based on this feedback, update the plan. Common refinements include:
- Moving tasks between people
- Changing task scheduling (day of week or time)
- Moving tasks to/from the deck
- Adjusting task priorities
- Combining or splitting tasks
- Adding or removing tasks

Return a JSON object with this structure:
{
  "updatedPlan": { 
    // The complete updated VibePlanFile structure with all assignments, metadata, and statistics
    // This should be the ENTIRE plan object, not just the changes
  },
  "explanation": "Brief explanation of what changes were made and why"
}

Make sure to:
1. Include ALL users and ALL their tasks in the updatedPlan, not just the ones you changed
2. Maintain the exact same structure as the current plan
3. Update the version number in metadata
4. Recalculate statistics after changes
5. Keep all user assignments even if they have no tasks
6. Be specific in your explanation about what changed
7. Preserve all task IDs - don't generate new ones unless adding new tasks`

  return prompt
}

export async function POST(request: NextRequest) {
  console.log('Refine plan called, API key present:', !!process.env.ANTHROPIC_API_KEY)
  console.log('Using AI model:', AI_MODEL)
  
  try {
    const body = await request.json() as RefinePlanRequest

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const prompt = createRefinementPrompt(body)

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 20000,
      temperature: 0.7,
      system: `You are a family task planning AI. When updating plans, you must return the COMPLETE updated plan with ALL users and ALL tasks, not just the changes. The current plan structure is: ${JSON.stringify(body.currentPlan, null, 2)}`,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Log token usage
    console.log('=== PLAN REFINEMENT COMPLETE ===')
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

    // Parse the JSON response
    let refinementResult: { updatedPlan: VibePlanFile; explanation: string }
    try {
      // Find JSON in the response
      const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.text.match(/({[\s\S]*})/)
      
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }

      refinementResult = JSON.parse(jsonMatch[1])
    } catch {
      console.error('Failed to parse AI response:', content.text)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Validate the response
    if (!refinementResult.updatedPlan || !refinementResult.explanation) {
      throw new Error('Invalid refinement response structure')
    }

    // Ensure version is incremented
    refinementResult.updatedPlan.metadata.version = body.currentPlan.metadata.version + 1

    return NextResponse.json(refinementResult)
  } catch (error) {
    console.error('Error refining plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refine plan' },
      { status: 500 }
    )
  }
}