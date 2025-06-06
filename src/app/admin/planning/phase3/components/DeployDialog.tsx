'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { VibePlanFile, DeploymentPreview } from '../types'

interface DeployDialogProps {
  plan: VibePlanFile
  onClose: () => void
  onDeploy: () => Promise<void>
}

export function DeployDialog({ plan, onClose, onDeploy }: DeployDialogProps) {
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
          <h3 className="text-lg font-semibold">Deploy Weekly Plan?</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
            disabled={isDeploying}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-gray-600 mb-4">
            This will update the weekly plan for all team members.
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
              {isDeploying ? 'Deploying...' : 'Deploy'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}