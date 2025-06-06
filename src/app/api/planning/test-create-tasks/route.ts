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

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    console.log('Creating test tasks for plan:', planId)

    // Create some test plan_tasks
    const testTasks = [
      {
        weekly_plan_id: planId,
        assignee_id: '86f09a81-66c9-483b-9667-2ef9937b1119', // Using a known user ID
        description: 'Test Task 1',
        day_of_week: 1, // Monday
        status: 'pending',
        importance: 5,
        urgency: 5
      },
      {
        weekly_plan_id: planId,
        assignee_id: '86f09a81-66c9-483b-9667-2ef9937b1119',
        description: 'Test Task 2', 
        day_of_week: 2, // Tuesday
        status: 'pending',
        importance: 4,
        urgency: 3
      },
      {
        weekly_plan_id: planId,
        assignee_id: '86f09a81-66c9-483b-9667-2ef9937b1119',
        description: 'Test Task 3',
        day_of_week: 7, // Anytime this week
        status: 'pending',
        importance: 3,
        urgency: 4
      }
    ]

    const { error } = await supabase
      .from('plan_tasks')
      .insert(testTasks)

    if (error) {
      console.error('Error creating test tasks:', error)
      throw new Error(`Failed to create test tasks: ${error.message}`)
    }

    console.log(`Successfully created ${testTasks.length} test tasks for plan ${planId}`)

    // Verify they were created
    const { data: verifyTasks } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('weekly_plan_id', planId)

    console.log('Verification - tasks now in database:', verifyTasks)

    return NextResponse.json({
      success: true,
      message: `Created ${testTasks.length} test tasks`,
      tasks: verifyTasks
    })

  } catch (error) {
    console.error('Error in test-create-tasks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create test tasks' },
      { status: 500 }
    )
  }
}