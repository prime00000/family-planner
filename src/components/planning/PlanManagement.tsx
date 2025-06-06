'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Edit, 
  Calendar, 
  Clock, 
  Play, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Calendar as CalendarIcon
} from 'lucide-react'
import { TEAM_ID } from '@/lib/constants'

interface Plan {
  id: string
  title: string
  status: 'draft' | 'active' | 'completed'
  created_at: string
  scheduled_activation: string | null
  week_start_date: string | null
  plan_tasks_count: number
  created_by: string
}

interface ConfirmDialog {
  isOpen: boolean
  type: 'delete' | 'activate' | null
  plan: Plan | null
  message: string
}

interface PlanManagementProps {
  onEditPlan: (planId: string) => void
  onCreateNew: () => void
}

export function PlanManagement({ onEditPlan, onCreateNew }: PlanManagementProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    isOpen: false,
    type: null,
    plan: null,
    message: ''
  })

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_plans')
        .select(`
          id,
          title,
          status,
          created_at,
          scheduled_activation,
          week_start_date,
          created_by,
          plan_tasks(count)
        `)
        .eq('team_id', TEAM_ID)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedPlans = data?.map(plan => ({
        id: plan.id,
        title: plan.title || 'Untitled Plan',
        status: plan.status as 'draft' | 'active' | 'completed',
        created_at: plan.created_at,
        scheduled_activation: plan.scheduled_activation,
        week_start_date: plan.week_start_date,
        plan_tasks_count: plan.plan_tasks?.[0]?.count || 0,
        created_by: plan.created_by
      })) || []

      setPlans(formattedPlans)
    } catch (error) {
      console.error('Error loading plans:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (plan: Plan) => {
    setConfirmDialog({
      isOpen: true,
      type: 'delete',
      plan,
      message: `Are you sure you want to delete "${plan.title}"? This action cannot be undone.`
    })
  }

  const handleActivate = async (plan: Plan) => {
    setConfirmDialog({
      isOpen: true,
      type: 'activate',
      plan,
      message: `Activate "${plan.title}"? This will deactivate any currently active plan and make this plan's tasks available to the team.`
    })
  }

  const confirmAction = async () => {
    if (!confirmDialog.plan) return

    setActionLoading(confirmDialog.plan.id)
    
    try {
      if (confirmDialog.type === 'delete') {
        const response = await fetch(`/api/planning/delete-plan?planId=${confirmDialog.plan.id}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to delete plan')
        }

        await loadPlans() // Refresh the list
      } else if (confirmDialog.type === 'activate') {
        const response = await fetch('/api/planning/activate-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ planId: confirmDialog.plan.id })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to activate plan')
        }

        await loadPlans() // Refresh the list
      }
    } catch (error) {
      console.error('Action failed:', error)
      // TODO: Show error toast
    } finally {
      setActionLoading(null)
      setConfirmDialog({ isOpen: false, type: null, plan: null, message: '' })
    }
  }

  const getStatusBadge = (status: Plan['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Draft</Badge>
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>
      case 'completed':
        return <Badge variant="outline" className="text-gray-500">Completed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: Plan['status']) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4 text-gray-500" />
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'completed':
        return <Calendar className="h-4 w-4 text-gray-400" />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Plan Management</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Plan Management</h2>
        <Button onClick={onCreateNew} className="bg-purple-600 hover:bg-purple-700">
          Create New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="max-w-sm mx-auto">
            <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No plans yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first weekly plan to get started with AI-powered planning.
            </p>
            <Button onClick={onCreateNew} className="bg-purple-600 hover:bg-purple-700">
              Create First Plan
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusIcon(plan.status)}
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {plan.title}
                    </h3>
                    {getStatusBadge(plan.status)}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Created {new Date(plan.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {plan.scheduled_activation && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Scheduled {new Date(plan.scheduled_activation).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {plan.week_start_date && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Week of {new Date(plan.week_start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.plan_tasks_count}</span>
                      <span>tasks</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {plan.status === 'draft' && (
                    <>
                      <Button
                        onClick={() => onEditPlan(plan.id)}
                        variant="outline"
                        size="sm"
                        disabled={actionLoading === plan.id}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      
                      <Button
                        onClick={() => handleActivate(plan)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={actionLoading === plan.id}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    </>
                  )}
                  
                  {plan.status !== 'active' && (
                    <Button
                      onClick={() => handleDelete(plan)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={actionLoading === plan.id}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h3 className="text-lg font-semibold">
                {confirmDialog.type === 'delete' ? 'Delete Plan' : 'Activate Plan'}
              </h3>
            </div>
            
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmDialog({ isOpen: false, type: null, plan: null, message: '' })}
                disabled={actionLoading !== null}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmAction}
                disabled={actionLoading !== null}
                className={
                  confirmDialog.type === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }
              >
                {actionLoading ? 'Processing...' : 
                  confirmDialog.type === 'delete' ? 'Delete' : 'Activate'
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}