import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    // 1. Find all plans with week_start_date set
    const { data: plansWithDates } = await supabase
      .from('weekly_plans')
      .select('id, title, status, week_start_date')
      .eq('team_id', TEAM_ID)
      .not('week_start_date', 'is', null)

    console.log('Plans with dates:', plansWithDates)

    // 2. Clear week_start_date from non-active plans
    const { data: clearedPlans } = await supabase
      .from('weekly_plans')
      .update({ week_start_date: null })
      .eq('team_id', TEAM_ID)
      .neq('status', 'active')
      .not('week_start_date', 'is', null)
      .select()

    console.log('Cleared week_start_date from:', clearedPlans?.length || 0, 'plans')

    // 3. Archive all pending/deck tasks if no active plan exists
    const { data: activePlans } = await supabase
      .from('weekly_plans')
      .select('id')
      .eq('team_id', TEAM_ID)
      .eq('status', 'active')

    if (!activePlans || activePlans.length === 0) {
      console.log('No active plans found, archiving all pending tasks')
      
      const { data: archivedTasks } = await supabase
        .from('tasks')
        .update({ status: 'backlog' })
        .eq('team_id', TEAM_ID)
        .in('status', ['pending', 'deck'])
        .select()

      console.log('Archived tasks:', archivedTasks?.length || 0)
    }

    // 4. Get current state
    const { data: finalPlans } = await supabase
      .from('weekly_plans')
      .select('id, title, status, week_start_date')
      .eq('team_id', TEAM_ID)
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: taskCounts } = await supabase
      .from('tasks')
      .select('status')
      .eq('team_id', TEAM_ID)

    const statusSummary = taskCounts?.reduce((acc, task) => {
      acc[task.status || 'null'] = (acc[task.status || 'null'] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      cleared_plans: clearedPlans?.length || 0,
      archived_tasks: !activePlans || activePlans.length === 0,
      current_state: {
        plans: finalPlans,
        task_status_summary: statusSummary,
        active_plan_count: finalPlans?.filter(p => p.status === 'active').length || 0
      }
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    )
  }
}