import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Get active tasks
    const { data: activeTasks } = await supabase
      .from('tasks')
      .select('id, title, status, assignee_id, day_of_week, team_id, plan_task_id')
      .eq('team_id', TEAM_ID)
      .eq('status', 'active')
      .limit(10)

    // Get all task statuses count
    const { data: statusCounts } = await supabase
      .from('tasks')
      .select('status')
      .eq('team_id', TEAM_ID)

    const statusSummary = statusCounts?.reduce((acc, task) => {
      acc[task.status || 'null'] = (acc[task.status || 'null'] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get recent tasks
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('id, title, status, created_at, assignee_id, day_of_week')
      .eq('team_id', TEAM_ID)
      .order('created_at', { ascending: false })
      .limit(5)

    // Check active plans
    const { data: activePlans } = await supabase
      .from('weekly_plans')
      .select('id, title, status, week_start_date')
      .eq('team_id', TEAM_ID)
      .eq('status', 'active')

    return NextResponse.json({
      team_id: TEAM_ID,
      active_tasks_count: activeTasks?.length || 0,
      active_tasks: activeTasks,
      status_summary: statusSummary,
      recent_tasks: recentTasks,
      active_plans: activePlans,
      debug_info: {
        total_tasks: statusCounts?.length || 0,
        has_active_tasks: (activeTasks?.length || 0) > 0
      }
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debug failed' },
      { status: 500 }
    )
  }
}