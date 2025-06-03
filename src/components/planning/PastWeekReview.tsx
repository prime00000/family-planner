'use client'

import { useState, useEffect, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { 
  getPastWeekTasks, 
  markTaskComplete, 
  markTaskIncomplete,
  bulkUpdateTasks,
  type PlanningTask 
} from '@/lib/planning/data'
import { usePlanningStore } from '@/stores/planningStore'
import { ArrowRight, Send, Star, Flame } from 'lucide-react'

const TEAM_ID = 'ada25a92-25fa-4ca2-8d35-eb9b71f97e4b'

interface ParsedCommand {
  action: 'complete' | 'delete' | 'unknown'
  filter?: string
}

function parseAiCommand(command: string): ParsedCommand {
  const lowerCommand = command.toLowerCase()
  
  if (lowerCommand.includes('mark complete') || lowerCommand.includes('complete')) {
    return {
      action: 'complete',
      filter: lowerCommand.replace(/mark complete|complete/g, '').trim()
    }
  }
  
  if (lowerCommand.includes('delete')) {
    return {
      action: 'delete',
      filter: lowerCommand.replace('delete', '').trim()
    }
  }

  return { action: 'unknown' }
}

interface TasksByAssignee {
  [assignee: string]: PlanningTask[]
}

export function PastWeekReview() {
  const [completedTasks, setCompletedTasks] = useState<PlanningTask[]>([])
  const [incompleteTasks, setIncompleteTasks] = useState<PlanningTask[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiCommand, setAiCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const { updatePhaseData, setPhase } = usePlanningStore()
  const { toast } = useToast()

  // Group completed tasks by assignee
  const groupedCompletedTasks = completedTasks.reduce((acc: TasksByAssignee, task) => {
    const assigneeName = task.assignee?.full_name || 'Unassigned'
    if (!acc[assigneeName]) {
      acc[assigneeName] = []
    }
    acc[assigneeName].push(task)
    return acc
  }, {})

  // Sort assignee groups alphabetically, but keep Unassigned at the end
  const sortedAssignees = Object.keys(groupedCompletedTasks).sort((a, b) => {
    if (a === 'Unassigned') return 1
    if (b === 'Unassigned') return -1
    return a.localeCompare(b)
  })

  const refreshTasks = async () => {
    try {
      setError(null)
      const weekStartDate = new Date()
      weekStartDate.setDate(weekStartDate.getDate() - 7)
      weekStartDate.setHours(0, 0, 0, 0)
      
      console.log('Week start date:', weekStartDate.toISOString())
      console.log('Fetching tasks for week:', weekStartDate)
      
      const tasks = await getPastWeekTasks(TEAM_ID)
      console.log('Fetched data:', tasks)
      console.log('First completed task:', tasks.completed[0])
      console.log('First incomplete task:', tasks.incomplete[0])
      
      setCompletedTasks(tasks.completed)
      setIncompleteTasks(tasks.incomplete)
      console.log('State updated - completed:', tasks.completed.length, 'incomplete:', tasks.incomplete.length)
      updatePhaseData('past_week', {
        completedCount: tasks.completed.length,
        incompleteCount: tasks.incomplete.length
      })
      setIsLoading(false)
    } catch (err) {
      console.log('Error fetching:', err)
      const message = err instanceof Error ? err.message : 'Failed to load tasks'
      setError(message)
      setIsLoading(false)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message
      })
    }
  }

  useEffect(() => {
    refreshTasks()
  }, [updatePhaseData, refreshTasks])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(incompleteTasks.map(task => task.id)))
    } else {
      setSelectedTasks(new Set())
    }
  }

  const handleTaskSelect = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks)
    if (checked) {
      newSelected.add(taskId)
    } else {
      newSelected.delete(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleMarkComplete = async (taskId: string, description: string) => {
    try {
      setIsProcessing(true)
      await markTaskComplete(taskId)
      await refreshTasks()
      
      toast({
        title: 'Task completed',
        description: (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">{description}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await markTaskIncomplete(taskId)
                  await refreshTasks()
                  toast({
                    title: 'Task restored',
                    description: 'Task marked as incomplete'
                  })
                } catch (err) {
                  console.error('Undo complete error:', err)
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to undo task completion'
                  })
                }
              }}
            >
              Undo
            </Button>
          </div>
        ),
        duration: 3000
      })
    } catch (err) {
      console.error('Complete task error:', err)
      const message = err instanceof Error ? err.message : 'Failed to complete task'
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleMarkIncomplete = async (taskId: string) => {
    try {
      setIsProcessing(true)
      await markTaskIncomplete(taskId)
      await refreshTasks()
      
      toast({
        title: 'Task marked incomplete',
        description: (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">Task moved back to pending</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await markTaskComplete(taskId)
                  await refreshTasks()
                  toast({
                    title: 'Task restored',
                    description: 'Task marked as complete'
                  })
                } catch (err) {
                  console.error('Undo incomplete error:', err)
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to undo task status'
                  })
                }
              }}
            >
              Undo
            </Button>
          </div>
        ),
        duration: 3000
      })
    } catch (err) {
      console.error('Mark incomplete error:', err)
      const message = err instanceof Error ? err.message : 'Failed to update task'
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAiCommand = async () => {
    try {
      setIsProcessing(true)
      const command = parseAiCommand(aiCommand)
      
      if (command.action === 'complete') {
        const tasksToUpdate = Array.from(selectedTasks)
        if (tasksToUpdate.length === 0) {
          throw new Error('No tasks selected')
        }

        await bulkUpdateTasks(tasksToUpdate, { status: 'completed' })
        await refreshTasks()
        setSelectedTasks(new Set())
        setAiCommand('')
        
        toast({
          title: 'Tasks updated',
          description: `${tasksToUpdate.length} tasks marked as complete`
        })
      } else {
        toast({
          variant: 'default',
          title: 'Command not supported',
          description: 'This command type is not yet supported'
        })
      }
    } catch (err) {
      console.error('AI command error:', err)
      const message = err instanceof Error ? err.message : 'Failed to process command'
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message
      })
    } finally {
      setIsProcessing(false)
    }
  }

  console.log('Rendering - loading:', isLoading, 'completed:', completedTasks.length, 'incomplete:', incompleteTasks.length)

  if (isLoading) {
    return (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Loading tasks...</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-800">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshTasks}
          className="mt-2"
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-48">
      {/* Completed Tasks Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span>🎉</span> Completed This Week
        </h2>
        <div className="space-y-6">
          {sortedAssignees.map(assigneeName => (
            <div key={assigneeName} className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">{assigneeName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedCompletedTasks[assigneeName].map(task => (
                  <Card key={task.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={true}
                        onCheckedChange={(checked) => !checked && handleMarkIncomplete(task.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">{task.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {task.importance && (
                            <Badge variant="secondary">
                              Importance: {task.importance}
                            </Badge>
                          )}
                          {task.urgency && (
                            <Badge variant="secondary">
                              Urgency: {task.urgency}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {sortedAssignees.length === 0 && (
            <p className="text-sm text-gray-500 italic">No completed tasks this week</p>
          )}
        </div>
      </section>

      {/* Incomplete Tasks Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>📋</span> Didn&apos;t Get Done
          </h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-4 px-4 mb-2">
            <span className="text-sm font-medium text-gray-500">Done?</span>
            <div /> {/* Spacer */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Multi-select</span>
              <Checkbox
                id="select-all"
                checked={selectedTasks.size === incompleteTasks.length && incompleteTasks.length > 0}
                onCheckedChange={handleSelectAll}
              />
            </div>
          </div>

          {incompleteTasks.map(task => (
            <Card key={task.id} className="p-4">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={false}
                  onCheckedChange={(checked) => checked && handleMarkComplete(task.id, task.description)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-gray-900">{task.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-gray-500">
                      {task.assignee?.full_name || 'Unassigned'}
                    </span>
                    {task.importance && (
                      <div className="flex items-center gap-1">
                        <Star 
                          className={`h-4 w-4 ${
                            task.importance >= 3 ? 'text-yellow-500' :
                            task.importance >= 2 ? 'text-yellow-400' : 'text-yellow-300'
                          }`}
                          fill="currentColor"
                        />
                        <span className="text-xs text-gray-500">{task.importance}</span>
                      </div>
                    )}
                    {task.urgency && (
                      <div className="flex items-center gap-1">
                        <Flame 
                          className={`h-4 w-4 ${
                            task.urgency >= 3 ? 'text-red-500' :
                            task.urgency >= 2 ? 'text-red-400' : 'text-red-300'
                          }`}
                          fill="currentColor"
                        />
                        <span className="text-xs text-gray-500">{task.urgency}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Checkbox
                  checked={selectedTasks.has(task.id)}
                  onCheckedChange={(checked) => handleTaskSelect(task.id, checked as boolean)}
                  className="mt-1"
                />
              </div>
            </Card>
          ))}
          {incompleteTasks.length === 0 && (
            <p className="text-sm text-gray-500 italic">No incomplete tasks</p>
          )}
        </div>
      </section>

      {/* Selection Banner */}
      {selectedTasks.size > 0 && (
        <div className="fixed bottom-28 left-0 right-0 bg-blue-50/90 backdrop-blur-sm border-t border-blue-100 py-2 px-4 z-50">
          <div className="max-w-4xl mx-auto">
            <p className="text-blue-700 font-medium">
              What shall I do with these {selectedTasks.size} items?
            </p>
          </div>
        </div>
      )}

      {/* AI Command Interface */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-40">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                value={aiCommand}
                onChange={(e) => setAiCommand(e.target.value)}
                placeholder='Try "Mark all shopping tasks complete"'
                className="w-full"
                disabled={isProcessing}
              />
            </div>
            <Button 
              onClick={handleAiCommand}
              disabled={isProcessing || (!aiCommand && selectedTasks.size === 0)}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            onClick={() => setPhase('new_items')}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={isProcessing}
          >
            Next: New Items <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
} 