'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Timer,
  Pause,
  Play,
  Sparkles,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react'
import { usePlanningStore } from '@/stores/planningStore'
import type { 
  SelectionReviewData,
  ReviewCheckpointState,
  SelectionManualAdjustments
} from '@/lib/planning/agents/review-types'
import { AI_COMMAND_EXAMPLES } from '@/lib/planning/review-config'
import { cn } from '@/lib/utils'

interface SelectionReviewProps {
  reviewData: SelectionReviewData
  onApprove: (adjustments?: SelectionManualAdjustments) => void
  onSkip: (reason: string) => void
  isProcessing?: boolean
  autoContinueEnabled?: boolean
  autoContinueDelay?: number
}

export function SelectionReview({ 
  reviewData,
  onApprove,
  onSkip,
  isProcessing = false,
  autoContinueEnabled = false,
  autoContinueDelay = 30
}: SelectionReviewProps) {
  const { 
    processReviewAction, 
    updateReviewUIState,
    updateSkipPreferences,
    skipPreferences 
  } = usePlanningStore()
  
  // Local state for selections
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set(reviewData.selectedTasks.map(t => t.task.id))
  )
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, 'high' | 'medium' | 'low'>>({})
  
  // AI command state
  const [aiCommand, setAiCommand] = useState('')
  const [showAiInterface, setShowAiInterface] = useState(false)
  const [isProcessingAi, setIsProcessingAi] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  
  // Auto-continue state
  const [countdown, setCountdown] = useState(autoContinueEnabled ? autoContinueDelay : 0)
  const [isPaused, setIsPaused] = useState(false)
  
  // Skip preference state
  const [skipFutureReviews, setSkipFutureReviews] = useState(skipPreferences.skipSelectionReview)
  
  // Group view state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['high']))
  
  // Calculate metrics
  const allTasks = [...reviewData.selectedTasks, ...reviewData.deselectedTasks.map(d => ({
    ...d,
    priority: 'low' as const,
    estimatedHours: (d.task.estimatedMinutes || 60) / 60,
    selectionReason: d.deselectionReason
  }))]
  
  const selectedCount = selectedTaskIds.size
  const totalAvailable = allTasks.length
  const selectedHours = allTasks
    .filter(t => selectedTaskIds.has(t.task.id))
    .reduce((sum, t) => sum + t.estimatedHours, 0)
  
  const capacityUtilization = Math.round(
    (selectedHours / (reviewData.metrics.totalEstimatedHours / reviewData.metrics.capacityUtilization * 100)) * 100
  )
  
  // Group tasks by priority
  const tasksByPriority = allTasks.reduce((groups, task) => {
    const priority = priorityOverrides[task.task.id] || task.priority
    if (!groups[priority]) groups[priority] = []
    groups[priority].push(task)
    return groups
  }, {} as Record<string, typeof allTasks>)
  
  // Auto-continue countdown
  useEffect(() => {
    if (countdown > 0 && !isPaused && !isProcessing) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && autoContinueEnabled && !isPaused) {
      handleApprove()
    }
  }, [countdown, isPaused, isProcessing, autoContinueEnabled])
  
  const handleTaskToggle = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTaskIds)
    if (checked) {
      newSelected.add(taskId)
      processReviewAction({ type: 'SELECT_TASK', taskId })
    } else {
      newSelected.delete(taskId)
      processReviewAction({ type: 'DESELECT_TASK', taskId })
    }
    setSelectedTaskIds(newSelected)
    
    // Pause auto-continue on manual adjustment
    if (autoContinueEnabled) {
      setIsPaused(true)
      processReviewAction({ type: 'PAUSE_AUTO_CONTINUE' })
    }
  }
  
  const handlePriorityChange = (taskId: string, priority: 'high' | 'medium' | 'low') => {
    setPriorityOverrides({ ...priorityOverrides, [taskId]: priority })
    processReviewAction({ type: 'CHANGE_PRIORITY', taskId, priority })
    
    // Pause auto-continue on manual adjustment
    if (autoContinueEnabled) {
      setIsPaused(true)
      processReviewAction({ type: 'PAUSE_AUTO_CONTINUE' })
    }
  }
  
  const handleAiCommand = async () => {
    if (!aiCommand.trim() || isProcessingAi) return
    
    setIsProcessingAi(true)
    processReviewAction({ type: 'APPLY_AI_COMMAND', command: aiCommand })
    
    // Simulate AI processing (in production, this would call an API)
    // For now, just demonstrate the UI behavior
    setTimeout(() => {
      setIsProcessingAi(false)
      setAiCommand('')
      setShowExamples(false)
      
      // Example: if command includes "add all homework"
      if (aiCommand.toLowerCase().includes('homework')) {
        const homeworkTasks = allTasks.filter(t => 
          t.task.description.toLowerCase().includes('homework') ||
          t.task.tags?.includes('school')
        )
        const newSelected = new Set(selectedTaskIds)
        homeworkTasks.forEach(t => newSelected.add(t.task.id))
        setSelectedTaskIds(newSelected)
      }
    }, 2000)
  }
  
  const handleApprove = () => {
    const removedTaskIds = reviewData.selectedTasks
      .filter(t => !selectedTaskIds.has(t.task.id))
      .map(t => t.task.id)
    
    const addedTaskIds = Array.from(selectedTaskIds).filter(
      id => !reviewData.selectedTasks.find(t => t.task.id === id)
    )
    
    const adjustments: SelectionManualAdjustments = {
      addedTaskIds,
      removedTaskIds,
      priorityOverrides,
      notes: aiCommand || undefined
    }
    
    // Update skip preferences if changed
    if (skipFutureReviews !== skipPreferences.skipSelectionReview) {
      updateSkipPreferences({ skipSelectionReview: skipFutureReviews })
    }
    
    onApprove(adjustments)
  }
  
  const handleSkip = () => {
    onSkip('User chose to skip selection review')
  }
  
  const toggleGroup = (priority: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(priority)) {
      newExpanded.delete(priority)
    } else {
      newExpanded.add(priority)
    }
    setExpandedGroups(newExpanded)
  }
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }
  
  const getCapacityColor = (utilization: number) => {
    if (utilization < 60) return 'text-green-600'
    if (utilization < 80) return 'text-yellow-600'
    if (utilization < 95) return 'text-orange-600'
    return 'text-red-600'
  }
  
  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Review Task Selection</CardTitle>
            <CardDescription>
              The AI has selected {reviewData.metrics.totalTasksSelected} tasks for this week
            </CardDescription>
          </div>
          
          {/* Auto-continue timer */}
          {autoContinueEnabled && countdown > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{countdown}s</div>
                <div className="text-xs text-gray-500">Auto-continue</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsPaused(!isPaused)
                  processReviewAction({ 
                    type: isPaused ? 'RESUME_AUTO_CONTINUE' : 'PAUSE_AUTO_CONTINUE' 
                  })
                }}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Warnings */}
        {reviewData.warnings && reviewData.warnings.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              {reviewData.warnings.map((warning, i) => (
                <div key={i}>{warning}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Capacity Summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Capacity Utilization</span>
            <span className={cn("text-lg font-bold", getCapacityColor(capacityUtilization))}>
              {capacityUtilization}%
            </span>
          </div>
          <Progress 
            value={capacityUtilization} 
            className="h-3"
            indicatorClassName={cn(
              capacityUtilization < 60 ? 'bg-green-600' :
              capacityUtilization < 80 ? 'bg-yellow-600' :
              capacityUtilization < 95 ? 'bg-orange-600' :
              'bg-red-600'
            )}
          />
          <div className="flex justify-between text-sm text-gray-600">
            <span>{selectedCount} of {totalAvailable} tasks selected</span>
            <span>{selectedHours.toFixed(1)} hours estimated</span>
          </div>
        </div>
        
        {/* Task Lists by Priority */}
        <div className="space-y-4">
          {(['high', 'medium', 'low'] as const).map(priority => {
            const tasks = tasksByPriority[priority] || []
            if (tasks.length === 0) return null
            
            const isExpanded = expandedGroups.has(priority)
            const selectedInGroup = tasks.filter(t => selectedTaskIds.has(t.task.id)).length
            
            return (
              <div key={priority} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleGroup(priority)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={getPriorityColor(priority)}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {selectedInGroup} of {tasks.length} selected
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="border-t bg-gray-50/50 p-4 space-y-2">
                    {tasks.map(task => {
                      const isSelected = selectedTaskIds.has(task.task.id)
                      const currentPriority = priorityOverrides[task.task.id] || task.priority
                      
                      return (
                        <div
                          key={task.task.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg transition-colors",
                            isSelected ? "bg-white border" : "bg-gray-100"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => 
                              handleTaskToggle(task.task.id, checked as boolean)
                            }
                            className="mt-1"
                          />
                          
                          <div className="flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <Label 
                                htmlFor={task.task.id}
                                className={cn(
                                  "text-sm cursor-pointer",
                                  !isSelected && "text-gray-500"
                                )}
                              >
                                {task.task.description}
                              </Label>
                              
                              <div className="flex items-center gap-2">
                                {task.task.importance && task.task.urgency && (
                                  <div className="flex gap-1">
                                    <Badge variant="outline" className="text-xs">
                                      I:{task.task.importance}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      U:{task.task.urgency}
                                    </Badge>
                                  </div>
                                )}
                                
                                {isSelected && currentPriority !== priority && (
                                  <select
                                    value={currentPriority}
                                    onChange={(e) => handlePriorityChange(
                                      task.task.id, 
                                      e.target.value as 'high' | 'medium' | 'low'
                                    )}
                                    className="text-xs border rounded px-2 py-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                  </select>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{task.estimatedHours.toFixed(1)}h</span>
                              {task.task.tags && task.task.tags.length > 0 && (
                                <div className="flex gap-1">
                                  {task.task.tags.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {isSelected && task.selectionReason && (
                              <p className="text-xs text-gray-600 italic">
                                {task.selectionReason}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* AI Command Interface */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-medium">AI Adjustments</Label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAiInterface(!showAiInterface)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {showAiInterface ? 'Hide' : 'Show'} AI Commands
            </Button>
          </div>
          
          {showAiInterface && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  value={aiCommand}
                  onChange={(e) => setAiCommand(e.target.value)}
                  placeholder="Enter a natural language command..."
                  className="flex-1"
                  rows={2}
                />
                <Button
                  onClick={handleAiCommand}
                  disabled={!aiCommand.trim() || isProcessingAi}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isProcessingAi ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {/* Examples */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-xs text-purple-600 hover:text-purple-700"
                >
                  {showExamples ? 'Hide' : 'Show'} examples
                </button>
                
                {showExamples && (
                  <div className="grid grid-cols-2 gap-2">
                    {AI_COMMAND_EXAMPLES.selection.map((example, i) => (
                      <button
                        key={i}
                        onClick={() => setAiCommand(example)}
                        className="text-left text-xs p-2 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        "{example}"
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Skip Future Reviews */}
        <div className="border-t pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={skipFutureReviews}
              onCheckedChange={(checked) => setSkipFutureReviews(checked as boolean)}
              className="mt-1"
            />
            <div className="space-y-1">
              <div className="text-sm font-medium">Skip this review in the future</div>
              <div className="text-xs text-gray-500">
                Auto-skip when: fewer than 20 tasks, above 70% capacity, and no warnings
              </div>
            </div>
          </label>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve Selection
              </>
            )}
          </Button>
          
          <Button
            onClick={() => setCountdown(0)}
            variant="outline"
            disabled={isProcessing || !autoContinueEnabled || countdown === 0}
          >
            Review Now
          </Button>
          
          <Button
            onClick={handleSkip}
            variant="outline"
            disabled={isProcessing}
            className="text-gray-600"
          >
            Skip Review
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}