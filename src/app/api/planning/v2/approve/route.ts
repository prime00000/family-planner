import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { AgentOrchestrator } from '@/lib/planning/agents/agent-orchestrator'
import { TEAM_ID } from '@/lib/constants'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// In-memory session storage for now (in production, use Redis or DB)
const orchestratorSessions = new Map<string, AgentOrchestrator>()

interface ApprovalRequest {
  sessionId: string
  approved: boolean
  adjustments?: string
  adminInstructions: string // Original instructions for context
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
  console.log('V2 Approval endpoint called')
  
  try {
    // Check for feature flag
    if (process.env.USE_NEW_PLANNING_SYSTEM !== 'true') {
      return NextResponse.json(
        { error: 'New planning system not enabled' },
        { status: 403 }
      )
    }
    
    const body = await request.json() as ApprovalRequest
    
    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }
    
    // For now, we'll just validate that the session ID looks valid
    // In production, this would retrieve the session from persistent storage
    if (!body.sessionId.startsWith('session-')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      )
    }
    
    if (typeof body.approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Approval status is required' },
        { status: 400 }
      )
    }
    
    // Get user ID from session/auth (simplified for now)
    const userId = request.headers.get('x-user-id') || 'system'
    
    // For now, create a new orchestrator since we don't have persistent sessions
    // In production, this would retrieve the existing session
    const orchestrator = new AgentOrchestrator()
    
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
    
    // Fetch preceding plans
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
    const weekStartDate = body.weekStartDate || getNextMondayDate()
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
    
    // Execute the approved plan
    console.log('Executing approved plan with orchestrator...')
    const result = await orchestrator.executeApprovedPlan(
      {
        adminInstructions: body.adminInstructions,
        teamMembers,
        availableBacklog: backlogTasks || [],
        activeObjectives: objectives || [],
        precedingPlans,
        recurringTasksDue,
        weekStartDate,
        userId,
        teamId: TEAM_ID
      },
      {
        approved: body.approved,
        adjustments: body.adjustments
      }
    )
    
    if (result.error) {
      console.error('Orchestrator error:', result.error)
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
    // Check if we need to pause for reviews
    if (result.needsSelectionReview) {
      console.log('Pausing for selection review')
      return NextResponse.json({
        needsSelectionReview: true,
        selectionReviewData: result.selectionReviewData,
        sessionId: body.sessionId
      })
    }
    
    if (result.needsAssignmentReview) {
      console.log('Pausing for assignment review')
      return NextResponse.json({
        needsAssignmentReview: true,
        assignmentReviewData: result.assignmentReviewData,
        sessionId: body.sessionId
      })
    }
    
    if (!result.finalPlan) {
      console.error('No plan generated, result:', result)
      return NextResponse.json(
        { error: 'No plan generated' },
        { status: 500 }
      )
    }
    
    // Log token usage summary
    const session = orchestrator.getSession()
    console.log('=== PLAN GENERATION COMPLETE ===')
    console.log('Session ID:', session?.sessionId)
    console.log('Total phases completed:', session?.executionState?.completedPhases.length || 0)
    console.log('Plan title:', result.finalPlan.title)
    console.log('Total tasks:', result.finalPlan.statistics.total_tasks)
    console.log('================================')
    
    // Clean up session
    orchestratorSessions.delete(body.sessionId)
    
    // Return the plan directly to match VibePlanFile interface
    return NextResponse.json(result.finalPlan)
    
  } catch (error) {
    console.error('Approval endpoint error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Try to provide more specific error message
    let errorMessage = 'Failed to execute approved plan'
    if (error instanceof Error) {
      if (error.message.includes('Invalid JSON')) {
        errorMessage = 'AI generated invalid JSON response. This may be due to response length or formatting issues.'
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. The plan generation is taking longer than expected.'
      } else {
        errorMessage = error.message
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Store orchestrator session (for use with the dialogue endpoint)
export function storeOrchestratorSession(sessionId: string, orchestrator: AgentOrchestrator): void {
  orchestratorSessions.set(sessionId, orchestrator)
  
  // Clean up old sessions after 30 minutes
  setTimeout(() => {
    orchestratorSessions.delete(sessionId)
  }, 30 * 60 * 1000)
}

// Retrieve orchestrator session
export function getOrchestratorSession(sessionId: string): AgentOrchestrator | undefined {
  return orchestratorSessions.get(sessionId)
}

function getNextMondayDate(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilMonday)
  return nextMonday.toISOString().split('T')[0]
}