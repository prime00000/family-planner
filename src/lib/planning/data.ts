import { supabase } from '@/lib/supabase'

export interface PlanningTask {
  id: string
  description: string
  status: string
  importance: number | null
  urgency: number | null
  created_at: string
  updated_at: string
  assignee: {
    full_name: string
  }
  tags: {
    name: string
  }[]
}

interface PastWeekTasks {
  completed: PlanningTask[]
  incomplete: PlanningTask[]
}

export async function markTaskComplete(taskId: string): Promise<void> {
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      updated_at: now
    })
    .eq('id', taskId)

  if (updateError) throw updateError
}

export async function markTaskIncomplete(taskId: string): Promise<void> {
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      status: 'pending',
      updated_at: now
    })
    .eq('id', taskId)

  if (updateError) throw updateError
}

export async function bulkUpdateTasks(
  taskIds: string[],
  updates: Partial<PlanningTask>
): Promise<void> {
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      ...updates,
      updated_at: now
    })
    .in('id', taskIds)

  if (updateError) throw updateError
}

export async function getPastWeekTasks(teamId: string): Promise<PastWeekTasks> {
  // Get date for 7 days ago
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  console.log('Query start date:', weekAgo.toISOString())

  // Fetch tasks from the past week
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      id,
      description,
      status,
      importance,
      urgency,
      created_at,
      updated_at,
      users!assignee_id (
        full_name
      ),
      task_tags (
        tags (
          name
        )
      )
    `)
    .eq('team_id', teamId)
    // .gte('created_at', weekAgo.toISOString()) // Temporarily commented out to fetch all tasks
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching past week tasks:', error)
    throw error
  }

  console.log('Raw tasks from DB:', tasks)

  // Transform and split tasks into completed and incomplete
  const transformedTasks = (tasks || []).map((task: any): PlanningTask => ({
    id: task.id,
    description: task.description,
    status: task.status,
    importance: task.importance,
    urgency: task.urgency,
    created_at: task.created_at,
    updated_at: task.updated_at,
    assignee: task.users || { full_name: 'Unassigned' },
    tags: task.task_tags?.map((tt: any) => tt.tags) || []
  }))

  return {
    completed: transformedTasks.filter(task => task.status === 'completed'),
    incomplete: transformedTasks.filter(task => task.status === 'pending')
  }
} 