'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { usePlanningStore } from '@/stores/planningStore'
import { supabase } from '@/lib/supabase'
import { 
  AlertCircle, 
  Tag, 
  Star, 
  Flame, 
  CheckSquare, 
  Square, 
  ChevronRight,
  Lightbulb,
  Wrench,
  Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { TEAM_ID, PLANNING_PHASES } from '@/lib/constants'

interface NewItem {
  id: string
  description: string
  importance: number | null
  urgency?: number | null
  submitted_by: string
  created_at: string
  tags?: Array<{
    name: string
    color: string
  }>
  frequency?: string
  objective_id?: string
  objective_description?: string
}

interface NewItemsData {
  objectives: NewItem[]
  tasks: NewItem[]
  maintenance: NewItem[]
}

// Fix the importance/urgency icon components
const ImportanceIcon = ({ level }: { level: number | undefined | null }) => {
  console.log('ImportanceIcon received level:', level, typeof level)
  if (!level) return null
  
  // Parse level as number if it's a string and ensure it's within 1-5 range
  const numLevel = typeof level === 'string' ? parseInt(level, 10) : level
  const count = Math.min(Math.max(1, numLevel), 5)
  
  console.log('ImportanceIcon rendering count:', count)
  return (
    <div className="flex items-center space-x-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star 
          key={i} 
          className="h-4 w-4 text-yellow-400" 
          fill="currentColor"
        />
      ))}
    </div>
  )
}

// Fix the urgency icon components
const UrgencyIcon = ({ level }: { level: number | undefined | null }) => {
  console.log('UrgencyIcon received level:', level, typeof level)
  if (!level) return null
  
  // Parse level as number if it's a string and ensure it's within 1-5 range
  const numLevel = typeof level === 'string' ? parseInt(level, 10) : level
  const count = Math.min(Math.max(1, numLevel), 5)
  
  console.log('UrgencyIcon rendering count:', count)
  return (
    <div className="flex items-center space-x-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Flame 
          key={i} 
          className="h-4 w-4 text-red-400" 
          fill="currentColor"
        />
      ))}
    </div>
  )
}

// Fix the RelatedObjectives component
const RelatedObjectives = ({ description }: { description?: string }) => {
  console.log('RelatedObjectives received description:', description)
  if (!description?.trim()) return null
  
  return (
    <div className="flex items-start space-x-2 text-sm text-gray-600">
      <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <div className="line-clamp-2">
        {description}
      </div>
    </div>
  )
}

