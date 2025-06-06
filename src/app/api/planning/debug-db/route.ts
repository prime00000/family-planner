import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    console.log('DEBUG: Testing database queries...')

    // Test 1: Check weekly_plans table structure
    const { data: plansSample, error: plansError } = await supabase
      .from('weekly_plans')
      .select('*')
      .limit(2)

    console.log('DEBUG: Plans sample:', plansSample)
    console.log('DEBUG: Plans error:', plansError)

    // Test 2: Check plan_tasks table structure
    const { data: tasksSample, error: tasksError } = await supabase
      .from('plan_tasks')
      .select('*')
      .limit(2)

    console.log('DEBUG: Tasks sample:', tasksSample)
    console.log('DEBUG: Tasks error:', tasksError)

    // Test 3: Check if there are any plans for our team
    const { data: teamPlans, error: teamPlansError } = await supabase
      .from('weekly_plans')
      .select('id, title, team_id, status, created_at')
      .eq('team_id', TEAM_ID)

    console.log('DEBUG: Team plans:', teamPlans)
    console.log('DEBUG: Team plans error:', teamPlansError)

    // Test 4: Check if there are any plan_tasks
    const { data: allPlanTasks, error: allTasksError } = await supabase
      .from('plan_tasks')
      .select('id, weekly_plan_id, description')
      .limit(5)

    console.log('DEBUG: All plan tasks sample:', allPlanTasks)
    console.log('DEBUG: All tasks error:', allTasksError)

    // Test 5: Check plan_tasks with all columns
    const { data: planTasksDetailed, error: detailedError } = await supabase
      .from('plan_tasks')
      .select('*')
      .limit(3)

    console.log('DEBUG: Plan tasks detailed:', planTasksDetailed)
    console.log('DEBUG: Detailed error:', detailedError)

    // Test 6: Try to join the tables
    if (teamPlans && teamPlans.length > 0) {
      const firstPlanId = teamPlans[0].id
      console.log('DEBUG: Testing with plan ID:', firstPlanId)
      
      const { data: joinTest, error: joinError } = await supabase
        .from('plan_tasks')
        .select('id, description, weekly_plan_id')
        .eq('weekly_plan_id', firstPlanId)

      console.log(`DEBUG: Tasks for plan ${firstPlanId}:`, joinTest)
      console.log('DEBUG: Join error:', joinError)

      // Test different plan IDs if the first one has no tasks
      for (const plan of teamPlans.slice(0, 3)) {
        const { data: testTasks, error: testError } = await supabase
          .from('plan_tasks')
          .select('id')
          .eq('weekly_plan_id', plan.id)
        
        console.log(`DEBUG: Plan ${plan.id} has ${testTasks?.length || 0} tasks`)
        if (testError) console.log(`DEBUG: Error for plan ${plan.id}:`, testError)
      }
    }

    // Test 7: Check foreign key relationship
    if (allPlanTasks && allPlanTasks.length > 0) {
      const taskPlanId = allPlanTasks[0].weekly_plan_id
      const { data: planForTask, error: planError } = await supabase
        .from('weekly_plans')
        .select('id, title')
        .eq('id', taskPlanId)
        .single()

      console.log('DEBUG: Plan for first task:', planForTask)
      console.log('DEBUG: Plan lookup error:', planError)
    }

    // Test 8: Check specific plan IDs from the UI
    const specificPlanIds = [
      '44af1e0d-f208-4a08-a617-57b4572a461d',
      'bd2b0a90-0be1-4759-82d1-0f18c9a2c20c', 
      'c5c65664-e261-4a46-8cf7-522472079588'
    ]

    for (const planId of specificPlanIds) {
      const { data: specificTasks, error: specificError } = await supabase
        .from('plan_tasks')
        .select('id, description, assignee_id')
        .eq('weekly_plan_id', planId)

      console.log(`DEBUG: Plan ${planId} has ${specificTasks?.length || 0} tasks:`, specificTasks)
      if (specificError) console.log(`DEBUG: Error for plan ${planId}:`, specificError)
    }

    return NextResponse.json({
      success: true,
      debug: {
        teamId: TEAM_ID,
        plansSampleCount: plansSample?.length || 0,
        tasksSampleCount: tasksSample?.length || 0,
        teamPlansCount: teamPlans?.length || 0,
        allPlanTasksCount: allPlanTasks?.length || 0,
        plansSample: plansSample,
        tasksSample: tasksSample,
        teamPlans: teamPlans,
        allPlanTasks: allPlanTasks
      }
    })

  } catch (error) {
    console.error('DEBUG: Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debug failed' },
      { status: 500 }
    )
  }
}