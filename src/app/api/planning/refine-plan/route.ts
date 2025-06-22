import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { VibePlanFile, ConversationExchange } from '@/app/admin/planning/phase3/types'

// Using Claude Sonnet 3.7 - excellent balance of capability and speed
// Can override with ANTHROPIC_MODEL env var if needed
const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-20250219"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
  
  console.log('Sanitized response preview:', response.substring(0, 200) + '...')
  
  return response
}

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

CRITICAL: Your response must be ONLY a valid JSON object. No markdown, no code blocks, no explanations before or after the JSON.

Return EXACTLY this structure (starting with { and ending with }):
{
  "updatedPlan": { 
    "title": "Updated plan title",
    "assignments": {
      "user-uuid-here": {
        "user_name": "Person Name",
        "monday": [array of task objects],
        "tuesday": [array of task objects],
        "wednesday": [array of task objects],
        "thursday": [array of task objects],
        "friday": [array of task objects],
        "saturday": [array of task objects],
        "sunday": [array of task objects],
        "anytime_this_week": [array of task objects],
        "deck": [array of task objects]
      }
    },
    "metadata": {
      "priorityGuidance": "string",
      "generatedAt": "ISO date string",
      "version": number
    },
    "statistics": {
      "total_tasks": number,
      "tasks_per_person": {},
      "high_priority_count": number,
      "scheduled_tasks_count": number
    }
  },
  "explanation": "Brief explanation of what changes were made and why"
}

Rules for JSON generation:
- NO comments allowed in JSON
- NO trailing commas
- Use double quotes only
- Response starts with { and ends with }
- Include ALL users and ALL their tasks in the updatedPlan
- Maintain the exact same structure as the current plan
- Update the version number in metadata
- Recalculate statistics after changes
- Keep all user assignments even if they have no tasks
- Be specific in your explanation about what changed
- Preserve all task IDs - don't generate new ones unless adding new tasks

Remember: Return ONLY the JSON object. Do not include any text before the { or after the closing }`

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

    console.log('Starting AI refinement with model:', AI_MODEL)
    console.log('Prompt length:', prompt.length, 'characters')
    
    // Create the message with a timeout wrapper
    const messagePromise = anthropic.messages.create({
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
    
    // Add timeout handling (290 seconds to stay under 300s Vercel limit)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI request timed out after 290 seconds')), 290000)
    })
    
    const message = await Promise.race([messagePromise, timeoutPromise]) as Awaited<typeof messagePromise>

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

    // Log raw AI response for debugging
    console.log('=== RAW AI REFINEMENT RESPONSE START ===')
    console.log(content.text)
    console.log('=== RAW AI REFINEMENT RESPONSE END ===')
    console.log('Response type:', typeof content.text)
    console.log('Response length:', content.text.length)

    // Parse the JSON response
    let refinementResult: { updatedPlan: VibePlanFile; explanation: string }
    try {
      // Sanitize the response first
      const sanitized = sanitizeAIResponse(content.text)
      
      // Try to parse the sanitized response
      refinementResult = JSON.parse(sanitized)
      console.log('Successfully parsed refinement JSON')
      
    } catch (error) {
      console.error('JSON Parse Error:', error)
      console.error('Failed to parse:', content.text.substring(0, 500))
      
      // Return a proper error response instead of throwing
      return NextResponse.json({
        error: 'Failed to parse refinement response',
        details: 'AI response was not in expected JSON format',
        retry: true,
        debugInfo: {
          responseStart: content.text.substring(0, 200),
          responseType: typeof content.text
        }
      }, { status: 500 })
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