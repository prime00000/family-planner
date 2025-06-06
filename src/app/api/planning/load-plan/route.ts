import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { VibePlanFile, ConversationExchange } from '@/app/admin/planning/phase3/types'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Fetch the plan from weekly_plans table
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('id', planId)
      .eq('team_id', TEAM_ID)
      .single()

    if (planError || !plan) {
      throw new Error(`Failed to fetch plan: ${planError?.message || 'Plan not found'}`)
    }

    // Extract the VibePlanFile and conversation history from ai_conversation
    const aiConversation = plan.ai_conversation as {
      exchanges: ConversationExchange[]
      finalPlan: VibePlanFile
    } | null

    if (!aiConversation) {
      throw new Error('Plan does not contain AI conversation data')
    }

    // Fetch plan_tasks for this plan to verify data consistency
    const { data: planTasks, error: tasksError } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('weekly_plan_id', planId)

    if (tasksError) {
      console.error('Failed to fetch plan tasks:', tasksError)
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        title: plan.title,
        status: plan.status,
        scheduledActivation: plan.scheduled_activation,
        weekStartDate: plan.week_start_date,
        createdAt: plan.created_at,
        vibePlan: aiConversation.finalPlan,
        conversation: aiConversation.exchanges,
        planTasksCount: planTasks?.length || 0
      }
    })

  } catch (error) {
    console.error('Error loading plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load plan' },
      { status: 500 }
    )
  }
}