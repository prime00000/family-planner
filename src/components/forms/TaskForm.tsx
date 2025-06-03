'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { TEAM_ID } from '@/lib/constants'

interface TaskFormProps {
  onClose: () => void
  onSubmit: (data: TaskFormData, andContinue?: boolean) => void
  defaultAssignee?: string
  isManualTask?: boolean
}

export interface TaskFormData {
  description: string
  importance?: number
  urgency?: number
  tags: string[]
  objectiveId?: string
  assignee_id?: string
}

interface FamilyMember {
  id: string
  full_name: string
}

interface Objective {
  id: string
  description: string
}

const TAGS = [
  { id: 'health', label: 'Health' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'education', label: 'Education' },
  { id: 'chores', label: 'Chores' },
  { id: 'other', label: 'Other' },
]

export function TaskForm({ onClose, onSubmit, defaultAssignee, isManualTask }: TaskFormProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState<TaskFormData>({
    description: '',
    tags: [],
    assignee_id: defaultAssignee || '',
  })
  const [showSuccess, setShowSuccess] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(true)
  const [showMoreOptions, setShowMoreOptions] = useState(false)

  useEffect(() => {
    // Fetch family members
    async function fetchFamilyMembers() {
      try {
        const { data: members, error } = await supabase
          .from('users')
          .select('id, full_name')
          .order('full_name')

        if (error) throw error

        setFamilyMembers(members?.map(m => ({
          id: m.id,
          full_name: m.full_name || 'Unknown'
        })) || [])

      } catch (err) {
        console.error('Error fetching family members:', err)
      } finally {
        setIsLoadingMembers(false)
      }
    }

    // Fetch objectives
    async function fetchObjectives() {
      try {
        const { data: objectives, error } = await supabase
          .from('objectives')
          .select('id, description')
          .eq('team_id', TEAM_ID)
          .eq('status', 'active')
          .order('created_at', { ascending: false })

        if (error) throw error

        setObjectives(objectives || [])
      } catch (err) {
        console.error('Error fetching objectives:', err)
      }
    }

    fetchFamilyMembers()
    fetchObjectives()
  }, [])

  useEffect(() => {
    // Trigger animation after mount
    requestAnimationFrame(() => {
      setIsOpen(true)
    })
  }, [])

  useEffect(() => {
    if (user && familyMembers.length > 0 && formData.assignee_id === 'assign_to_myself') {
      setFormData(prev => ({ ...prev, assignee_id: user.id }))
    }
    // Also handle defaultAssignee if it's the user's ID
    if (defaultAssignee && defaultAssignee !== 'unassigned' && !formData.assignee_id) {
      setFormData(prev => ({ ...prev, assignee_id: defaultAssignee }))
    }
  }, [user, familyMembers, defaultAssignee, formData.assignee_id])

  const handleClose = () => {
    setIsOpen(false)
    // Wait for animation to complete before actually closing
    setTimeout(onClose, 500)
  }

  const handleSubmit = async (quickSubmit: boolean, andContinue = false) => {
    if (!formData.description.trim()) {
      return // Add proper validation feedback later
    }

    // For quick submit, only send description and assignee
    const submitData = quickSubmit ? {
      description: formData.description,
      tags: [],
      assignee_id: formData.assignee_id, // Include assignee_id even in quick submit
    } : formData

    console.log('Submitting with assignee_id:', formData.assignee_id)
    onSubmit(submitData, andContinue)
    setShowSuccess(true)
    
    if (!andContinue) {
      setTimeout(() => {
        onClose()  // Call onClose directly instead of handleClose
      }, 1500)
    } else {
      // For Submit+, show overlay success message and reset form
      setTimeout(() => {
        setShowSuccess(false)
        setFormData({
          description: '',
          importance: undefined,
          urgency: undefined,
          tags: [],
          objectiveId: undefined,
          assignee_id: undefined,
        })
      }, 1500)
    }
  }

  // Force rebuild
  const renderRatingGroup = (
    name: 'importance' | 'urgency',
    onChange: (value: number) => void,
    value?: number
  ) => (
    <div className="flex items-center justify-between gap-1 px-2">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium
            transition-colors duration-200
            ${value === rating 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
          `}
        >
          {rating === 1 ? 'L' : rating === 3 ? 'M' : rating === 5 ? 'H' : rating}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`
          fixed inset-0 bg-black/20 z-40 
          transition-opacity duration-500
          ${isOpen ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleClose}
      />

      {/* Form */}
      <div 
        className={`
          fixed inset-x-0 bottom-0 z-50 
          bg-white rounded-t-xl shadow-lg
          transform transition-transform duration-500 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <div className="p-4 pb-24 sm:pb-6 max-h-[85vh] overflow-y-auto">
          {/* Success Message Overlay */}
          {showSuccess && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center animate-fade-in z-[60]">
              <p className="text-green-600 text-lg font-medium">Task added successfully!</p>
            </div>
          )}

          <div className="flex justify-end mb-6">
            <Button variant="ghost" size="sm" onClick={handleClose}>×</Button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {isManualTask ? "What is your new task?" : "What is your task?"} <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your task..."
              />
            </div>

            {/* Assignee Selection - Always shown for manual tasks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to
              </label>
              <Select
                value={formData.assignee_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, assignee_id: value }))}
              >
                <SelectTrigger className="w-full" disabled={isLoadingMembers}>
                  <SelectValue>
                    {isLoadingMembers ? (
                      "Loading family members..."
                    ) : (
                      formData.assignee_id ? 
                        formData.assignee_id === user?.id ? "Myself" :
                        familyMembers.find(m => m.id === formData.assignee_id)?.full_name || "Unassigned"
                        : "Select assignee"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {isLoadingMembers ? (
                    <SelectItem value="" disabled>Loading...</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="">Unassigned</SelectItem>
                      {user && (
                        <SelectItem value={user.id}>Assign to Myself</SelectItem>
                      )}
                      {familyMembers
                        .filter(member => member.id !== user?.id) // Filter out current user
                        .map(member => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name}
                          </SelectItem>
                        ))
                      }
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {isManualTask ? (
              // Manual task mode - show collapsible more options
              <div>
                {/* Quick Submit buttons for manual tasks - primary action */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="default"
                    size="lg"
                    className="flex-1"
                    onClick={() => handleSubmit(true, false)}
                  >
                    Quick Submit
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={() => handleSubmit(true, true)}
                  >
                    Quick Submit +
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="w-full justify-between"
                >
                  More options
                  <span className={`transform transition-transform ${showMoreOptions ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </Button>
                
                {showMoreOptions && (
                  <div className="space-y-6 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Related Objective
                      </label>
                      <Select
                        value={formData.objectiveId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, objectiveId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {formData.objectiveId === 'none' 
                              ? 'None' 
                              : objectives.find(o => o.id === formData.objectiveId)?.description || 'Select an objective'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {objectives.map(objective => (
                            <SelectItem key={objective.id} value={objective.id}>
                              {objective.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tags
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {TAGS.map(tag => (
                          <div key={tag.id} className="flex items-center h-12">
                            <label
                              htmlFor={tag.id}
                              className="flex items-center flex-1 h-full px-3 rounded hover:bg-gray-50 cursor-pointer"
                            >
                              <Checkbox
                                id={tag.id}
                                className="w-6 h-6"
                                checked={formData.tags.includes(tag.id)}
                                onCheckedChange={(checked) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    tags: checked
                                      ? [...prev.tags, tag.id]
                                      : prev.tags.filter(t => t !== tag.id)
                                  }))
                                }}
                              />
                              <span className="ml-3 text-sm text-gray-600">
                                {tag.label}
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Importance
                      </label>
                      {renderRatingGroup(
                        'importance',
                        (value) => setFormData(prev => ({ ...prev, importance: value })),
                        formData.importance
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Urgency
                      </label>
                      {renderRatingGroup(
                        'urgency',
                        (value) => setFormData(prev => ({ ...prev, urgency: value })),
                        formData.urgency
                      )}
                    </div>

                    {/* Regular Submit buttons moved inside More options */}
                    <div className="flex gap-3 pt-6 mt-8 border-t">
                      <Button
                        className="flex-1 h-12 text-base"
                        onClick={() => handleSubmit(false, false)}
                      >
                        Submit
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-12 text-base"
                        onClick={() => handleSubmit(false, true)}
                      >
                        Submit +
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Regular task mode - show all options
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {TAGS.map(tag => (
                      <div key={tag.id} className="flex items-center h-12">
                        <label
                          htmlFor={tag.id}
                          className="flex items-center flex-1 h-full px-3 rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <Checkbox
                            id={tag.id}
                            className="w-6 h-6"
                            checked={formData.tags.includes(tag.id)}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                tags: checked
                                  ? [...prev.tags, tag.id]
                                  : prev.tags.filter(t => t !== tag.id)
                              }))
                            }}
                          />
                          <span className="ml-3 text-sm text-gray-600">
                            {tag.label}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Importance
                  </label>
                  {renderRatingGroup(
                    'importance',
                    (value) => setFormData(prev => ({ ...prev, importance: value })),
                    formData.importance
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Urgency
                  </label>
                  {renderRatingGroup(
                    'urgency',
                    (value) => setFormData(prev => ({ ...prev, urgency: value })),
                    formData.urgency
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Related Objective
                  </label>
                  <Select
                    value={formData.objectiveId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, objectiveId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {formData.objectiveId === 'none' 
                          ? 'None' 
                          : objectives.find(o => o.id === formData.objectiveId)?.description || 'Select an objective'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {objectives.map(objective => (
                        <SelectItem key={objective.id} value={objective.id}>
                          {objective.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Regular Submit buttons for non-manual tasks */}
                <div className="flex gap-3 pt-6 mt-8 border-t">
                  <Button
                    className="flex-1 h-12 text-base"
                    onClick={() => handleSubmit(false, false)}
                  >
                    Submit
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 text-base"
                    onClick={() => handleSubmit(false, true)}
                  >
                    Submit +
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
} 