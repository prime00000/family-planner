import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { AgentOrchestrator } from '@/lib/planning/agents/agent-orchestrator'
import { OrganizingAgent } from '@/lib/planning/agents/organizing-agent'
import { 
  transformAssignmentForReview, 
  applyAssignmentAdjustments 
} from '@/lib/planning/review-utils'
import type { 
  AssignmentReviewData,
  AssignmentManualAdjustments,
  AssignmentAIAdjustments
} from '@/lib/planning/agents/review-types'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      sessionId, 
      reviewData, 
      adjustments,
      aiCommand 
    } = body as {
      sessionId: string
      reviewData: AssignmentReviewData
      adjustments?: AssignmentManualAdjustments
      aiCommand?: string
    }

    if (!sessionId || !reviewData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the orchestrator instance
    const orchestrator = AgentOrchestrator.getInstance()
    
    // Validate all reassignments before applying
    if (adjustments?.reassignments) {
      for (const reassignment of adjustments.reassignments) {
        // Validate person exists
        if (!reviewData.assignmentsByPerson[reassignment.toPerson]) {
          return NextResponse.json(
            { error: `Invalid person ID: ${reassignment.toPerson}` },
            { status: 400 }
          )
        }
        
        // Validate day is valid
        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 
                          'saturday', 'sunday', 'anytime_this_week', 'deck']
        if (!validDays.includes(reassignment.toDay)) {
          return NextResponse.json(
            { error: `Invalid day: ${reassignment.toDay}` },
            { status: 400 }
          )
        }
        
        // Validate task exists and is currently assigned
        let taskFound = false
        for (const person of Object.values(reviewData.assignmentsByPerson)) {
          if (person.assignments.find(a => a.taskId === reassignment.taskId)) {
            taskFound = true
            break
          }
        }
        if (!taskFound) {
          return NextResponse.json(
            { error: `Task not found: ${reassignment.taskId}` },
            { status: 400 }
          )
        }
      }
    }

    // Apply manual adjustments first
    let updatedReviewData = reviewData
    if (adjustments) {
      console.log('[Assignment Review] Applying manual adjustments:', {
        reassignments: adjustments.reassignments.length,
        timeAdjustments: Object.keys(adjustments.timeAdjustments).length,
        movedToDeck: adjustments.movedToDeck.length
      })
      
      updatedReviewData = applyAssignmentAdjustments(reviewData, adjustments)
    }

    // Process AI command if provided
    if (aiCommand) {
      console.log('[Assignment Review] Processing AI command:', aiCommand)
      
      try {
        // Get context from orchestrator
        const session = await orchestrator.getSession(sessionId)
        if (!session) {
          throw new Error('Session not found')
        }

        // Use Organizing Agent to interpret the command
        const organizingAgent = new OrganizingAgent()
        const aiInterpretation = await organizingAgent.interpretAssignmentAdjustment(
          aiCommand,
          updatedReviewData,
          session.context
        )

        console.log('[Assignment Review] AI interpretation:', aiInterpretation)

        // Create AI adjustments from interpretation
        const aiAdjustments: AssignmentManualAdjustments = {
          reassignments: aiInterpretation.changes.reassignments || [],
          timeAdjustments: {},
          movedToDeck: [],
          notes: aiInterpretation.explanation
        }

        // Apply AI adjustments
        updatedReviewData = applyAssignmentAdjustments(updatedReviewData, aiAdjustments)

        // Add AI adjustments to response
        updatedReviewData = {
          ...updatedReviewData,
          aiAdjustments: {
            command: aiCommand,
            interpretation: aiInterpretation.interpretation,
            changes: aiInterpretation.changes,
            explanation: aiInterpretation.explanation
          } as any
        }

        // Add any warnings from AI
        if (aiInterpretation.warnings && aiInterpretation.warnings.length > 0) {
          updatedReviewData.warnings = [
            ...(updatedReviewData.warnings || []),
            ...aiInterpretation.warnings
          ]
        }
      } catch (error) {
        console.error('[Assignment Review] AI command processing error:', error)
        return NextResponse.json(
          { 
            error: 'Failed to process AI command',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

    // Convert reviewed assignments back to the format expected by downstream agents
    const finalAssignments = []
    for (const [personId, personData] of Object.entries(updatedReviewData.assignmentsByPerson)) {
      for (const assignment of personData.assignments) {
        finalAssignments.push({
          taskId: assignment.taskId,
          assignTo: assignment.assignedTo,
          scheduleFor: assignment.scheduledFor,
          reasoning: assignment.assignmentReason,
          scheduledTime: assignment.scheduledTime
        })
      }
    }

    // Update orchestrator state with the reviewed assignments
    await orchestrator.updateSessionState(sessionId, {
      reviewedAssignments: {
        assignments: finalAssignments,
        metrics: updatedReviewData.metrics,
        adjustments: adjustments || undefined,
        aiCommand: aiCommand || undefined
      }
    })

    // Calculate change metrics
    const changeMetrics = {
      reassignments: adjustments?.reassignments.length || 0,
      timeAdjustments: Object.keys(adjustments?.timeAdjustments || {}).length,
      movedToDeck: adjustments?.movedToDeck.length || 0,
      finalAssignmentCount: finalAssignments.length
    }

    // Check final workload balance
    const workloads = Object.values(updatedReviewData.assignmentsByPerson).map((p: any) => p.totalTasks)
    const avgWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length
    const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length
    const stdDev = Math.sqrt(variance)
    const workloadVariance = (stdDev / avgWorkload) * 100

    console.log('[Assignment Review] Review completed:', {
      totalAssignments: finalAssignments.length,
      changesMade: changeMetrics,
      workloadVariance: workloadVariance.toFixed(1) + '%'
    })

    return NextResponse.json({
      success: true,
      reviewData: updatedReviewData,
      metrics: {
        ...changeMetrics,
        workloadVariance,
        busiestDay: updatedReviewData.metrics.busiestDay,
        averageTasksPerPerson: updatedReviewData.metrics.averageTasksPerPerson
      }
    })

  } catch (error) {
    console.error('[Assignment Review] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process assignment review',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}