import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    // First, let's get all users to see who we can add
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name')

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    console.log('Found users:', allUsers?.length || 0)
    
    // Check if team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', TEAM_ID)
      .single()

    if (teamError || !team) {
      throw new Error(`Team not found with ID ${TEAM_ID}: ${teamError?.message}`)
    }

    console.log('Found team:', team.name)

    // Get existing team members to avoid duplicates
    const { data: existingMembers } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', TEAM_ID)

    const existingUserIds = new Set(existingMembers?.map(m => m.user_id) || [])
    console.log('Existing team members:', existingUserIds.size)

    // Add all users to the team (or specific ones based on your needs)
    const membersToAdd = []
    
    for (const user of allUsers || []) {
      if (!existingUserIds.has(user.id)) {
        // Determine display name from email or full name
        const emailName = user.email.split('@')[0]
        const displayName = user.full_name || 
          emailName.charAt(0).toUpperCase() + emailName.slice(1)

        membersToAdd.push({
          team_id: TEAM_ID,
          user_id: user.id,
          display_name: displayName,
          role: 'member' // You can adjust roles as needed
        })
      }
    }

    console.log('Members to add:', membersToAdd.length)

    if (membersToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('team_members')
        .insert(membersToAdd)

      if (insertError) {
        throw new Error(`Failed to add team members: ${insertError.message}`)
      }
    }

    // Fetch final team member list
    const { data: finalMembers } = await supabase
      .from('team_members')
      .select('user_id, display_name, role, users!inner(email, full_name)')
      .eq('team_id', TEAM_ID)

    return NextResponse.json({
      success: true,
      message: `Added ${membersToAdd.length} members to team`,
      team: {
        id: team.id,
        name: team.name
      },
      members: finalMembers?.map(m => ({
        user_id: m.user_id,
        display_name: m.display_name,
        role: m.role,
        email: m.users?.email,
        full_name: m.users?.full_name
      })) || [],
      users_found: allUsers?.length || 0,
      members_added: membersToAdd.length
    })

  } catch (error) {
    console.error('Error setting up team:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to setup team' },
      { status: 500 }
    )
  }
}