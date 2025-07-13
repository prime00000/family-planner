'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle2, 
  AlertCircle, 
  Timer,
  Pause,
  Play,
  Sparkles,
  Calendar,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  GripVertical,
  AlertTriangle,
  BarChart3
} from 'lucide-react'
import { usePlanningStore } from '@/stores/planningStore'
import type { 
  AssignmentReviewData,
  ReviewCheckpointState,
  AssignmentManualAdjustments,
  TaskAssignment
} from '@/lib/planning/agents/review-types'
import { AI_COMMAND_EXAMPLES } from '@/lib/planning/review-config'
import { cn } from '@/lib/utils'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

interface AssignmentReviewProps {
  reviewData: AssignmentReviewData
  onApprove: (adjustments?: AssignmentManualAdjustments) => void
  onSkip: (reason: string) => void
  isProcessing?: boolean
  autoContinueEnabled?: boolean
  autoContinueDelay?: number
}

interface DragEndResult {
  draggableId: string
  source: {
    droppableId: string
    index: number
  }
  destination?: {
    droppableId: string
    index: number
  }
}

export function AssignmentReview({ 
  reviewData,
  onApprove,
  onSkip,
  isProcessing = false,
  autoContinueEnabled = false,
  autoContinueDelay = 30
}: AssignmentReviewProps) {
  const { 
    processReviewAction, 
    updateReviewUIState,
    updateSkipPreferences,
    skipPreferences 
  } = usePlanningStore()
  
  // Local state for tracking changes
  const [reassignments, setReassignments] = useState<AssignmentManualAdjustments['reassignments']>([])
  const [timeAdjustments, setTimeAdjustments] = useState<AssignmentManualAdjustments['timeAdjustments']>({})
  const [movedToDeck, setMovedToDeck] = useState<string[]>([])
  
  // AI command state
  const [aiCommand, setAiCommand] = useState('')
  const [showAiInterface, setShowAiInterface] = useState(false)
  const [isProcessingAi, setIsProcessingAi] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  
  // Auto-continue state
  const [countdown, setCountdown] = useState(autoContinueEnabled ? autoContinueDelay : 0)
  const [isPaused, setIsPaused] = useState(false)
  
  // Skip preference state
  const [skipFutureReviews, setSkipFutureReviews] = useState(skipPreferences.skipAssignmentReview)
  
  // View state
  const [activeView, setActiveView] = useState<'people' | 'calendar'>('people')
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set())
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(['monday', 'tuesday']))
  
  // Calculate metrics for display
  const workloadVariance = calculateWorkloadVariance()
  const hasOverload = Object.values(reviewData.assignmentsByPerson).some(
    p => p.workloadRating === 'overloaded'
  )
  
  // Auto-continue countdown
  useEffect(() => {
    if (countdown > 0 && !isPaused && !isProcessing) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && autoContinueEnabled && !isPaused) {
      handleApprove()
    }
  }, [countdown, isPaused, isProcessing, autoContinueEnabled])
  
  function calculateWorkloadVariance(): number {
    const workloads = Object.values(reviewData.assignmentsByPerson).map(p => p.totalTasks)
    const avg = workloads.reduce((a, b) => a + b, 0) / workloads.length
    const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / workloads.length
    const stdDev = Math.sqrt(variance)
    return (stdDev / avg) * 100 // coefficient of variation as percentage
  }
  
  function handleDragEnd(result: DragEndResult) {
    if (!result.destination) return
    
    const [sourceType, sourcePerson, sourceDay] = result.source.droppableId.split('-')
    const [destType, destPerson, destDay] = result.destination.droppableId.split('-')
    
    if (sourceType === 'person' && destType === 'person') {
      // Moving between people (same day implied)
      if (sourcePerson !== destPerson) {
        const taskId = result.draggableId
        const task = findTaskById(taskId)
        if (task) {
          addReassignment({
            taskId,
            fromPerson: sourcePerson,
            toPerson: destPerson,
            fromDay: task.scheduledFor,
            toDay: task.scheduledFor,
            reason: 'Manual drag-drop reassignment'
          })
        }
      }
    } else if (sourceType === 'day' && destType === 'day') {
      // Moving between days (need to track person too)
      if (sourceDay !== destDay) {
        const taskId = result.draggableId
        const task = findTaskById(taskId)
        if (task) {
          addReassignment({
            taskId,
            fromPerson: task.assignedTo,
            toPerson: task.assignedTo,
            fromDay: sourceDay,
            toDay: destDay,
            reason: 'Manual day reassignment'
          })
        }
      }
    }
    
    // Pause auto-continue on manual adjustment
    if (autoContinueEnabled) {
      setIsPaused(true)
      processReviewAction({ type: 'PAUSE_AUTO_CONTINUE' })
    }
  }
  
  function findTaskById(taskId: string): TaskAssignment | undefined {
    for (const person of Object.values(reviewData.assignmentsByPerson)) {
      const task = person.assignments.find(a => a.taskId === taskId)
      if (task) return task
    }
    return undefined
  }
  
  function addReassignment(reassignment: AssignmentManualAdjustments['reassignments'][0]) {
    setReassignments([...reassignments, reassignment])
    processReviewAction({ 
      type: 'REASSIGN_TASK', 
      taskId: reassignment.taskId,
      toPerson: reassignment.toPerson,
      toDay: reassignment.toDay
    })
  }
  
  function handleMoveToDeck(taskId: string) {
    setMovedToDeck([...movedToDeck, taskId])
    processReviewAction({ type: 'MOVE_TO_DECK', taskId })
    
    // Pause auto-continue
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
    setTimeout(() => {
      setIsProcessingAi(false)
      setAiCommand('')
      setShowExamples(false)
      
      // Example: if command includes "balance jessica monday"
      if (aiCommand.toLowerCase().includes('balance') && aiCommand.toLowerCase().includes('jessica')) {
        // Simulate rebalancing logic
        console.log('AI would rebalance Jessica\'s workload')
      }
    }, 2000)
  }
  
  const handleApprove = () => {
    const adjustments: AssignmentManualAdjustments = {
      reassignments,
      timeAdjustments,
      movedToDeck,
      notes: aiCommand || undefined
    }
    
    // Update skip preferences if changed
    if (skipFutureReviews !== skipPreferences.skipAssignmentReview) {
      updateSkipPreferences({ skipAssignmentReview: skipFutureReviews })
    }
    
    onApprove(adjustments)
  }
  
  const handleSkip = () => {
    onSkip('User chose to skip assignment review')
  }
  
  const togglePerson = (personId: string) => {
    const newExpanded = new Set(expandedPeople)
    if (newExpanded.has(personId)) {
      newExpanded.delete(personId)
    } else {
      newExpanded.add(personId)
    }
    setExpandedPeople(newExpanded)
  }
  
  const toggleDay = (day: string) => {
    const newExpanded = new Set(expandedDays)
    if (newExpanded.has(day)) {
      newExpanded.delete(day)
    } else {
      newExpanded.add(day)
    }
    setExpandedDays(newExpanded)
  }
  
  const getWorkloadColor = (rating: string) => {
    switch (rating) {
      case 'light': return 'text-green-600 bg-green-50'
      case 'moderate': return 'text-yellow-600 bg-yellow-50'
      case 'heavy': return 'text-orange-600 bg-orange-50'
      case 'overloaded': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }
  
  const getDayOfWeek = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1)
  }
  
  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Review Task Assignments</CardTitle>
            <CardDescription>
              Review how tasks have been distributed across the team
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
        
        {/* Workload Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Workload Balance</span>
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </div>
            <div className={cn(
              "text-2xl font-bold",
              workloadVariance < 20 ? "text-green-600" : "text-orange-600"
            )}>
              {workloadVariance.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">variance</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Busiest Day</span>
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {getDayOfWeek(reviewData.metrics.busiestDay)}
            </div>
            <div className="text-xs text-gray-500">
              {reviewData.assignmentsByDay[reviewData.metrics.busiestDay]?.totalTasks || 0} tasks
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Team Status</span>
              <User className="h-4 w-4 text-gray-400" />
            </div>
            <div className={cn(
              "text-2xl font-bold",
              hasOverload ? "text-red-600" : "text-green-600"
            )}>
              {hasOverload ? 'Overloaded' : 'Balanced'}
            </div>
            <div className="text-xs text-gray-500">
              {reviewData.metrics.averageTasksPerPerson.toFixed(1)} tasks/person
            </div>
          </div>
        </div>
        
        {/* View Tabs */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="people">By Person</TabsTrigger>
            <TabsTrigger value="calendar">By Day</TabsTrigger>
          </TabsList>
          
          <TabsContent value="people" className="space-y-4 mt-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              {Object.entries(reviewData.assignmentsByPerson).map(([personId, personData]) => {
                const isExpanded = expandedPeople.has(personId)
                const hasChanges = reassignments.some(r => r.fromPerson === personId || r.toPerson === personId)
                
                return (
                  <div key={personId} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => togglePerson(personId)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <div className="font-medium">{personData.member.name}</div>
                          <div className="text-sm text-gray-500">
                            {personData.totalTasks} tasks • {personData.totalEstimatedHours.toFixed(1)}h
                          </div>
                        </div>
                        <Badge className={getWorkloadColor(personData.workloadRating)}>
                          {personData.workloadRating}
                        </Badge>
                        {hasChanges && (
                          <Badge variant="outline" className="text-purple-600">
                            Modified
                          </Badge>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <Droppable droppableId={`person-${personId}-tasks`}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="border-t bg-gray-50/50 p-4 space-y-2"
                          >
                            {personData.assignments.map((assignment, index) => {
                              const isMovedToDeck = movedToDeck.includes(assignment.taskId)
                              const reassignment = reassignments.find(r => r.taskId === assignment.taskId)
                              
                              return (
                                <Draggable
                                  key={assignment.taskId}
                                  draggableId={assignment.taskId}
                                  index={index}
                                  isDragDisabled={isMovedToDeck}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={cn(
                                        "flex items-start gap-3 p-3 rounded-lg bg-white border transition-all",
                                        snapshot.isDragging && "shadow-lg opacity-90",
                                        isMovedToDeck && "opacity-50",
                                        reassignment && "border-purple-300"
                                      )}
                                    >
                                      <div
                                        {...provided.dragHandleProps}
                                        className="mt-1 cursor-move"
                                      >
                                        <GripVertical className="h-4 w-4 text-gray-400" />
                                      </div>
                                      
                                      <div className="flex-1 space-y-1">
                                        <div className="text-sm font-medium">
                                          {assignment.task.description}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {getDayOfWeek(assignment.scheduledFor)}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {(assignment.estimatedDuration || 60) / 60}h
                                          </span>
                                          {assignment.task.tags && (
                                            <div className="flex gap-1">
                                              {assignment.task.tags.map(tag => (
                                                <Badge key={tag} variant="outline" className="text-xs">
                                                  {tag}
                                                </Badge>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        {reassignment && (
                                          <div className="text-xs text-purple-600">
                                            → {reviewData.assignmentsByPerson[reassignment.toPerson]?.member.name} on {getDayOfWeek(reassignment.toDay)}
                                          </div>
                                        )}
                                      </div>
                                      
                                      {!isMovedToDeck && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleMoveToDeck(assignment.taskId)}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          Deck
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              )
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                )
              })}
            </DragDropContext>
          </TabsContent>
          
          <TabsContent value="calendar" className="space-y-4 mt-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => {
                const dayData = reviewData.assignmentsByDay[day]
                if (!dayData || dayData.totalTasks === 0) return null
                
                const isExpanded = expandedDays.has(day)
                
                return (
                  <div key={day} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleDay(day)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="font-medium">{getDayOfWeek(day)}</div>
                          <div className="text-sm text-gray-500">
                            {dayData.totalTasks} tasks • {dayData.totalEstimatedHours.toFixed(1)}h
                          </div>
                        </div>
                        {day === reviewData.metrics.busiestDay && (
                          <Badge className="bg-purple-100 text-purple-700">
                            Busiest
                          </Badge>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <Droppable droppableId={`day-${day}-tasks`}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="border-t bg-gray-50/50 p-4 space-y-2"
                          >
                            {dayData.assignments.map((assignment, index) => (
                              <Draggable
                                key={assignment.taskId}
                                draggableId={assignment.taskId}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn(
                                      "flex items-start gap-3 p-3 rounded-lg bg-white border",
                                      snapshot.isDragging && "shadow-lg opacity-90"
                                    )}
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className="mt-1 cursor-move"
                                    >
                                      <GripVertical className="h-4 w-4 text-gray-400" />
                                    </div>
                                    
                                    <div className="flex-1 space-y-1">
                                      <div className="text-sm font-medium">
                                        {assignment.task.description}
                                      </div>
                                      <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {assignment.assignedToName}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {(assignment.estimatedDuration || 60) / 60}h
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                )
              })}
            </DragDropContext>
          </TabsContent>
        </Tabs>
        
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
                    {AI_COMMAND_EXAMPLES.assignment.map((example, i) => (
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
                Auto-skip when: workload balanced (variance &lt; 20%), no overloaded members, and no warnings
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
                Approve Assignments
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