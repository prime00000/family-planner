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
    console.log('DEBUG: Checking team members for TEAM_ID:', TEAM_ID)

    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select('user_id, display_name, users!inner(full_name, email)')
      .eq('team_id', TEAM_ID)

    if (error) {
      console.error('Error fetching team members:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Team members found:', teamMembers?.length || 0)
    
    const memberDetails = teamMembers?.map(m => ({
      user_id: m.user_id,
      display_name: m.display_name,
      full_name: m.users?.full_name,
      email: m.users?.email
    })) || []

    // Check specific UUID
    const targetUUID = '86f09a81-66c9-483b-9667-2ef9937b1119'
    const hasTargetUUID = memberDetails.some(m => m.user_id === targetUUID)
    
    return NextResponse.json({
      team_id: TEAM_ID,
      member_count: memberDetails.length,
      members: memberDetails,
      has_target_uuid: hasTargetUUID,
      target_uuid: targetUUID
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debug failed' },
      { status: 500 }
    )
  }
}