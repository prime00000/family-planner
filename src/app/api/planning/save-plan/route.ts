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
  planId?: string | null // For updating existing plans
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
    const { plan, conversationHistory, userId, scheduledActivation, planId } = body

    // Start saving the plan as draft
    let tasksCreated = 0
    let weeklyPlan: Database['public']['Tables']['weekly_plans']['Row']

    // Validate that assignment keys are UUIDs (AI should now use UUIDs directly)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const assignmentKeys = Object.keys(plan.assignments)
    const invalidKeys = assignmentKeys.filter(key => !uuidRegex.test(key))
    
    if (invalidKeys.length > 0) {
      console.error('Plan contains non-UUID assignment keys:', invalidKeys)
      throw new Error(`Invalid assignment keys (must be UUIDs): ${invalidKeys.join(', ')}`)
    }

    // Verify all assignment keys exist in team_members
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', TEAM_ID)

    if (teamError) {
      throw new Error(`Failed to verify team members: ${teamError.message}`)
    }

    const validUserIds = new Set(teamMembers?.map(m => m.user_id) || [])
    const invalidUserIds = assignmentKeys.filter(key => !validUserIds.has(key))
    
    if (invalidUserIds.length > 0) {
      console.error('Plan contains invalid user IDs:', invalidUserIds)
      console.error('Valid team member IDs:', Array.from(validUserIds))
      console.error('Assignment keys from plan:', assignmentKeys)
      throw new Error(`Invalid user IDs in assignments: ${invalidUserIds.join(', ')}`)
    }

    console.log('All assignment keys validated as valid UUIDs and team member IDs')

    // 1. Create or update the weekly plan record
    if (planId) {
      // Update existing plan
      const { data: updatedPlan, error: updateError } = await supabase
        .from('weekly_plans')
        .update({
          title: plan.title || 'Weekly Plan',
          scheduled_activation: scheduledActivation || null,
          ai_conversation: {
            exchanges: conversationHistory,
            finalPlan: plan
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .eq('team_id', TEAM_ID)
        .select()
        .single()

      if (updateError || !updatedPlan) {
        throw new Error(`Failed to update weekly plan: ${updateError?.message}`)
      }
      
      weeklyPlan = updatedPlan

      // Delete existing plan_tasks for this plan
      const { error: deleteError } = await supabase
        .from('plan_tasks')
        .delete()
        .eq('weekly_plan_id', planId)

      if (deleteError) {
        throw new Error(`Failed to delete existing plan tasks: ${deleteError.message}`)
      }
    } else {
      // Create new plan
      const { data: newPlan, error: planError } = await supabase
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

      if (planError || !newPlan) {
        throw new Error(`Failed to create weekly plan: ${planError?.message}`)
      }
      
      weeklyPlan = newPlan
    }

    // 2. Create plan_tasks from the AI plan (no archiving/backlog for draft plans)

    console.log('Creating plan_tasks for plan:', weeklyPlan.id)
    console.log('Plan assignments with UUIDs:', Object.keys(plan.assignments))

    const planTasksToInsert: Database['public']['Tables']['plan_tasks']['Insert'][] = []

    for (const [userId, assignments] of Object.entries(plan.assignments)) {
      console.log(`Processing assignments for user ID: ${userId}`)
      
      // userId is already a UUID from the AI response
      const assigneeId = userId

      console.log(`Using UUID directly: ${assigneeId}`)

      // Process each day's tasks
      for (const [day, tasks] of Object.entries(assignments)) {
        if (day === 'user_name' || !Array.isArray(tasks)) continue

        console.log(`Processing day ${day} with ${tasks.length} tasks`)
        const dayOfWeek = getDayOfWeekNumber(day)

        for (const task of tasks) {
          const planTask = {
            weekly_plan_id: weeklyPlan.id,
            assignee_id: assigneeId,
            description: task.description,
            day_of_week: dayOfWeek,
            status: 'pending',
            importance: task.importance,
            urgency: task.urgency
          }
          
          console.log('Adding plan task:', planTask)
          planTasksToInsert.push(planTask)
        }
      }
    }

    console.log(`Total plan_tasks to insert: ${planTasksToInsert.length}`)

    if (planTasksToInsert.length > 0) {
      const { error: createError } = await supabase
        .from('plan_tasks')
        .insert(planTasksToInsert)

      if (createError) {
        console.error('Error creating plan tasks:', createError)
        throw new Error(`Failed to create plan tasks: ${createError.message}`)
      }

      console.log(`Successfully created ${planTasksToInsert.length} plan tasks`)
      tasksCreated = planTasksToInsert.length
    } else {
      console.log('No plan tasks to create - plan assignments may be empty')
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