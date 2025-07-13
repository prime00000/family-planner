import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TEAM_ID } from '@/lib/constants'
import type { SkipPreferences } from '@/lib/planning/agents/review-types'
import type { Database } from '@/types/supabase'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // TODO: Implement proper auth when frontend passes user context
    // For now, using a default user ID to match other endpoints
    const userId = 'default-user'

    // Try to fetch existing preferences from database
    const { data: preferences, error } = await supabase
      .from('planning_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('team_id', TEAM_ID)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      )
    }

    // If no preferences found, return defaults
    if (!preferences) {
      const defaultPreferences: SkipPreferences = {
        skipSelectionReview: false,
        selectionSkipConditions: {
          maxTasks: 20,
          minCapacityUtilization: 70,
          noWarnings: true
        },
        skipAssignmentReview: false,
        assignmentSkipConditions: {
          balancedWorkload: true,
          noOverload: true,
          noWarnings: true
        },
        autoContinue: {
          enabled: false,
          delaySeconds: 30,
          pauseOnWarnings: true
        },
        reEnableConditions: {
          afterErrors: true,
          afterMajorChanges: true,
          everyNthRun: 5,
          onDemand: true
        }
      }
      
      return NextResponse.json({ preferences: defaultPreferences })
    }

    // Parse the stored JSON preferences
    const skipPreferences = preferences.preferences as SkipPreferences

    return NextResponse.json({ preferences: skipPreferences })

  } catch (error) {
    console.error('Preferences GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve preferences' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper auth when frontend passes user context
    // For now, using a default user ID to match other endpoints
    const userId = 'default-user'

    const body = await request.json()
    const { preferences } = body as { preferences: SkipPreferences }

    if (!preferences) {
      return NextResponse.json(
        { error: 'Missing preferences' },
        { status: 400 }
      )
    }

    // Validate preferences structure
    if (
      typeof preferences.skipSelectionReview !== 'boolean' ||
      typeof preferences.skipAssignmentReview !== 'boolean' ||
      !preferences.autoContinue ||
      typeof preferences.autoContinue.enabled !== 'boolean' ||
      typeof preferences.autoContinue.delaySeconds !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Invalid preferences structure' },
        { status: 400 }
      )
    }

    // Validate delay seconds range
    if (
      preferences.autoContinue.delaySeconds < 10 ||
      preferences.autoContinue.delaySeconds > 120
    ) {
      return NextResponse.json(
        { error: 'Auto-continue delay must be between 10 and 120 seconds' },
        { status: 400 }
      )
    }

    // Check if preferences already exist
    const { data: existing } = await supabase
      .from('planning_preferences')
      .select('id')
      .eq('user_id', userId)
      .eq('team_id', TEAM_ID)
      .single()

    let result
    if (existing) {
      // Update existing preferences
      result = await supabase
        .from('planning_preferences')
        .update({
          preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('team_id', TEAM_ID)
        .select()
        .single()
    } else {
      // Create new preferences
      result = await supabase
        .from('planning_preferences')
        .insert({
          user_id: userId,
          team_id: TEAM_ID,
          preferences,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving preferences:', result.error)
      return NextResponse.json(
        { error: 'Failed to save preferences' },
        { status: 500 }
      )
    }

    console.log(`Preferences saved for user ${userId}:`, preferences)

    return NextResponse.json({
      success: true,
      preferences: result.data.preferences
    })

  } catch (error) {
    console.error('Preferences POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    )
  }
}