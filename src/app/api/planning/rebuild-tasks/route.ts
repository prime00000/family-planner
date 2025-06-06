import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const { planId } = await request.json()

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Get the plan with AI conversation
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .select('id, team_id, ai_conversation')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      throw new Error(`Failed to fetch plan: ${planError?.message}`)
    }

    // Extract the final plan from ai_conversation
    const aiConversation = plan.ai_conversation as any
    const finalPlan = aiConversation?.finalPlan

    if (!finalPlan || !finalPlan.assignments) {
      throw new Error('No assignments found in plan')
    }

    console.log('Rebuilding tasks for plan:', planId)
    console.log('Assignments found:', Object.keys(finalPlan.assignments))

    // Delete existing plan_tasks
    const { error: deleteError } = await supabase
      .from('plan_tasks')
      .delete()
      .eq('weekly_plan_id', planId)

    if (deleteError) {
      console.error('Error deleting existing tasks:', deleteError)
    }

    // Create new plan_tasks
    const planTasksToInsert: Database['public']['Tables']['plan_tasks']['Insert'][] = []

    for (const [userId, assignments] of Object.entries(finalPlan.assignments)) {
      console.log(`Processing user ${userId}`)
      
      // Skip if not a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        console.warn(`Skipping invalid UUID: ${userId}`)
        continue
      }

      // Process each day's tasks
      for (const [day, tasks] of Object.entries(assignments as any)) {
        if (day === 'user_name' || !Array.isArray(tasks)) continue

        const dayOfWeek = getDayOfWeekNumber(day)

        for (const task of tasks) {
          planTasksToInsert.push({
            weekly_plan_id: planId,
            assignee_id: userId,
            description: task.description,
            day_of_week: dayOfWeek,
            status: 'pending',
            importance: task.importance || 3,
            urgency: task.urgency || 3
          })
        }
      }
    }

    console.log(`Creating ${planTasksToInsert.length} plan_tasks`)

    if (planTasksToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('plan_tasks')
        .insert(planTasksToInsert)

      if (insertError) {
        throw new Error(`Failed to create plan tasks: ${insertError.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Rebuilt ${planTasksToInsert.length} tasks for plan ${planId}`
    })

  } catch (error) {
    console.error('Error rebuilding tasks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rebuild tasks' },
      { status: 500 }
    )
  }
}