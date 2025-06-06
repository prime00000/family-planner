'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function TestPage() {
  const [teamData, setTeamData] = useState<any>(null)
  const [rebuildResult, setRebuildResult] = useState<any>(null)
  const [setupResult, setSetupResult] = useState<any>(null)
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
                {teamData.members.map((m: any) => (
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
        <h2 className="text-lg font-semibold mb-4">Rebuild Plan Tasks</h2>
        <p className="text-sm text-gray-600 mb-4">
          Use this to rebuild plan_tasks from the ai_conversation field
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter plan ID"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <Button onClick={rebuildTasks}>Rebuild Tasks</Button>
        </div>
        {rebuildResult && (
          <div className="mt-4">
            <p className={rebuildResult.success ? 'text-green-600' : 'text-red-600'}>
              {rebuildResult.success ? rebuildResult.message : rebuildResult.error}
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}