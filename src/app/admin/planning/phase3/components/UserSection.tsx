'use client'

import { TaskRow } from './TaskRow'
import type { TaskAssignment } from '../types'

interface UserSectionProps {
  userId: string
  userPlan: {
    user_name: string
    monday: TaskAssignment[]
    tuesday: TaskAssignment[]
    wednesday: TaskAssignment[]
    thursday: TaskAssignment[]
    friday: TaskAssignment[]
    saturday: TaskAssignment[]
    sunday: TaskAssignment[]
    anytime_this_week: TaskAssignment[]
    deck: TaskAssignment[]
  }
  selectedTaskIds: Set<string>
  onTaskSelection: (taskId: string, isSelected: boolean) => void
}

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
  { key: 'anytime_this_week', label: 'Anytime This Week' },
] as const

export function UserSection({
  userPlan,
  selectedTaskIds,
  onTaskSelection
}: UserSectionProps) {
  return (
    <div className="px-3 pb-4 sm:px-4">
      {DAYS.map(({ key, label }) => {
        const tasks = userPlan[key]
        if (!tasks || tasks.length === 0) return null
        
        return (
          <div key={key} className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {label}
            </h4>
            <div className="space-y-1">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskIds.has(task.id)}
                  onSelectionChange={(isSelected) => 
                    onTaskSelection(task.id, isSelected)
                  }
                />
              ))}
            </div>
          </div>
        )
      })}
      
      {userPlan.deck && userPlan.deck.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Deck (Backup Tasks)
          </h4>
          <div className="space-y-1">
            {userPlan.deck.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selectedTaskIds.has(task.id)}
                onSelectionChange={(isSelected) => 
                  onTaskSelection(task.id, isSelected)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}