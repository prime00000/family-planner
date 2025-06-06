'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface TeamData {
  team_id: string
  member_count: number
  has_target_uuid: boolean
  members: Array<{
    user_id: string
    display_name?: string
    full_name?: string
    email?: string
  }>
}

interface TasksData {
  active_tasks_count?: number
  debug_info?: {
    total_tasks: number
  }
  status_summary?: Record<string, number>
  active_plans?: unknown[]
  active_tasks?: Array<{
    id: string
    title: string
    day_of_week: number
    assignee_id: string
  }>
  success?: boolean
  cleared_plans?: number
  archived_tasks?: boolean
  current_state?: {
    task_status_summary?: Record<string, number>
    [key: string]: unknown
  }
}

interface RebuildResult {
  success?: boolean
  message?: string
  error?: string
  plan?: {
    title: string
    status: string
  }
  plan_tasks_count?: number
  ai_conversation?: {
    ai_task_count: number
    assignment_keys: string[]
  }
}

interface SetupResult {
  success: boolean
  message: string
  users_found: number
  members_added: number
}

export default function TestPage() {
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null)
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null)
  const [tasksData, setTasksData] = useState<TasksData | null>(null)
  const [planId, setPlanId] = useState('')

  const checkTeamMembers = async () => {
    try {
      const response = await fetch('/api/planning/debug-team')
      const data = await response.json()
      setTeamData(data)
    } catch (error) {
      console.error('Error checking team:', error)
    }
  }

  const rebuildTasks = async () => {
    if (!planId) {
      alert('Please enter a plan ID')
      return
    }

    try {
      const response = await fetch('/api/planning/rebuild-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      })
      const data = await response.json()
      setRebuildResult(data)
    } catch (error) {
      console.error('Error rebuilding tasks:', error)
    }
  }

  const setupTeam = async () => {
    try {
      const response = await fetch('/api/planning/setup-team', {
        method: 'POST'
      })
      const data = await response.json()
      setSetupResult(data)
      // Refresh team data after setup
      if (data.success) {
        await checkTeamMembers()
      }
    } catch (error) {
      console.error('Error setting up team:', error)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Planning Debug Tools</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Team Setup</h2>
        <div className="space-y-4">
          <div>
            <Button onClick={setupTeam} className="bg-green-600 hover:bg-green-700 text-white">
              Setup Team Members
            </Button>
            <p className="text-sm text-gray-600 mt-2">
              This will add all users in the database to the team
            </p>
          </div>
          {setupResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className={setupResult.success ? 'text-green-600' : 'text-red-600'}>
                {setupResult.message}
              </p>
              {setupResult.success && (
                <div className="mt-2 text-sm">
                  <p>Users found: {setupResult.users_found}</p>
                  <p>Members added: {setupResult.members_added}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Team Members Check</h2>
        <Button onClick={checkTeamMembers}>Check Team Members</Button>
        {teamData && (
          <div className="mt-4 space-y-2">
            <p>Team ID: {teamData.team_id}</p>
            <p>Member Count: {teamData.member_count}</p>
            <p>Has target UUID (86f09a81...): {teamData.has_target_uuid ? 'YES' : 'NO'}</p>
            <div className="mt-2">
              <h3 className="font-medium">Members:</h3>
              <ul className="text-sm space-y-1">
                {teamData.members.map((m) => (
                  <li key={m.user_id}>
                    {m.user_id} - {m.display_name || m.full_name || m.email}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Plan Tools</h2>
        <p className="text-sm text-gray-600 mb-4">
          Check plan details or rebuild plan_tasks from AI conversation
        </p>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter plan ID"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="px-3 py-2 border rounded flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={async () => {
                if (!planId) return
                const response = await fetch('/api/planning/check-plan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ planId })
                })
                const data = await response.json()
                setRebuildResult(data)
              }}
              variant="outline"
            >
              Check Plan
            </Button>
            <Button onClick={rebuildTasks}>Rebuild Tasks</Button>
          </div>
        </div>
        {rebuildResult && (
          <div className="mt-4">
            {rebuildResult.plan ? (
              <div className="space-y-2 text-sm">
                <p>Plan: {rebuildResult.plan.title} ({rebuildResult.plan.status})</p>
                <p>Plan Tasks in DB: {rebuildResult.plan_tasks_count}</p>
                <p>Tasks in AI Conversation: {rebuildResult.ai_conversation?.ai_task_count || 0}</p>
                {rebuildResult.ai_conversation && rebuildResult.ai_conversation.assignment_keys.length > 0 && (
                  <p>Assigned to: {rebuildResult.ai_conversation.assignment_keys.length} users</p>
                )}
              </div>
            ) : (
              <p className={rebuildResult.success ? 'text-green-600' : 'text-red-600'}>
                {rebuildResult.success ? rebuildResult.message : rebuildResult.error}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Tasks Debug</h2>
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              const response = await fetch('/api/planning/debug-tasks')
              const data = await response.json()
              setTasksData(data)
            }}
          >
            Check Tasks Status
          </Button>
          <Button 
            onClick={async () => {
              const response = await fetch('/api/planning/cleanup-plans', {
                method: 'POST'
              })
              const data = await response.json()
              setTasksData(data)
              // Refresh status after cleanup
              if (data.success) {
                setTimeout(async () => {
                  const statusResponse = await fetch('/api/planning/debug-tasks')
                  const statusData = await statusResponse.json()
                  setTasksData(statusData)
                }, 1000)
              }
            }}
            variant="outline"
            className="bg-orange-50 hover:bg-orange-100"
          >
            Cleanup Plans
          </Button>
        </div>
        {tasksData && (
          <div className="mt-4 space-y-2 text-sm">
            {tasksData.debug_info ? (
              <>
                <p>Active Tasks: {tasksData.active_tasks_count}</p>
                <p>Total Tasks: {tasksData.debug_info.total_tasks}</p>
              </>
            ) : tasksData.success ? (
              <>
                <p className="text-green-600">Cleanup completed!</p>
                <p>Cleared plans: {tasksData.cleared_plans}</p>
                <p>Tasks archived: {tasksData.archived_tasks ? 'Yes' : 'No'}</p>
              </>
            ) : null}
            {tasksData.status_summary && (
              <div className="mt-2">
                <h3 className="font-medium">Status Summary:</h3>
                <pre className="text-xs bg-gray-100 p-2 rounded">
                  {JSON.stringify(tasksData.status_summary || tasksData.current_state?.task_status_summary, null, 2)}
                </pre>
              </div>
            )}
            {tasksData.active_plans && (
              <div className="mt-2">
                <h3 className="font-medium">Active Plans:</h3>
                <pre className="text-xs bg-gray-100 p-2 rounded">
                  {JSON.stringify(tasksData.active_plans, null, 2)}
                </pre>
              </div>
            )}
            {tasksData.active_tasks && tasksData.active_tasks.length > 0 && (
              <div className="mt-2">
                <h3 className="font-medium">Sample Active Tasks:</h3>
                <ul className="text-xs space-y-1">
                  {tasksData.active_tasks.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      {t.title} (Day: {t.day_of_week}, Assignee: {t.assignee_id?.slice(0, 8)}...)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tasksData.current_state && (
              <div className="mt-2">
                <h3 className="font-medium">Current State:</h3>
                <pre className="text-xs bg-gray-100 p-2 rounded">
                  {JSON.stringify(tasksData.current_state, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}