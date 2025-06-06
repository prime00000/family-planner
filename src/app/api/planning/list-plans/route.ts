import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('API: Loading plans with TEAM_ID:', TEAM_ID)

    // First, check if we can see any plans at all
    const { data: allPlans, error: allError } = await supabase
      .from('weekly_plans')
      .select('id, title, team_id, status')
      .limit(5)

    console.log('API: All plans sample:', allPlans)
    console.log('API: All plans error:', allError)

    // Get all plans for the team
    const { data: plans, error } = await supabase
      .from('weekly_plans')
      .select(`
        id,
        title,
        status,
        created_at,
        scheduled_activation,
        week_start_date,
        created_by,
        team_id
      `)
      .eq('team_id', TEAM_ID)
      .order('created_at', { ascending: false })

    console.log('API: Plans query result:', { plans, error })
    console.log('API: Number of plans found:', plans?.length || 0)

    if (error) {
      console.error('API: Supabase error details:', error)
      throw new Error(`Failed to fetch plans: ${error.message}`)
    }

    if (!plans || plans.length === 0) {
      console.log('API: No plans found for team_id:', TEAM_ID)
      return NextResponse.json({
        success: true,
        plans: []
      })
    }

    // Log each plan's details
    plans.forEach((plan, index) => {
      console.log(`API: Plan ${index + 1}:`, {
        id: plan.id,
        title: plan.title,
        status: plan.status,
        team_id: plan.team_id
      })
    })

    // First, let's check what plan_tasks exist for debugging
    const { data: allPlanTasks, error: allTasksError } = await supabase
      .from('plan_tasks')
      .select('id, weekly_plan_id, description')
      .limit(10)
    
    console.log('API: Sample plan_tasks in database:', allPlanTasks)
    console.log('API: Plan_tasks query error:', allTasksError)
    console.log('API: Total plan_tasks in database:', allPlanTasks?.length || 0)

    // Get task counts for each plan using multiple approaches
    const plansWithTaskCounts = await Promise.all(
      plans.map(async (plan) => {
        console.log(`API: Getting task count for plan ${plan.id}`)
        
        // Method 1: Select all and count
        const { data: tasksMethod1, error: countError1 } = await supabase
          .from('plan_tasks')
          .select('id')
          .eq('weekly_plan_id', plan.id)

        // Method 2: Use count with exact
        const { count: countMethod2, error: countError2 } = await supabase
          .from('plan_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('weekly_plan_id', plan.id)

        // Method 3: Raw select all columns
        const { data: tasksMethod3, error: countError3 } = await supabase
          .from('plan_tasks')
          .select('*')
          .eq('weekly_plan_id', plan.id)

        console.log(`API: Plan ${plan.id} - Method 1 (select id):`, tasksMethod1?.length || 0)
        console.log(`API: Plan ${plan.id} - Method 2 (count exact):`, countMethod2 || 0)
        console.log(`API: Plan ${plan.id} - Method 3 (select all):`, tasksMethod3?.length || 0)
        console.log(`API: Plan ${plan.id} - Errors:`, { countError1, countError2, countError3 })

        // Use the most reliable count
        const taskCount = tasksMethod1?.length || countMethod2 || tasksMethod3?.length || 0

        const result = {
          id: plan.id,
          title: plan.title || 'Untitled Plan',
          status: plan.status,
          created_at: plan.created_at,
          scheduled_activation: plan.scheduled_activation,
          week_start_date: plan.week_start_date,
          plan_tasks_count: taskCount,
          created_by: plan.created_by,
          team_id: plan.team_id
        }

        console.log(`API: Final formatted plan ${plan.id}:`, result)
        return result
      })
    )

    console.log('API: Final plans with task counts:', plansWithTaskCounts)

    return NextResponse.json({
      success: true,
      plans: plansWithTaskCounts,
      debug: {
        teamId: TEAM_ID,
        totalPlans: plansWithTaskCounts.length
      }
    })

  } catch (error) {
    console.error('API: Error loading plans:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load plans' },
      { status: 500 }
    )
  }
}