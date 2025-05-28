"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Home, Lightbulb, ListTodo, Wrench, CalendarIcon, Plus } from "lucide-react"

interface Task {
  id: string
  title: string
  assignee: string
  completed: boolean
}

const mockTasks: Record<string, Task[]> = {
  monday: [
    { id: "1", title: "Take out trash", assignee: "Kurt", completed: false },
    { id: "2", title: "Pack lunch for school", assignee: "Wife", completed: false },
  ],
  tuesday: [
    { id: "3", title: "Soccer practice pickup", assignee: "Wife", completed: false },
    { id: "4", title: "Math homework", assignee: "Child1", completed: false },
  ],
  wednesday: [
    { id: "5", title: "Grocery shopping", assignee: "Kurt", completed: false },
    { id: "6", title: "Piano lesson", assignee: "Child2", completed: false },
  ],
  thursday: [
    { id: "7", title: "Laundry", assignee: "Wife", completed: false },
    { id: "8", title: "Science project", assignee: "Child1", completed: false },
  ],
  friday: [
    { id: "9", title: "Movie night prep", assignee: "Kurt", completed: false },
    { id: "10", title: "Clean room", assignee: "Child2", completed: false },
  ],
  saturday: [
    { id: "11", title: "Family bike ride", assignee: "All", completed: false },
    { id: "12", title: "Yard work", assignee: "Kurt", completed: false },
  ],
  sunday: [
    { id: "13", title: "Meal prep for week", assignee: "Wife", completed: false },
    { id: "14", title: "Family game time", assignee: "All", completed: false },
  ],
  anytime: [
    { id: "15", title: "Fix leaky faucet", assignee: "Kurt", completed: false },
    { id: "16", title: "Organize closet", assignee: "Wife", completed: false },
    { id: "17", title: "Read 30 minutes", assignee: "Child1", completed: false },
  ],
  deck: [
    { id: "18", title: "Paint the fence", assignee: "Kurt", completed: false },
    { id: "19", title: "Plan summer vacation", assignee: "Wife", completed: false },
    { id: "20", title: "Learn new recipe", assignee: "Wife", completed: false },
  ],
  completed: [
    { id: "21", title: "Dentist appointment", assignee: "Child2", completed: true },
    { id: "22", title: "Car oil change", assignee: "Kurt", completed: true },
    { id: "23", title: "School permission slip", assignee: "Wife", completed: true },
  ],
}

export default function FamilyTaskPlanner() {
  const [selectedUser, setSelectedUser] = useState("All Tasks")
  const [activeTab, setActiveTab] = useState("home")
  const [tasks, setTasks] = useState(mockTasks)
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

  const users = ["All Tasks", "Kurt", "Wife", "Child1", "Child2"]
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

  const filterTasks = (sectionTasks: Task[]) => {
    if (selectedUser === "All Tasks") return sectionTasks
    return sectionTasks.filter((task) => task.assignee === selectedUser || task.assignee === "All")
  }

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  const toggleTaskComplete = (taskId: string, sectionKey: string) => {
    setTasks((prev) => ({
      ...prev,
      [sectionKey]: prev[sectionKey].map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    }))
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
            // Add task functionality would go here
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

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 pb-24">
            {sections.map((section) => {
              const filteredTasks = filterTasks(tasks[section.key])
              if (filteredTasks.length === 0 && selectedUser !== "All Tasks" && section.key !== "completed") return null

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
            })}
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
    </div>
  )
}
