import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { VibePlanFile, ConversationExchange } from '@/app/admin/planning/phase3/types'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SavePlanRequest {
  plan: VibePlanFile
  conversationHistory: ConversationExchange[]
  userId: string
  scheduledActivation?: string | null
}

// Removed getWeekStartDate function - no longer needed for draft plans

function getDayOfWeekNumber(day: string): number | null {
  const dayMap: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
    anytime_this_week: 7
  }
  return dayMap[day.toLowerCase()] ?? null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SavePlanRequest
    const { plan, conversationHistory, userId, scheduledActivation } = body

    // Start saving the plan as draft
    let tasksCreated = 0

    // Create a mapping of user names to user IDs
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('user_id, display_name, users!inner(full_name, email)')
      .eq('team_id', TEAM_ID)

    if (teamError || !teamMembers) {
      throw new Error(`Failed to fetch team members: ${teamError?.message}`)
    }

    const userNameToId: Record<string, string> = {}
    teamMembers.forEach(member => {
      const { user_id, display_name, users } = member
      if (!user_id || !users) return

      const fullName = users.full_name
      const email = users.email

      // Helper function to add mapping variations
      const addMapping = (name: string) => {
        if (name) {
          userNameToId[name.toLowerCase()] = user_id
          userNameToId[name] = user_id
        }
      }

      // Map display_name (priority 1)
      if (display_name) {
        addMapping(display_name)
        // Also map first name from display_name
        const firstNameFromDisplay = display_name.split(' ')[0]
        addMapping(firstNameFromDisplay)
      }

      // Map full_name (priority 2)
      if (fullName) {
        addMapping(fullName)
        // Also map first name from full_name
        const firstNameFromFull = fullName.split(' ')[0]
        addMapping(firstNameFromFull)
      }

      // Map email username as fallback (priority 3)
      if (email) {
        const emailUsername = email.split('@')[0]
        addMapping(emailUsername)
      }
    })

    // 1. Create the weekly plan record with NULL week_start_date for drafts
    const { data: weeklyPlan, error: planError } = await supabase
      .from('weekly_plans')
      .insert({
        team_id: TEAM_ID,
        week_start_date: null, // Will be set when plan is activated
        created_by: userId,
        status: 'draft',
        title: plan.title || 'Weekly Plan',
        scheduled_activation: scheduledActivation || null,
        ai_conversation: {
          exchanges: conversationHistory,
          finalPlan: plan
        }
      })
      .select()
      .single()

    if (planError || !weeklyPlan) {
      throw new Error(`Failed to create weekly plan: ${planError?.message}`)
    }

    // 2. Create plan_tasks from the AI plan (no archiving/backlog for draft plans)

    const planTasksToInsert: Database['public']['Tables']['plan_tasks']['Insert'][] = []

    for (const [userName, assignments] of Object.entries(plan.assignments)) {
      // Look up the user ID from the user name
      const assigneeId = userNameToId[userName] || userNameToId[userName.toLowerCase()]
      
      if (!assigneeId) {
        console.warn(`Could not find user ID for: ${userName}`)
        continue
      }

      // Process each day's tasks
      for (const [day, tasks] of Object.entries(assignments)) {
        if (day === 'user_name' || !Array.isArray(tasks)) continue

        const dayOfWeek = getDayOfWeekNumber(day)

        for (const task of tasks) {
          planTasksToInsert.push({
            weekly_plan_id: weeklyPlan.id,
            assignee_id: assigneeId,
            description: task.description,
            day_of_week: dayOfWeek,
            status: 'pending',
            importance: task.importance,
            urgency: task.urgency
          })
        }
      }
    }

    if (planTasksToInsert.length > 0) {
      const { error: createError } = await supabase
        .from('plan_tasks')
        .insert(planTasksToInsert)

      if (createError) {
        throw new Error(`Failed to create plan tasks: ${createError.message}`)
      }

      tasksCreated = planTasksToInsert.length
    }

    // Return save summary
    return NextResponse.json({
      success: true,
      weeklyPlanId: weeklyPlan.id,
      summary: {
        tasksCreated: tasksCreated
      }
    })

  } catch (error) {
    console.error('Error saving plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save plan' },
      { status: 500 }
    )
  }
}