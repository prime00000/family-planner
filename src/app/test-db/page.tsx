'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/supabase'

export default function TestDbPage() {
  const [teams, setTeams] = useState<Tables<'teams'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTeams() {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .order('name')

        if (error) {
          throw error
        }

        setTeams(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An error occurred while fetching teams')
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-gray-600">Loading teams...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Teams</h1>
      
      {teams.length === 0 ? (
        <p className="text-gray-600 italic">No teams yet</p>
      ) : (
        <ul className="space-y-2">
          {teams.map(team => (
            <li 
              key={team.id}
              className="p-3 bg-white rounded-lg shadow-sm border border-gray-200"
            >
              <h2 className="font-medium">{team.name}</h2>
              <p className="text-sm text-gray-500">Created: {new Date(team.created_at || '').toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
} 