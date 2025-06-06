import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ActivatePlanRequest {
  planId: string
}

function getWeekStartDate(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilMonday)
  return nextMonday.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ActivatePlanRequest
    const { planId } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // 1. Fetch the plan from weekly_plans table
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('id', planId)
      .eq('team_id', TEAM_ID)
      .single()

    if (planError || !plan) {
      throw new Error(`Failed to fetch plan: ${planError?.message || 'Plan not found'}`)
    }

    if (plan.status !== 'draft') {
      throw new Error('Only draft plans can be activated')
    }

    // 2. Deactivate any currently active plans for this team
    const { error: deactivateError } = await supabase
      .from('weekly_plans')
      .update({ status: 'completed' })
      .eq('team_id', TEAM_ID)
      .eq('status', 'active')
      .neq('id', planId)

    if (deactivateError) {
      console.error('Failed to deactivate other plans:', deactivateError)
    }

    // 3. Archive current active tasks for the team by updating their status to 'backlog'
    const { error: archiveError } = await supabase
      .from('tasks')
      .update({ status: 'backlog' })
      .eq('team_id', TEAM_ID)
      .in('status', ['pending', 'active'])

    if (archiveError) {
      throw new Error(`Failed to archive current tasks: ${archiveError.message}`)
    }

    // 4. Fetch plan_tasks for this plan
    const { data: planTasks, error: planTasksError } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('weekly_plan_id', planId)

    if (planTasksError) {
      throw new Error(`Failed to fetch plan tasks: ${planTasksError.message}`)
    }

    let tasksActivated = 0

    // 5. Copy all plan_tasks to the tasks table
    if (planTasks && planTasks.length > 0) {
      const tasksToInsert: Database['public']['Tables']['tasks']['Insert'][] = planTasks.map(planTask => ({
        team_id: TEAM_ID,
        assignee_id: planTask.assignee_id,
        created_by: plan.created_by,
        title: planTask.description,
        description: planTask.description,
        importance: planTask.importance || 5,
        urgency: planTask.urgency || 5,
        day_of_week: planTask.day_of_week,
        status: 'active',
        // Link back to the plan_task
        plan_task_id: planTask.id
      }))

      const { error: insertError } = await supabase
        .from('tasks')
        .insert(tasksToInsert)

      if (insertError) {
        throw new Error(`Failed to create tasks: ${insertError.message}`)
      }

      tasksActivated = tasksToInsert.length
    }

    // 6. Update the weekly_plan status to 'active' and set week_start_date
    const weekStartDate = plan.week_start_date || getWeekStartDate()
    
    const { error: updatePlanError } = await supabase
      .from('weekly_plans')
      .update({ 
        status: 'active',
        week_start_date: weekStartDate
      })
      .eq('id', planId)

    if (updatePlanError) {
      throw new Error(`Failed to activate plan: ${updatePlanError.message}`)
    }

    // Return success with summary
    return NextResponse.json({
      success: true,
      planId: planId,
      summary: {
        tasksActivated: tasksActivated,
        weekStartDate: weekStartDate
      }
    })

  } catch (error) {
    console.error('Error activating plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to activate plan' },
      { status: 500 }
    )
  }
}