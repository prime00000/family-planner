'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { TaskAssignment } from '../types'

interface TaskRowProps {
  task: TaskAssignment
  isSelected: boolean
  onSelectionChange: (isSelected: boolean) => void
}

export function TaskRow({ task, isSelected, onSelectionChange }: TaskRowProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-2 hover:bg-gray-50 rounded">
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelectionChange(checked as boolean)}
        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
      />
      
      <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
        <span className="text-sm text-gray-900 truncate max-w-[200px] sm:max-w-[300px]">
          {task.description}
        </span>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.importance > 0 && (
            <span className="text-sm text-gray-600">
              ⭐{task.importance}
            </span>
          )}
          {task.urgency > 0 && (
            <span className="text-sm text-gray-600">
              🔥{task.urgency}
            </span>
          )}
          {task.scheduledTime && (
            <span className="text-sm text-gray-500">
              {task.scheduledTime.start}
              {task.scheduledTime.end && `-${task.scheduledTime.end}`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}