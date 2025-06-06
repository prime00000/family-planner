import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Fetch the plan to verify it exists and belongs to this team
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .select('id, status')
      .eq('id', planId)
      .eq('team_id', TEAM_ID)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of active plans
    if (plan.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete active plans. Please deactivate first.' },
        { status: 400 }
      )
    }

    // Delete plan_tasks first (due to foreign key constraint)
    const { error: tasksError } = await supabase
      .from('plan_tasks')
      .delete()
      .eq('weekly_plan_id', planId)

    if (tasksError) {
      console.error('Error deleting plan tasks:', tasksError)
      // Continue anyway - tasks might not exist
    }

    // Delete the weekly plan
    const { error: deleteError } = await supabase
      .from('weekly_plans')
      .delete()
      .eq('id', planId)
      .eq('team_id', TEAM_ID)

    if (deleteError) {
      throw new Error(`Failed to delete plan: ${deleteError.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete plan' },
      { status: 500 }
    )
  }
}