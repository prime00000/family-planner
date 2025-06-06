'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Edit, Calendar, Clock } from 'lucide-react'
import { TEAM_ID } from '@/lib/constants'

interface DraftPlan {
  id: string
  title: string
  status: string
  created_at: string
  scheduled_activation: string | null
  plan_tasks_count: number
}

interface DraftPlansListProps {
  onEditPlan: (planId: string) => void
}

export function DraftPlansList({ onEditPlan }: DraftPlansListProps) {
  const [draftPlans, setDraftPlans] = useState<DraftPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDraftPlans()
  }, [])

  const loadDraftPlans = async () => {
    try {
      // Fetch draft plans with plan_tasks count
      const { data: plans, error } = await supabase
        .from('weekly_plans')
        .select(`
          id,
          title,
          status,
          created_at,
          scheduled_activation,
          plan_tasks(count)
        `)
        .eq('team_id', TEAM_ID)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedPlans = plans?.map(plan => ({
        id: plan.id,
        title: plan.title || 'Untitled Plan',
        status: plan.status,
        created_at: plan.created_at,
        scheduled_activation: plan.scheduled_activation,
        plan_tasks_count: plan.plan_tasks?.[0]?.count || 0
      })) || []

      setDraftPlans(formattedPlans)
    } catch (error) {
      console.error('Error loading draft plans:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Draft Plans</h2>
        <div className="animate-pulse">
          <div className="h-20 bg-gray-200 rounded-lg mb-3" />
          <div className="h-20 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  if (draftPlans.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-900">Draft Plans</h2>
      <div className="space-y-3">
        {draftPlans.map((plan) => (
          <Card key={plan.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{plan.title}</h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Created {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                  {plan.scheduled_activation && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Scheduled for {new Date(plan.scheduled_activation).toLocaleDateString()}
                    </span>
                  )}
                  <span>{plan.plan_tasks_count} tasks</span>
                </div>
              </div>
              <Button
                onClick={() => onEditPlan(plan.id)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}