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
    // First, find active plans with the same week_start_date
    const weekStartDate = plan.week_start_date || getWeekStartDate()
    
    const { data: activePlans } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('team_id', TEAM_ID)
      .eq('status', 'active')
      .eq('week_start_date', weekStartDate)
      .neq('id', planId)

    if (activePlans && activePlans.length > 0) {
      // Set them to completed and clear their week_start_date
      const { error: deactivateError } = await supabase
        .from('weekly_plans')
        .update({ 
          status: 'completed'
        })
        .in('id', activePlans.map(p => p.id))

      if (deactivateError) {
        console.error('Failed to deactivate other plans:', deactivateError)
      }
    }

    // 3. Archive ALL current non-completed tasks for the team
    const { data: archivedTasks, error: archiveError } = await supabase
      .from('tasks')
      .update({ status: 'backlog' })
      .eq('team_id', TEAM_ID)
      .in('status', ['pending', 'deck'])  // Archive both pending and deck tasks
      .select()

    console.log(`Archived ${archivedTasks?.length || 0} existing tasks to backlog`)

    if (archiveError) {
      console.error('Archive error:', archiveError)
      throw new Error(`Failed to archive current tasks: ${archiveError.message}`)
    }

    // 4. Fetch plan_tasks for this plan
    const { data: planTasks, error: planTasksError } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('weekly_plan_id', planId)

    console.log(`Found ${planTasks?.length || 0} plan_tasks for plan ${planId}`)

    if (planTasksError) {
      throw new Error(`Failed to fetch plan tasks: ${planTasksError.message}`)
    }

    let tasksActivated = 0

    // 5. Copy all plan_tasks to the tasks table
    if (planTasks && planTasks.length > 0) {
      const tasksToInsert: Database['public']['Tables']['tasks']['Insert'][] = planTasks.map(planTask => {
        // Cast to include our added fields
        const task = planTask as typeof planTask & { importance?: number; urgency?: number }
        return {
          team_id: TEAM_ID,
          assignee_id: task.assignee_id,
          submitted_by: plan.created_by,  // Changed from created_by
          description: task.description,  // Removed title field
          importance: task.importance || 3,
          urgency: task.urgency || 3,
          day_of_week: task.day_of_week,
          status: 'pending',  // UI expects 'pending' for active tasks
          // Note: plan_task_id doesn't exist in tasks table
        }
      })

      console.log(`Attempting to insert ${tasksToInsert.length} tasks`)
      console.log('First task to insert:', tasksToInsert[0])

      const { data: insertedTasks, error: insertError } = await supabase
        .from('tasks')
        .insert(tasksToInsert)
        .select()

      if (insertError) {
        console.error('Insert error details:', insertError)
        throw new Error(`Failed to create tasks: ${insertError.message}`)
      }

      console.log(`Successfully inserted ${insertedTasks?.length || 0} tasks`)
      tasksActivated = insertedTasks?.length || 0
    }

    // 6. Update the weekly_plan status to 'active' and set week_start_date
    const { error: updatePlanError } = await supabase
      .from('weekly_plans')
      .update({ 
        status: 'active',
        week_start_date: weekStartDate  // Using the weekStartDate from earlier
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