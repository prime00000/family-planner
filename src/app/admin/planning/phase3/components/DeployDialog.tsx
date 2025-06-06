'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { VibePlanFile, DeploymentPreview } from '../types'

interface DeployDialogProps {
  plan: VibePlanFile
  title: string
  onTitleChange: (title: string) => void
  scheduledDate: string | null
  onScheduledDateChange: (date: string | null) => void
  onClose: () => void
  onDeploy: () => Promise<void>
}

export function DeployDialog({ plan, title, onTitleChange, scheduledDate, onScheduledDateChange, onClose, onDeploy }: DeployDialogProps) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [preview, setPreview] = useState<DeploymentPreview | null>(null)
  
  useEffect(() => {
    // Calculate deployment preview
    // TODO: Fetch actual counts from database
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Next Monday
    
    setPreview({
      tasksToArchive: 0, // TODO: Count completed tasks
      tasksToBacklog: 0, // TODO: Count incomplete tasks
      tasksToCreate: plan.statistics.total_tasks,
      weekStartDate: weekStart.toISOString().split('T')[0]
    })
  }, [plan])
  
  const handleDeploy = async () => {
    setIsDeploying(true)
    try {
      await onDeploy()
    } catch (error) {
      console.error('Deployment error:', error)
      setIsDeploying(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">Save Weekly Plan</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
            disabled={isDeploying}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plan Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a title for this week's plan"
              disabled={isDeploying}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Activation Date (Optional)
            </label>
            <input
              type="date"
              value={scheduledDate || ''}
              onChange={(e) => onScheduledDateChange(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isDeploying}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">
              If set, the plan will automatically activate on this date. Leave empty to save as draft.
            </p>
          </div>
          
          <p className="text-gray-600 mb-4">
            {scheduledDate 
              ? `This plan will be scheduled to activate on ${new Date(scheduledDate).toLocaleDateString()}.`
              : 'This will save the plan as a draft that can be activated later.'
            }
          </p>
          
          {preview && (
            <div className="bg-gray-50 rounded p-3 mb-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">This will:</p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                {preview.tasksToArchive > 0 && (
                  <li>• Clear {preview.tasksToArchive} completed tasks</li>
                )}
                {preview.tasksToBacklog > 0 && (
                  <li>• Move {preview.tasksToBacklog} incomplete tasks to backlog</li>
                )}
                <li>• Assign {preview.tasksToCreate} new tasks</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Week starting: {new Date(preview.weekStartDate).toLocaleDateString()}
              </p>
            </div>
          )}
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isDeploying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isDeploying ? 'Saving...' : 'Save Plan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}