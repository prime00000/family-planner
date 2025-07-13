import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { AgentOrchestrator } from '@/lib/planning/agents/agent-orchestrator'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface DialogueRequest {
  adminInstructions: string
  weekStartDate?: string
  incompleteTasks?: any[]
  newItems?: {
    objectives: any[]
    tasks: any[]
    maintenance: any[]
  }
  teamMembers?: any[]
}

export async function POST(request: NextRequest) {
  console.log('V2 Dialogue endpoint called')
  
  try {
    // Check for feature flag
    if (process.env.USE_NEW_PLANNING_SYSTEM !== 'true') {
      return NextResponse.json(
        { error: 'New planning system not enabled' },
        { status: 403 }
      )
    }
    
    const body = await request.json() as DialogueRequest
    
    if (!body.adminInstructions || body.adminInstructions.trim().length === 0) {
      return NextResponse.json(
        { error: 'Admin instructions are required' },
        { status: 400 }
      )
    }
    
    // Get user ID from session/auth (simplified for now)
    const userId = request.headers.get('x-user-id') || 'system'
    
    // Calculate week start date
    const weekStartDate = body.weekStartDate || getNextMondayDate()
    
    // Use provided team members or fetch from DB
    let teamMembers: any[]
    if (body.teamMembers && body.teamMembers.length > 0) {
      teamMembers = body.teamMembers
    } else {
      console.log('Fetching team members...')
      const { data: teamMembersFromDB, error: teamError } = await supabase
        .from('team_members')
        .select('user_id, display_name, users!inner(full_name, email)')
        .eq('team_id', TEAM_ID)
      
      if (teamError || !teamMembersFromDB) {
        throw new Error(`Failed to fetch team members: ${teamError?.message}`)
      }
      
      teamMembers = teamMembersFromDB.map((member: any) => ({
        id: member.user_id,
        name: member.display_name || member.users?.full_name || 'Unknown',
        email: member.users?.email || 'unknown@email.com'
      }))
    }
    
    // Combine provided tasks or fetch from DB
    let backlogTasks: any[] = []
    
    // Add incomplete tasks if provided
    if (body.incompleteTasks && body.incompleteTasks.length > 0) {
      backlogTasks = body.incompleteTasks.map(t => ({
        ...t,
        tags: t.tags || [],
        status: 'active'
      }))
    }
    
    // Add new tasks if provided
    if (body.newItems?.tasks && body.newItems.tasks.length > 0) {
      const newTasks = body.newItems.tasks.map(t => ({
        ...t,
        id: t.id || `new-task-${Date.now()}-${Math.random()}`,
        tags: t.tags || [],
        status: 'new'
      }))
      backlogTasks = [...backlogTasks, ...newTasks]
    }
    
    // If no tasks provided, fetch from DB
    if (backlogTasks.length === 0) {
      console.log('Fetching backlog tasks from DB...')
      const { data: dbTasks, error: backlogError } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', TEAM_ID)
        .neq('status', 'completed')
        .order('importance', { ascending: false })
        .limit(100)
      
      if (backlogError) {
        throw new Error(`Failed to fetch backlog: ${backlogError.message}`)
      }
      
      backlogTasks = dbTasks || []
    }
    
    // Use provided objectives or fetch from DB
    let objectives: any[]
    if (body.newItems?.objectives && body.newItems.objectives.length > 0) {
      objectives = body.newItems.objectives
    } else {
      console.log('Fetching active objectives...')
      const { data: dbObjectives, error: objectivesError } = await supabase
        .from('objectives')
        .select('*')
        .eq('team_id', TEAM_ID)
        .eq('status', 'active')
        .order('importance', { ascending: false })
      
      if (objectivesError) {
        throw new Error(`Failed to fetch objectives: ${objectivesError.message}`)
      }
      
      objectives = dbObjectives || []
    }
    
    // Fetch preceding plans (last 4 weeks)
    console.log('Fetching recent plans...')
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    
    const { data: recentPlans, error: plansError } = await supabase
      .from('weekly_plans')
      .select('id, week_start_date, title, created_at')
      .eq('team_id', TEAM_ID)
      .gte('week_start_date', fourWeeksAgo.toISOString())
      .order('week_start_date', { ascending: false })
      .limit(4)
    
    if (plansError) {
      console.warn('Could not fetch recent plans:', plansError)
    }
    
    // Calculate plan statistics
    const precedingPlans = await Promise.all((recentPlans || []).map(async (plan) => {
      const { count: taskCount } = await supabase
        .from('plan_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('weekly_plan_id', plan.id)
      
      const { count: completedCount } = await supabase
        .from('plan_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('weekly_plan_id', plan.id)
        .eq('completed', true)
      
      const completionRate = taskCount ? Math.round((completedCount || 0) / taskCount * 100) : 0
      
      return {
        id: plan.id,
        week_start_date: plan.week_start_date,
        title: plan.title || 'Untitled Plan',
        task_count: taskCount || 0,
        completion_rate: completionRate
      }
    }))
    
    // Use provided maintenance items or fetch from DB
    let recurringTasksDue: any[]
    if (body.newItems?.maintenance && body.newItems.maintenance.length > 0) {
      recurringTasksDue = body.newItems.maintenance.map(item => ({
        id: item.id,
        description: item.description,
        frequency: item.frequency || 'weekly',
        last_completed_date: null,
        next_due_date: weekStartDate
      }))
    } else {
      console.log('Checking for recurring tasks...')
      const { data: maintenanceItems, error: maintenanceError } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('team_id', TEAM_ID)
        .eq('status', 'active')
      
      if (maintenanceError) {
        console.warn('Could not fetch maintenance items:', maintenanceError)
      }
      
      recurringTasksDue = (maintenanceItems || []).map(item => ({
        id: item.id,
        description: item.description,
        frequency: item.frequency || 'weekly',
        last_completed_date: null,
        next_due_date: weekStartDate
      }))
    }
    
    // Initialize orchestrator and start dialogue
    console.log('Starting agent orchestrator dialogue...')
    const orchestrator = new AgentOrchestrator()
    
    const result = await orchestrator.startDialogue({
      adminInstructions: body.adminInstructions,
      teamMembers,
      availableBacklog: backlogTasks || [],
      activeObjectives: objectives || [],
      precedingPlans,
      recurringTasksDue,
      weekStartDate,
      userId,
      teamId: TEAM_ID
    })
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
    // Store session ID in response for continuation
    const session = orchestrator.getSession()
    
    return NextResponse.json({
      dialoguePhase: result.dialogueResult,
      sessionId: session?.sessionId
    })
    
  } catch (error) {
    console.error('Dialogue endpoint error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process dialogue' },
      { status: 500 }
    )
  }
}

function getNextMondayDate(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilMonday)
  return nextMonday.toISOString().split('T')[0]
}