// Fix the ItemTags component to use className instead of style
const ItemTags = ({ tags }: { tags?: Array<{ name: string, color: string }> }) => {
  if (!tags?.length) return null
  
  return (
    <div className="flex items-start space-x-2">
      <Tag className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-500" />
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => {
          const luminance = getContrastColor(tag.color) === '#FFFFFF'
          return (
            <Badge
              key={tag.name}
              variant={luminance ? 'default' : 'secondary'}
              className={`text-xs ${luminance ? 'bg-opacity-90' : ''} [background-color:${tag.color}] [color:${getContrastColor(tag.color)}]`}
            >
              {tag.name}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}

// Helper function for text contrast
const getContrastColor = (bgColor: string) => {
  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

export default function NewItemsReview() {
  const router = useRouter()
  const { isLoading, isAdmin } = useAuth()
  const { setPhase, addDecisionLog } = usePlanningStore()
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState('objectives')
  const [selectedItems, setSelectedItems] = useState(new Set<string>())
  const [aiCommand, setAiCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showingSuggestions] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [newItems, setNewItems] = useState<NewItemsData>({
    objectives: [],
    tasks: [],
    maintenance: []
  })
  const [lastPlanDate, setLastPlanDate] = useState<Date | null>(null)
  const [objectivesMap, setObjectivesMap] = useState<Record<string, string>>({})

  // Handle redirect after render
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/')
    }
  }, [isLoading, isAdmin, router])

  // Add debug logging for objectivesMap updates
  useEffect(() => {
    console.log('objectivesMap updated:', objectivesMap)
  }, [objectivesMap])

  // Add debug effect for data changes
  useEffect(() => {
    console.log('Current newItems state:', newItems)
  }, [newItems])

  // Fetch data
  useEffect(() => {
    const fetchNewItems = async () => {
      if (isFetching) return
      
      try {
        setIsFetching(true)

        // First get the most recent weekly plan
        const { data: lastPlan, error: planError } = await supabase
          .from('weekly_plans')
          .select('created_at')
          .eq('team_id', TEAM_ID)
          .order('created_at', { ascending: false })
          .limit(1)

        if (planError) throw planError

        // Set cutoff date
        const cutoffDate = lastPlan?.[0]?.created_at
          ? new Date(lastPlan[0].created_at)
          : (() => {
              const date = new Date()
              date.setDate(date.getDate() - 7)
              date.setHours(0, 0, 0, 0)
              return date
            })()

        setLastPlanDate(cutoffDate)

        // Fetch objectives first and create map
        const { data: objectives, error: objError } = await supabase
          .from('objectives')
          .select(`
            id,
            description,
            importance,
            urgency,
            created_at,
            users!submitted_by ( full_name )
          `)
          .eq('team_id', TEAM_ID)
          .gte('created_at', cutoffDate.toISOString())

        if (objError) throw objError
        
        console.log('Fetched objectives:', objectives)

        // Create objectives lookup map
        const objMap = objectives.reduce((acc: Record<string, string>, obj: { id: string; description: string }) => {
          if (obj.id) {
            acc[obj.id] = obj.description
          }
          return acc
        }, {})
        
        console.log('Created objectives map:', objMap)
        setObjectivesMap(objMap)

        // Fetch tasks with objective_id
        const { data: tasks, error: taskError } = await supabase
          .from('tasks')
          .select(`
            id,
            description,
            importance,
            urgency,
            objective_id,
            created_at,
            users!submitted_by ( full_name ),
            task_tags ( 
              tags ( 
                name,
                color
              ) 
            )
          `)
          .eq('team_id', TEAM_ID)
          .gte('created_at', cutoffDate.toISOString())

        if (taskError) throw taskError
        
        console.log('Fetched tasks with objectives:', tasks)

        // Fetch maintenance items with tags
        const { data: maintenance, error: maintError } = await supabase
          .from('maintenance_items')
          .select(`
            id,
            description,
            importance,
            frequency,
            created_at,
            users!submitted_by ( full_name ),
            maintenance_tags ( 
              tags ( 
                name,
                color
              ) 
            )
          `)
          .eq('team_id', TEAM_ID)
          .gte('created_at', cutoffDate.toISOString())

        if (maintError) throw maintError

        // Transform data with proper type handling
        const transformedData = {
          objectives: objectives.map((obj: { 
            id: string; 
            description: string; 
            importance: string | number | null; 
            urgency: string | number | null;
            created_at: string;
            users: { full_name: string } | null;
          }) => {
            const importance = obj.importance ? parseInt(String(obj.importance), 10) : null
            const urgency = obj.urgency ? parseInt(String(obj.urgency), 10) : null
            
            console.log('Transforming objective:', { ...obj, importance, urgency })
            
            return {
              id: obj.id,
              description: obj.description,
              importance,
              urgency,
              submitted_by: obj.users?.full_name || 'Unknown',
              created_at: obj.created_at
            }
          }),
          tasks: tasks.map((task: {
            id: string;
            description: string;
            importance: string | number | null;
            urgency: string | number | null;
            objective_id: string | null;
            created_at: string;
            users: { full_name: string } | null;
            task_tags: Array<{
              tags: {
                name: string;
                color: string;
              }
            }> | null;
          }) => {
            const importance = task.importance ? parseInt(String(task.importance), 10) : null
            const urgency = task.urgency ? parseInt(String(task.urgency), 10) : null
            const objectiveDesc = task.objective_id ? objMap[task.objective_id] : undefined
            
            console.log('Transforming task:', {
              ...task,
              importance,
              urgency,
              objectiveDesc
            })
            
            return {
              id: task.id,
              description: task.description,
              importance,
              urgency,
              objective_id: task.objective_id,
              objective_description: objectiveDesc,
              submitted_by: task.users?.full_name || 'Unknown',
              created_at: task.created_at,
              tags: task.task_tags?.map(tt => ({
                name: tt.tags.name,
                color: tt.tags.color
              })) || []
            }
          }),
          maintenance: maintenance.map((item: {
            id: string;
            description: string;
            importance: string | number | null;
            frequency: string;
            created_at: string;
            users: { full_name: string } | null;
            maintenance_tags: Array<{
              tags: {
                name: string;
                color: string;
              }
            }> | null;
          }) => {
            const importance = item.importance ? parseInt(String(item.importance), 10) : null
            
            console.log('Transforming maintenance item:', {
              ...item,
              importance
            })
            
            return {
              id: item.id,
              description: item.description,
              importance,
              frequency: item.frequency,
              submitted_by: item.users?.full_name || 'Unknown',
              created_at: item.created_at,
              tags: item.maintenance_tags?.map(mt => ({
                name: mt.tags.name,
                color: mt.tags.color
              })) || []
            }
          })
        }

        console.log('Setting transformed data:', transformedData)
        setNewItems(transformedData)
      } catch (error) {
        console.error('Error fetching new items:', error)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load new items. Please try refreshing the page.'
        })
      } finally {
        setIsFetching(false)
      }
    }

    if (!isLoading && isAdmin) {
      fetchNewItems()
    }
  }, [isLoading, isAdmin, toast, isFetching])

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    const currentItems = newItems[activeTab as keyof NewItemsData]
    const allSelected = currentItems.every(item => selectedItems.has(item.id))
    
    if (allSelected) {
      // Deselect all in current tab
      const newSelected = new Set(selectedItems)
      currentItems.forEach(item => newSelected.delete(item.id))
      setSelectedItems(newSelected)
    } else {
      // Select all in current tab
      const newSelected = new Set(selectedItems)
      currentItems.forEach(item => newSelected.add(item.id))
      setSelectedItems(newSelected)
    }
  }

  const handleAiCommand = async () => {
    if (!aiCommand.trim()) return
    
    setIsProcessing(true)
    console.log('AI Command:', aiCommand)
    console.log('Selected Items:', Array.from(selectedItems))
    
    // Log the command for future reference
    addDecisionLog(`AI Command: ${aiCommand} (${selectedItems.size} items)`)
    
    // TODO: Implement AI command processing
    toast({
      title: 'Not implemented',
      description: 'AI processing not yet implemented'
    })
    
    setIsProcessing(false)
    setAiCommand('')
  }

  const tabs = [
    { id: 'objectives', label: <Lightbulb className="h-4 w-4" />, count: newItems.objectives.length },
    { id: 'tasks', label: <CheckSquare className="h-4 w-4" />, count: newItems.tasks.length },
    { id: 'maintenance', label: <Wrench className="h-4 w-4" />, count: newItems.maintenance.length }
  ]

  const renderObjective = (objective: NewItem) => {
    console.log('Rendering objective:', {
      id: objective.id,
      importance: objective.importance,
      urgency: objective.urgency
    })
    
    return (
      <div key={objective.id} className="flex items-start space-x-3 p-4 hover:bg-gray-50 rounded-lg">
        <button
          onClick={() => handleSelectItem(objective.id)}
          className="mt-1 flex-shrink-0"
        >
          {selectedItems.has(objective.id) ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-gray-900">{objective.description}</p>
          
          <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500">
            <span className="flex items-center">by {objective.submitted_by}</span>
            {objective.importance !== null && objective.importance > 0 && (
              <ImportanceIcon level={objective.importance} />
            )}
            {objective.urgency !== null && objective.urgency > 0 && (
              <UrgencyIcon level={objective.urgency} />
            )}
          </div>

          <ItemTags tags={objective.tags} />
        </div>
      </div>
    )
  }

  const renderTask = (task: NewItem) => {
    console.log('Rendering task:', {
      id: task.id,
      importance: task.importance,
      urgency: task.urgency,
      objective_id: task.objective_id,
      objective_description: task.objective_description
    })
    
    return (
      <div key={task.id} className="flex items-start space-x-3 p-4 hover:bg-gray-50 rounded-lg">
        <button
          onClick={() => handleSelectItem(task.id)}
          className="mt-1 flex-shrink-0"
        >
          {selectedItems.has(task.id) ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-gray-900">{task.description}</p>
          
          <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500">
            <span className="flex items-center">by {task.submitted_by}</span>
            {task.importance !== null && task.importance > 0 && (
              <ImportanceIcon level={task.importance} />
            )}
            {task.urgency !== null && task.urgency > 0 && (
              <UrgencyIcon level={task.urgency} />
            )}
          </div>

          {task.objective_description && (
            <RelatedObjectives description={task.objective_description} />
          )}
          <ItemTags tags={task.tags} />
        </div>
      </div>
    )
  }

  const renderMaintenance = (item: NewItem) => {
    console.log('Rendering maintenance item:', {
      id: item.id,
      importance: item.importance
    })
    
    return (
      <div key={item.id} className="flex items-start space-x-3 p-4 hover:bg-gray-50 rounded-lg">
        <button
          onClick={() => handleSelectItem(item.id)}
          className="mt-1 flex-shrink-0"
        >
          {selectedItems.has(item.id) ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-gray-900">{item.description}</p>
          
          <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500">
            <span className="flex items-center">by {item.submitted_by}</span>
            {item.importance !== null && item.importance > 0 && (
              <ImportanceIcon level={item.importance} />
            )}
            <Badge variant="outline" className="text-xs">{item.frequency}</Badge>
          </div>

          <ItemTags tags={item.tags} />
        </div>
      </div>
    )
  }

  const currentItems = newItems[activeTab as keyof NewItemsData]
  const totalNewItems = newItems.objectives.length + newItems.tasks.length + newItems.maintenance.length

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-[200px] bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    )
  }

  // Don't render content for non-admins
  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-2 sm:px-4 py-3 sm:py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Items Review</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalNewItems} new items since {lastPlanDate ? lastPlanDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              }) : '7 days ago'}
            </p>
          </div>
        </div>
      </div>

      {/* AI Suggestions Banner (when active) */}
      {showingSuggestions && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">AI Suggestions Available</p>
                <p className="text-sm text-blue-700 mt-1">
                  I noticed some tasks might be duplicates and several items are missing importance levels. 
                  Would you like me to help organize these?
                </p>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-2 sm:px-4 mt-4 sm:mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="px-2 sm:px-4 mt-4 sm:mt-6">
        <Card>
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {currentItems.every(item => selectedItems.has(item.id)) ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
          <div className="p-0">
            {currentItems.length === 0 ? (
              <div className="p-4 sm:p-8 text-center text-gray-500">
                No new {activeTab} to review
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activeTab === 'objectives' && currentItems.map(renderObjective)}
                {activeTab === 'tasks' && currentItems.map(renderTask)}
                {activeTab === 'maintenance' && currentItems.map(renderMaintenance)}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* AI Command Bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 bg-blue-600 text-white z-40">
          <div className="px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center space-x-3">
              <p className="text-sm font-medium">
                What shall I do with these {selectedItems.size} items?
              </p>
              <Input
                type="text"
                value={aiCommand}
                onChange={(e) => setAiCommand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAiCommand()}
                placeholder="e.g., Set all to high importance"
                className="flex-1 px-3 py-1 text-sm bg-blue-700 border border-blue-500 rounded-md text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white"
                disabled={isProcessing}
              />
              <Button
                onClick={handleAiCommand}
                disabled={isProcessing || !aiCommand.trim()}
                className="px-4 py-1 bg-white text-blue-600 text-sm font-medium rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setPhase(PLANNING_PHASES.PAST_WEEK)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Review
            </Button>
            <Button
              onClick={() => setPhase(PLANNING_PHASES.VIBE_PLAN)}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <span>Next: Plan Week</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 