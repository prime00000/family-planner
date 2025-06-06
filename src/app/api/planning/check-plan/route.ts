import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json()

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .select('*, plan_tasks(count)')
      .eq('id', planId)
      .single()

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 })
    }

    // Get actual plan_tasks
    const { data: planTasks, error: tasksError } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('weekly_plan_id', planId)

    // Check AI conversation for tasks
    const aiConversation = plan.ai_conversation as any
    const hasAiTasks = !!(aiConversation?.finalPlan?.assignments)
    const aiTaskCount = hasAiTasks ? 
      Object.values(aiConversation.finalPlan.assignments).reduce((sum: number, user: any) => {
        return sum + Object.values(user)
          .filter(v => Array.isArray(v))
          .reduce((userSum: number, tasks: any) => userSum + tasks.length, 0)
      }, 0) : 0

    return NextResponse.json({
      plan: {
        id: plan.id,
        title: plan.title,
        status: plan.status,
        team_id: plan.team_id
      },
      plan_tasks_count: planTasks?.length || 0,
      plan_tasks_sample: planTasks?.slice(0, 3).map(t => ({
        id: t.id,
        description: t.description,
        assignee_id: t.assignee_id
      })),
      ai_conversation: {
        has_final_plan: hasAiTasks,
        ai_task_count: aiTaskCount,
        assignment_keys: hasAiTasks ? Object.keys(aiConversation.finalPlan.assignments) : []
      }
    })

  } catch (error) {
    console.error('Check plan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 }
    )
  }
}