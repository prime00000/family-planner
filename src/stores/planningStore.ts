import { create } from 'zustand'
import { PLANNING_PHASES } from '@/lib/constants'

export type PlanningPhase = typeof PLANNING_PHASES[keyof typeof PLANNING_PHASES]

interface ReviewedItem {
  id: string
  type: 'objective' | 'task' | 'maintenance'
  adjustments?: {
    importance?: number
    urgency?: number
    tags?: string[]
    status?: string
  }
}

interface NewItemsData {
  reviewedItems: ReviewedItem[]
  adjustmentsMade: number
  decisionsLog: string[]
}

interface VibePlanData {
  selectedDays: string[]
  vibeNotes: string
  energyLevel: number
}

interface PlanningState {
  phase: PlanningPhase
  phaseData: {
    past_week?: {
      completedCount: number
      incompleteCount: number
    }
    new_items?: NewItemsData
    vibe_plan?: VibePlanData
  }
  setPhase: (phase: PlanningPhase) => void
  updatePhaseData: <T extends keyof PlanningState['phaseData']>(
    phase: T,
    data: Partial<NonNullable<PlanningState['phaseData'][T]>>
  ) => void
  setNewItemsData: (data: NewItemsData) => void
  addReviewedItem: (item: ReviewedItem) => void
  addDecisionLog: (log: string) => void
}

export const usePlanningStore = create<PlanningState>((set) => ({
  phase: PLANNING_PHASES.PAST_WEEK,
  phaseData: {},
  
  setPhase: (phase) => set({ phase }),
  
  updatePhaseData: (phase, data) => set((state) => ({
    phaseData: {
      ...state.phaseData,
      [phase]: {
        ...state.phaseData[phase],
        ...data
      }
    }
  })),

  setNewItemsData: (data) => set((state) => ({
    phaseData: {
      ...state.phaseData,
      new_items: data
    }
  })),

  addReviewedItem: (item) => set((state) => {
    const currentData = state.phaseData.new_items || {
      reviewedItems: [],
      adjustmentsMade: 0,
      decisionsLog: []
    }
    
    return {
      phaseData: {
        ...state.phaseData,
        new_items: {
          ...currentData,
          reviewedItems: [...currentData.reviewedItems, item]
        }
      }
    }
  }),

  addDecisionLog: (log) => set((state) => {
    const currentData = state.phaseData.new_items || {
      reviewedItems: [],
      adjustmentsMade: 0,
      decisionsLog: []
    }
    
    return {
      phaseData: {
        ...state.phaseData,
        new_items: {
          ...currentData,
          decisionsLog: [...currentData.decisionsLog, log]
        }
      }
    }
  })
})) 