'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { UserSection } from './UserSection'
import { CommandBar } from './CommandBar'
import type { VibePlanFile, ConversationExchange } from '../types'

interface PlanDisplayProps {
  plan: VibePlanFile
  selectedTaskIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  onRefinement: (feedback: string) => void
  onApprove: () => void
  onStartOver: () => void
  isProcessing: boolean
  conversation: ConversationExchange[]
}

export function PlanDisplay({
  plan,
  selectedTaskIds,
  onSelectionChange,
  onRefinement,
  onApprove,
  onStartOver,
  isProcessing,
  conversation
}: PlanDisplayProps) {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  
  const toggleUser = (userId: string) => {
    const newExpanded = new Set(expandedUsers)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedUsers(newExpanded)
  }
  
  const handleTaskSelection = (taskId: string, isSelected: boolean) => {
    const newSelection = new Set(selectedTaskIds)
    if (isSelected) {
      newSelection.add(taskId)
    } else {
      newSelection.delete(taskId)
    }
    onSelectionChange(newSelection)
  }
  
  // Get week date range
  const weekStart = new Date(plan.metadata.generatedAt)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  
  const formatDateRange = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const start = weekStart.toLocaleDateString('en-US', options)
    const end = weekEnd.toLocaleDateString('en-US', { ...options, year: 'numeric' })
    return `${start}-${end.replace(/, /, ' ')}`
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-2 sm:px-4 py-4 sm:py-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="px-3 py-4 sm:px-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  📅 Weekly Plan ({formatDateRange()})
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {plan.statistics.total_tasks} tasks assigned
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onStartOver}
                className="text-gray-600"
              >
                Start Over
              </Button>
            </div>
          </div>
          
          {/* User Sections */}
          <div className="divide-y divide-gray-200">
            {Object.entries(plan.assignments).map(([userId, userPlan]) => {
              const taskCount = plan.statistics.tasks_per_person[userId] || 0
              const isExpanded = expandedUsers.has(userId)
              
              // Count high priority and urgent tasks
              let highPriorityCount = 0
              let urgentCount = 0
              
              Object.values(userPlan).forEach((tasks) => {
                if (!Array.isArray(tasks)) return
                tasks.forEach((task) => {
                  if (task.importance >= 4) highPriorityCount++
                  if (task.urgency >= 4) urgentCount++
                })
              })
              
              return (
                <div key={userId} className="hover:bg-gray-50">
                  <button
                    onClick={() => toggleUser(userId)}
                    className="w-full px-3 py-4 sm:px-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900">
                        {userPlan.user_name}
                      </span>
                    </div>
                    
                    {!isExpanded && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500">
                          📊 {taskCount} tasks
                        </span>
                        {highPriorityCount > 0 && (
                          <span className="text-gray-600">
                            ⭐{highPriorityCount} high
                          </span>
                        )}
                        {urgentCount > 0 && (
                          <span className="text-gray-600">
                            🔥{urgentCount}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  
                  {isExpanded && (
                    <UserSection
                      userId={userId}
                      userPlan={userPlan}
                      selectedTaskIds={selectedTaskIds}
                      onTaskSelection={handleTaskSelection}
                    />
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Command Bar and Actions */}
          <div className="p-3 sm:p-4 border-t border-gray-200">
            <CommandBar
              selectedCount={selectedTaskIds.size}
              onSubmit={onRefinement}
              isProcessing={isProcessing}
            />
            
            <div className="mt-4 flex gap-3 justify-end">
              <Button
                onClick={onApprove}
                className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Approve Plan
              </Button>
            </div>
          </div>
          
          {/* Conversation History */}
          {conversation.length > 0 && (
            <div className="px-3 py-4 sm:px-4 border-t border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Refinement History
              </h3>
              <div className="space-y-3">
                {conversation.map((exchange, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="text-gray-600 mb-1">
                      You: {exchange.userMessage}
                    </div>
                    <div className="text-gray-800 bg-white p-2 rounded">
                      AI: {exchange.aiResponse}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}