"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Home, Lightbulb, ListTodo, Wrench, CalendarIcon, Plus } from "lucide-react"
import { TaskForm, type TaskFormData } from "@/components/forms/TaskForm"
import { ObjectiveForm, type ObjectiveFormData } from "@/components/forms/ObjectiveForm"
import { MaintenanceForm, type MaintenanceFormData } from "@/components/forms/MaintenanceForm"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth/AuthContext"

type SupabaseError = {
  message?: string;
  code?: string;
  details?: unknown;
  hint?: string;
};

interface Task {
  id: string
  title: string
  assignee: string
  completed: boolean
  status: string
  importance?: number
  urgency?: number
  created_at: string
  updated_at: string
}

interface TaskWithUser {
  id: string
  description: string  // This matches the database field
  status: string
  importance: number | null
  urgency: number | null
  created_at: string | null
  updated_at: string | null
  day_of_week: number | null  // Add this field to match the database schema
  users: {
    full_name: string
  }
}

interface TagData {
  id: string
  name: string
}

const TEAM_ID = 'ada25a92-25fa-4ca2-8d35-eb9b71f97e4b'
const USER_ID = 'a0000000-0000-0000-0000-000000000001'

export default function FamilyTaskPlanner() {
  const { user } = useAuth()
  const [selectedUser, setSelectedUser] = useState("All Tasks")
  const [activeTab, setActiveTab] = useState("home")
  const [manualAddDay, setManualAddDay] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Record<string, Task[]>>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
    anytime: [],
    deck: [],
    completed: [],
  })
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true,
    anytime: true,
    deck: true,
    completed: false,
  })
  const [draggedTask, setDraggedTask] = useState<{ task: Task; fromSection: string } | null>(null)
  const [tagMap, setTagMap] = useState<Record<string, string>>({})
  const [isLoadingTags, setIsLoadingTags] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [undoNotification, setUndoNotification] = useState<{
    message: string;
    task: Task;
    fromSection: string;
    toSection: string;
  } | null>(null)

  const users = ["All Tasks", "Kurt", "Jessica", "Barb", "Benjamin", "Eliana", "Elikai", "Konrad", "Avi Grace"]
  const sections = [
    { key: "monday", name: "Monday" },
    { key: "tuesday", name: "Tuesday" },
    { key: "wednesday", name: "Wednesday" },
    { key: "thursday", name: "Thursday" },
    { key: "friday", name: "Friday" },
    { key: "saturday", name: "Saturday" },
    { key: "sunday", name: "Sunday" },
    { key: "anytime", name: "Anytime This Week" },
    { key: "deck", name: "Deck" },
    { key: "completed", name: "Completed Tasks" },
  ]

  const dayMapping = useMemo(() => ({ 
    monday: 1, 
    tuesday: 2, 
    wednesday: 3, 
    thursday: 4, 
    friday: 5, 
    saturday: 6, 
    sunday: 0, 
    anytime: 7 
  }), [])

  // Fetch tasks when component mounts
  useEffect(() => {
    async function fetchTasks() {
      try {
        setIsLoadingTasks(true)
        setError(null)

        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select(`
            *,
            users!assignee_id (
              full_name
            )
          `)
          .eq('team_id', TEAM_ID)
          .order('created_at', { ascending: false })

        if (tasksError) throw tasksError

        // Transform tasks and group by section
        const transformedTasks = (tasksData as unknown as TaskWithUser[]).reduce((acc, task) => {
          const transformedTask: Task = {
            id: task.id,
            title: task.description,
            assignee: task.users?.full_name || 'Unassigned',
            completed: task.status === 'completed',
            status: task.status || 'pending',
            importance: task.importance ?? undefined,
            urgency: task.urgency ?? undefined,
            created_at: task.created_at || new Date().toISOString(),
            updated_at: task.updated_at || new Date().toISOString(),
          }

          // Group tasks by day_of_week
          if (task.status === 'completed') {
            acc.completed.push(transformedTask)
          } else if (task.status === 'deck') {
            acc.deck.push(transformedTask)
          } else {
            // Map day_of_week number back to section key
            const dayKey = Object.entries(dayMapping).find(([, value]) => value === task.day_of_week)?.[0] || 'anytime'
            acc[dayKey].push(transformedTask)
          }

          return acc
        }, {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
          anytime: [],
          deck: [],
          completed: [],
        } as Record<string, Task[]>)

        setTasks(transformedTasks)
      } catch (err) {
        console.error('Error fetching tasks:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          code: (err as SupabaseError)?.code,
          details: (err as SupabaseError)?.details,
          hint: (err as SupabaseError)?.hint,
          fullError: err
        })
        setError(err instanceof Error ? err.message : 'Failed to load tasks')
      } finally {
        setIsLoadingTasks(false)
      }
    }

    fetchTasks()
  }, [dayMapping, refreshTrigger])

  // Fetch tags when component mounts
  useEffect(() => {
    async function fetchTags() {
      try {
        setIsLoadingTags(true)
        const { data: tags, error: tagError } = await supabase
          .from('tags')
          .select('id, name')
          .eq('team_id', TEAM_ID)

        if (tagError) throw tagError

        // Create a map of tag names to IDs
        const newTagMap = (tags as TagData[]).reduce((acc, tag) => {
          // Convert database tag names to match form tag IDs
          const formTagId = tag.name.toLowerCase().replace(/\s+/g, '')
          acc[formTagId] = tag.id
          return acc
        }, {} as Record<string, string>)

        setTagMap(newTagMap)
      } catch (err) {
        console.error('Error fetching tags:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          code: (err as SupabaseError)?.code,
          details: (err as SupabaseError)?.details,
          hint: (err as SupabaseError)?.hint,
          fullError: err
        })
        setError(err instanceof Error ? err.message : 'Failed to load tags')
      } finally {
        setIsLoadingTags(false)
      }
    }

    fetchTags()
  }, [])

  const filterTasks = (sectionTasks: Task[]) => {
    if (selectedUser === "All Tasks") return sectionTasks
    return sectionTasks.filter((task) => task.assignee === selectedUser)
  }

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  const toggleTaskComplete = async (taskId: string, sectionKey: string) => {
    try {
      const task = tasks[sectionKey].find(t => t.id === taskId)
      if (!task) return

      const newStatus = task.completed ? 'pending' : 'completed'
      const originalSection = sectionKey
      const targetSection = newStatus === 'completed' ? 'completed' : originalSection

      // Optimistically update UI
      setTasks(prev => {
        const updatedTasks = { ...prev }
        // Remove from current section
        updatedTasks[originalSection] = prev[originalSection].filter(t => t.id !== taskId)
        // Add to target section with updated status
        const updatedTask = {
          ...task,
          completed: !task.completed,
          status: newStatus
        }
        updatedTasks[targetSection] = [...prev[targetSection], updatedTask]
        return updatedTasks
      })

      // Show undo notification
      setUndoNotification({
        message: newStatus === 'completed' ? 'Task marked as complete' : 'Task marked as incomplete',
        task,
        fromSection: originalSection,
        toSection: targetSection
      })

      // Clear notification after 3 seconds
      setTimeout(() => {
        setUndoNotification(null)
      }, 3000)

      // Update database
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (updateError) throw updateError

    } catch (err) {
      console.error('Error toggling task completion:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as SupabaseError)?.code,
        details: (err as SupabaseError)?.details,
        hint: (err as SupabaseError)?.hint,
        fullError: err
      })
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
  }

  const handleUndoTaskCompletion = async (task: Task, fromSection: string, toSection: string) => {
    try {
      // Revert local state
      setTasks(prev => {
        const updatedTasks = { ...prev }
        // Remove from current section
        updatedTasks[toSection] = prev[toSection].filter(t => t.id !== task.id)
        // Add back to original section
        updatedTasks[fromSection] = [...prev[fromSection], task]
        return updatedTasks
      })

      // Update database
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          status: task.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)

      if (updateError) throw updateError

      // Clear notification
      setUndoNotification(null)

    } catch (err) {
      console.error('Error undoing task completion:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as SupabaseError)?.code,
        details: (err as SupabaseError)?.details,
        hint: (err as SupabaseError)?.hint,
        fullError: err
      })
      setError(err instanceof Error ? err.message : 'Failed to undo task update')
    }
  }

  const handleDragStart = (task: Task, fromSection: string) => {
    setDraggedTask({ task, fromSection })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, toSection: string) => {
    e.preventDefault()
    if (!draggedTask || toSection === "completed") return

    const { task, fromSection } = draggedTask

    if (fromSection !== toSection) {
      setTasks((prev) => ({
        ...prev,
        [fromSection]: prev[fromSection].filter((t) => t.id !== task.id),
        [toSection]: [...prev[toSection], task],
      }))
    }

    setDraggedTask(null)
  }

  const handleTaskSubmit = async (data: TaskFormData) => {
    try {
      setError(null)

      // Map form tag IDs to database tag IDs
      const databaseTagIds = data.tags
        .map(tagName => tagMap[tagName])
        .filter(Boolean) // Remove any undefined tags

      // Prepare task data
      const taskData = {
        team_id: TEAM_ID,
        submitted_by: USER_ID,
        description: data.description,
        importance: data.importance,
        urgency: data.urgency,
        assignee_id: data.assignee_id || null,  // Include assignee_id
        objective_id: (data.objectiveId === 'none' || data.objectiveId?.startsWith('obj')) ? null : data.objectiveId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Insert task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single()

      if (taskError) throw taskError

      // If we have tags, insert them
      if (databaseTagIds.length > 0) {
        const tagInserts = databaseTagIds.map(tagId => ({
          task_id: task.id,
          tag_id: tagId,
        }))

        const { error: tagError } = await supabase
          .from('task_tags')
          .insert(tagInserts)

        if (tagError) {
          console.error('Error saving tags:', tagError)
          // Don't throw here - task was saved successfully
        }
      }

      console.log('Task saved successfully:', task)
      console.log('Should refresh task list here')

      // Reset error state on success
      setError(null)

    } catch (err) {
      console.error('Error saving task:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as SupabaseError)?.code,
        details: (err as SupabaseError)?.details,
        hint: (err as SupabaseError)?.hint,
        fullError: err
      })
      setError(err instanceof Error ? err.message : 'Failed to save task')
      throw err // Let the form handle the error display
    }
  }

  const handleObjectiveSubmit = async (data: ObjectiveFormData) => {
    try {
      setError(null)

      // Prepare objective data
      const objectiveData = {
        team_id: TEAM_ID,
        submitted_by: USER_ID,
        description: data.description,
        importance: data.importance,
        urgency: null, // Objectives don't have urgency
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Insert objective
      const { data: objective, error: objectiveError } = await supabase
        .from('objectives')
        .insert(objectiveData)
        .select()
        .single()

      if (objectiveError) throw objectiveError

      console.log('Objective saved successfully:', objective)

      // Reset error state on success
      setError(null)

    } catch (err) {
      console.error('Error saving objective:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as SupabaseError)?.code,
        details: (err as SupabaseError)?.details,
        hint: (err as SupabaseError)?.hint,
        fullError: err
      })
      setError(err instanceof Error ? err.message : 'Failed to save objective')
      throw err // Let the form handle the error display
    }
  }

  const handleMaintenanceSubmit = async (data: MaintenanceFormData) => {
    try {
      setError(null)

      // Prepare maintenance data
      const maintenanceData = {
        team_id: TEAM_ID,
        submitted_by: USER_ID,
        description: data.description,
        importance: data.importance,
        frequency: data.frequency.toLowerCase(), // Store frequency in lowercase
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Insert maintenance item
      const { data: maintenanceItem, error: maintenanceError } = await supabase
        .from('maintenance_items')
        .insert(maintenanceData)
        .select()
        .single()

      if (maintenanceError) throw maintenanceError

      console.log('Maintenance item saved successfully:', maintenanceItem)

      // Note: Tags are skipped for now until we add maintenance-specific tags to the database
      // We'll need to add a separate migration to create these tags

      // Reset error state on success
      setError(null)

    } catch (err) {
      console.error('Error saving maintenance item:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as SupabaseError)?.code,
        details: (err as SupabaseError)?.details,
        hint: (err as SupabaseError)?.hint,
        fullError: err
      })
      setError(err instanceof Error ? err.message : 'Failed to save maintenance item')
      throw err // Let the form handle the error display
    }
  }

  const handleManualTaskSubmit = async (data: TaskFormData, sectionKey: string) => {
    try {
      setError(null)

      // Map form tag IDs to database tag IDs
      const databaseTagIds = data.tags
        .map(tagName => tagMap[tagName])
        .filter(Boolean)

      // Get the day_of_week value from dayMapping
      const day_of_week = dayMapping[sectionKey as keyof typeof dayMapping] ?? 7

      // Prepare task data
      const taskData = {
        team_id: TEAM_ID,
        submitted_by: USER_ID,
        description: data.description,
        importance: data.importance,
        urgency: data.urgency,
        assignee_id: data.assignee_id || null,
        day_of_week,  // Use the mapped day value
        objective_id: (data.objectiveId === 'none' || data.objectiveId?.startsWith('obj')) ? null : data.objectiveId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Insert task
      const { data: insertedTask, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single()

      if (taskError) throw taskError

      // If we have tags, insert them
      if (databaseTagIds.length > 0) {
        const tagInserts = databaseTagIds.map(tagId => ({
          task_id: insertedTask.id,
          tag_id: tagId,
        }))

        const { error: tagError } = await supabase
          .from('task_tags')
          .insert(tagInserts)

        if (tagError) {
          console.error('Error saving tags:', tagError)
        }
      }

      // Trigger a refresh of all tasks
      setRefreshTrigger(prev => prev + 1)

      // Close the form
      setManualAddDay(null)

      // Reset error state on success
      setError(null)

    } catch (err) {
      console.error('Error saving task:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as SupabaseError)?.code,
        details: (err as SupabaseError)?.details,
        hint: (err as SupabaseError)?.hint,
        fullError: err
      })
      setError(err instanceof Error ? err.message : 'Failed to save task')
      throw err
    }
  }

  const TaskItem = ({ task, sectionKey }: { task: Task; sectionKey: string }) => (
    <div
      className="flex items-center gap-3 py-2 hover:bg-blue-50 rounded cursor-move"
      draggable
      onDragStart={() => handleDragStart(task, sectionKey)}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => toggleTaskComplete(task.id, sectionKey)}
        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
      />
      <span className={`flex-1 text-sm ${task.completed ? "line-through text-gray-500" : "text-gray-900"}`}>
        {task.title}
        {selectedUser === "All Tasks" && <span className="text-blue-600 ml-2 font-medium">({task.assignee})</span>}
      </span>
    </div>
  )

  const SectionHeader = ({ section, taskCount }: { section: (typeof sections)[0]; taskCount: number }) => (
    <div className="flex items-center justify-between w-full">
      <CollapsibleTrigger className="flex items-center gap-2 flex-1 py-3 px-4 text-left hover:bg-blue-50 rounded">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-900 text-base">{section.name}</h2>
          <span className="text-xs text-gray-500">({taskCount})</span>
        </div>
      </CollapsibleTrigger>
      {section.key !== "completed" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-100 mr-2"
          onClick={(e) => {
            e.stopPropagation()
            setManualAddDay(section.key)
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-screen bg-white">
      {/* Fixed Header */}
      <header className="bg-blue-600 text-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Family Weekly Planner</h1>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-32 bg-blue-700 border-blue-500 text-white text-sm">
              <SelectValue>{selectedUser}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user} value={user}>
                  {user}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Undo Notification */}
      {undoNotification && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span>{undoNotification.message}</span>
          <button
            onClick={() => handleUndoTaskCompletion(
              undoNotification.task,
              undoNotification.fromSection,
              undoNotification.toSection
            )}
            className="text-blue-300 hover:text-blue-200 font-medium"
          >
            Undo
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 pb-24">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {isLoadingTasks ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">Loading tasks...</p>
              </div>
            ) : (
              sections.map((section) => {
                const filteredTasks = filterTasks(tasks[section.key])
                // Only hide completed section when empty
                if (section.key === "completed" && filteredTasks.length === 0 && selectedUser !== "All Tasks") {
                  return null
                }

                return (
                  <Collapsible
                    key={section.key}
                    open={openSections[section.key]}
                    onOpenChange={() => toggleSection(section.key)}
                    className="mb-4"
                  >
                    <div
                      className="border-b border-gray-100 pb-2"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, section.key)}
                    >
                      <SectionHeader section={section} taskCount={filteredTasks.length} />

                      <CollapsibleContent className="mt-2">
                        {filteredTasks.length > 0 ? (
                          <div className="space-y-1 pl-2">
                            {filteredTasks.map((task) => (
                              <TaskItem key={task.id} task={task} sectionKey={section.key} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic py-2 pl-2">No tasks</p>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              })
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Fixed Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 px-2 py-1 overflow-hidden">
        <div className="flex justify-around">
          {[
            { icon: Home, key: "home", label: "Home" },
            { icon: Lightbulb, key: "objectives", label: "Objectives" },
            { icon: ListTodo, key: "tasks", label: "Tasks" },
            { icon: Wrench, key: "maintenance", label: "Maintenance" },
            { icon: CalendarIcon, key: "plan", label: "Plan", isAdmin: true },
          ].map(({ icon: Icon, key, label, isAdmin }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 px-2 ${
                activeTab === key ? "text-blue-600 bg-blue-50" : isAdmin ? "text-gray-400" : "text-gray-600"
              }`}
              onClick={() => setActiveTab(key)}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </Button>
          ))}
        </div>
      </nav>

      {/* Task Form */}
      {activeTab === "tasks" && !isLoadingTags && (
        <TaskForm
          onClose={() => setActiveTab("home")}
          onSubmit={handleTaskSubmit}
        />
      )}

      {/* Manual Add Task Form */}
      {manualAddDay && (
        <TaskForm
          onClose={() => setManualAddDay(null)}
          onSubmit={(data) => handleManualTaskSubmit(data, manualAddDay)}
          defaultAssignee={user?.id}
          isManualTask={true}
        />
      )}

      {/* Objective Form */}
      {activeTab === "objectives" && (
        <ObjectiveForm
          onClose={() => setActiveTab("home")}
          onSubmit={handleObjectiveSubmit}
        />
      )}

      {/* Maintenance Form */}
      {activeTab === "maintenance" && (
        <MaintenanceForm
          onClose={() => setActiveTab("home")}
          onSubmit={handleMaintenanceSubmit}
        />
      )}
    </div>
  )
}
