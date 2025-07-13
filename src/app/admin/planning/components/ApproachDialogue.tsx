'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  MessageSquare,
  Target,
  ListChecks,
  Users,
  Loader2
} from 'lucide-react'
import { usePlanningStore } from '@/stores/planningStore'
import type { OrganizingAgentDialogueOutput } from '@/lib/planning/agents/types'

interface ApproachDialogueProps {
  dialoguePhase: OrganizingAgentDialogueOutput
  onApprove: (adjustments?: string) => void
  onReject: () => void
  isProcessing?: boolean
}

export function ApproachDialogue({ 
  dialoguePhase,
  onApprove, 
  onReject,
  isProcessing = false 
}: ApproachDialogueProps) {
  const [adjustments, setAdjustments] = useState('')
  const [showAdjustmentInput, setShowAdjustmentInput] = useState(false)

  if (!dialoguePhase?.proposedApproach) {
    return null
  }

  const { proposedApproach, identifiedTasks, needsClarification } = dialoguePhase

  const handleApprove = () => {
    if (showAdjustmentInput && adjustments.trim()) {
      onApprove(adjustments.trim())
    } else {
      onApprove()
    }
  }

  const handleRequestAdjustments = () => {
    setShowAdjustmentInput(true)
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-purple-600" />
              AI Planning Assistant's Approach
            </CardTitle>
            <CardDescription>
              Review the proposed planning approach for this week
            </CardDescription>
          </div>
          {needsClarification && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
              <AlertCircle className="h-3 w-3 mr-1" />
              Needs Clarification
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Approach Summary */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900 mb-2">Approach Summary</h3>
          <p className="text-purple-800">{proposedApproach.summary}</p>
        </div>

        {/* Priorities */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-600" />
            Identified Priorities
          </h3>
          <div className="space-y-2">
            {proposedApproach.priorities.map((priority, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">{index + 1}.</span>
                <span className="text-gray-700">{priority}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-purple-600" />
            Planning Strategy
          </h3>
          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
            {proposedApproach.strategy}
          </p>
        </div>

        {/* Questions for Admin */}
        {proposedApproach.questionsForAdmin && proposedApproach.questionsForAdmin.length > 0 && (
          <Alert className="border-yellow-300 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <div className="font-semibold text-yellow-800 mb-2">
                Clarifying Questions:
              </div>
              <ul className="space-y-1">
                {proposedApproach.questionsForAdmin.map((question, index) => (
                  <li key={index} className="text-yellow-700">
                    • {question}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Identified Tasks Overview */}
        {identifiedTasks && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                Workload Preview
              </h3>
              
              {/* New tasks to create */}
              {identifiedTasks.newItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">
                    New tasks to create: {identifiedTasks.newItems.length}
                  </h4>
                  <div className="space-y-1">
                    {identifiedTasks.newItems.slice(0, 3).map((item, index) => (
                      <div key={index} className="text-sm text-gray-600 pl-4">
                        • {item.description}
                      </div>
                    ))}
                    {identifiedTasks.newItems.length > 3 && (
                      <div className="text-sm text-gray-500 pl-4">
                        ... and {identifiedTasks.newItems.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Estimated workload */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(identifiedTasks.estimatedWorkload).map(([userId, data]) => (
                  <div key={userId} className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-medium text-gray-900">{data.name}</div>
                    <div className="text-sm text-gray-600">
                      ~{data.estimatedHours} hours • {data.taskCount} tasks
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Adjustment Input */}
        {showAdjustmentInput && (
          <div className="space-y-2 bg-blue-50 p-4 rounded-lg">
            <Label htmlFor="adjustments" className="text-blue-900">
              Provide your adjustments or additional guidance:
            </Label>
            <Textarea
              id="adjustments"
              value={adjustments}
              onChange={(e) => setAdjustments(e.target.value)}
              placeholder="e.g., 'Focus more on homework tasks, reduce chores for the kids this week...'"
              className="min-h-[100px] bg-white"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
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
                {showAdjustmentInput && adjustments ? 'Submit Adjustments' : 'Approve Approach'}
              </>
            )}
          </Button>
          
          {!showAdjustmentInput && (
            <Button
              onClick={handleRequestAdjustments}
              variant="outline"
              disabled={isProcessing}
              className="flex-1"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Request Adjustments
            </Button>
          )}
          
          <Button
            onClick={onReject}
            variant="outline"
            disabled={isProcessing}
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}