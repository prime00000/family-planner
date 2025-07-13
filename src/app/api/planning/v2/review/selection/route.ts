import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AgentOrchestrator } from '@/lib/planning/agents/agent-orchestrator'
import { OrganizingAgent } from '@/lib/planning/agents/organizing-agent'
import { 
  transformSelectionForReview, 
  applySelectionAdjustments 
} from '@/lib/planning/review-utils'
import type { 
  SelectionReviewData,
  SelectionManualAdjustments,
  SelectionAIAdjustments
} from '@/lib/planning/agents/review-types'
import type { Database } from '@/types/supabase'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper auth when frontend passes user context
    // For now, proceeding without auth to match other endpoints

    const body = await request.json()
    const { 
      sessionId, 
      reviewData, 
      adjustments,
      aiCommand 
    } = body as {
      sessionId: string
      reviewData: SelectionReviewData
      adjustments?: SelectionManualAdjustments
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
    
    // Apply manual adjustments first
    let updatedReviewData = reviewData
    if (adjustments) {
      console.log('[Selection Review] Applying manual adjustments:', {
        added: adjustments.addedTaskIds.length,
        removed: adjustments.removedTaskIds.length,
        priorityChanges: Object.keys(adjustments.priorityOverrides).length
      })
      
      updatedReviewData = applySelectionAdjustments(reviewData, adjustments)
    }

    // Process AI command if provided
    if (aiCommand) {
      console.log('[Selection Review] Processing AI command:', aiCommand)
      
      try {
        // Get context from orchestrator
        const session = await orchestrator.getSession(sessionId)
        if (!session) {
          throw new Error('Session not found')
        }

        // Use Organizing Agent to interpret the command
        const organizingAgent = new OrganizingAgent()
        const aiInterpretation = await organizingAgent.interpretSelectionAdjustment(
          aiCommand,
          updatedReviewData,
          session.context
        )

        console.log('[Selection Review] AI interpretation:', aiInterpretation)

        // Create AI adjustments from interpretation
        const aiAdjustments: SelectionManualAdjustments = {
          addedTaskIds: aiInterpretation.changes.addedTaskIds || [],
          removedTaskIds: aiInterpretation.changes.removedTaskIds || [],
          priorityOverrides: aiInterpretation.changes.priorityChanges || {},
          notes: aiInterpretation.explanation
        }

        // Apply AI adjustments
        updatedReviewData = applySelectionAdjustments(updatedReviewData, aiAdjustments)

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
        console.error('[Selection Review] AI command processing error:', error)
        return NextResponse.json(
          { 
            error: 'Failed to process AI command',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

    // Update orchestrator state with the reviewed selection
    const selectedTaskIds = updatedReviewData.selectedTasks.map(st => st.task.id)
    const selectedTasks = updatedReviewData.selectedTasks.map(st => ({
      taskId: st.task.id,
      priority: st.priority,
      estimatedHours: st.estimatedHours,
      reason: st.selectionReason
    }))

    // Store the reviewed selection in the orchestrator
    await orchestrator.updateSessionState(sessionId, {
      reviewedSelection: {
        selectedTaskIds,
        selectedTasks,
        metrics: updatedReviewData.metrics,
        adjustments: adjustments || undefined,
        aiCommand: aiCommand || undefined
      }
    })

    console.log('[Selection Review] Review completed:', {
      originalTasks: reviewData.selectedTasks.length,
      finalTasks: updatedReviewData.selectedTasks.length,
      capacityUtilization: updatedReviewData.metrics.capacityUtilization
    })

    return NextResponse.json({
      success: true,
      reviewData: updatedReviewData,
      metrics: {
        tasksAdded: adjustments?.addedTaskIds.length || 0,
        tasksRemoved: adjustments?.removedTaskIds.length || 0,
        priorityChanges: Object.keys(adjustments?.priorityOverrides || {}).length,
        finalTaskCount: updatedReviewData.selectedTasks.length,
        finalCapacityUtilization: updatedReviewData.metrics.capacityUtilization
      }
    })

  } catch (error) {
    console.error('[Selection Review] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process selection review',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}