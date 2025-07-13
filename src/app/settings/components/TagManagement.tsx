'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Edit2, GripVertical, Check, X } from 'lucide-react'

const TEAM_ID = 'ada25a92-25fa-4ca2-8d35-eb9b71f97e4b'

interface Tag {
  id: string
  name: string
  position?: number
}

export function TagManagement() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Try to fetch with position first
      let { data, error } = await supabase
        .from('tags')
        .select('id, name, position')
        .eq('team_id', TEAM_ID)
        .order('position', { ascending: true })
        .order('name', { ascending: true })

      // If position column doesn't exist, fetch without it
      if (error && error.message.includes('position')) {
        const result = await supabase
          .from('tags')
          .select('id, name')
          .eq('team_id', TEAM_ID)
          .order('name', { ascending: true })
        
        data = result.data
        error = result.error
      }

      if (error) throw error

      // Add position if it doesn't exist
      const tagsWithPosition = (data || []).map((tag, index) => ({
        ...tag,
        position: tag.position ?? index
      }))

      setTags(tagsWithPosition)
    } catch (err) {
      console.error('Error fetching tags:', err)
      setError('Failed to load tags. Please check console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination } = result

    if (!destination || source.index === destination.index) {
      return
    }

    const newTags = Array.from(tags)
    const [removed] = newTags.splice(source.index, 1)
    newTags.splice(destination.index, 0, removed)

    setTags(newTags)

    // Update positions in database
    try {
      const updates = newTags.map((tag, index) => ({
        id: tag.id,
        position: index
      }))

      for (const update of updates) {
        const { error } = await supabase
          .from('tags')
          .update({ position: update.position })
          .eq('id', update.id)

        if (error && !error.message.includes('position')) {
          throw error
        }
      }
    } catch (err) {
      console.error('Error updating tag positions:', err)
      setError('Position column may not exist. Run the SQL migration to enable tag ordering.')
      fetchTags() // Revert on error
    }
  }

  const handleAddTag = async () => {
    if (!newTagName.trim()) return

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: newTagName.trim(),
          team_id: TEAM_ID,
          position: tags.length,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      setTags([...tags, data])
      setNewTagName('')
      setIsAddingTag(false)
    } catch (err) {
      console.error('Error adding tag:', err)
      setError('Failed to add tag')
    }
  }

  const handleEditTag = async (tagId: string) => {
    if (!editingName.trim()) return

    try {
      const { error } = await supabase
        .from('tags')
        .update({
          name: editingName.trim()
        })
        .eq('id', tagId)

      if (error) throw error

      setTags(tags.map(tag => 
        tag.id === tagId ? { ...tag, name: editingName.trim() } : tag
      ))
      setEditingTag(null)
      setEditingName('')
    } catch (err) {
      console.error('Error updating tag:', err)
      setError('Failed to update tag')
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? Tasks with this tag will not be affected.')) {
      return
    }

    try {
      // First delete all task_tags associations
      const { error: tagAssocError } = await supabase
        .from('task_tags')
        .delete()
        .eq('tag_id', tagId)

      if (tagAssocError) throw tagAssocError

      // Then delete the tag
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)

      if (error) throw error

      setTags(tags.filter(tag => tag.id !== tagId))
    } catch (err) {
      console.error('Error deleting tag:', err)
      setError('Failed to delete tag')
    }
  }

  if (isLoading) {
    return <p className="text-gray-500">Loading tags...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Tag Management</h2>
        {!isAddingTag && (
          <Button
            size="sm"
            onClick={() => setIsAddingTag(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tag
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {isAddingTag && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Enter tag name"
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleAddTag}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsAddingTag(false)
              setNewTagName('')
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="tags">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-2"
            >
              {tags.length === 0 ? (
                <p className="text-gray-500 text-sm italic py-4">No tags yet. Add your first tag above.</p>
              ) : (
                tags.map((tag, index) => (
                  <Draggable key={tag.id} draggableId={tag.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 p-3 bg-white border rounded-md ${
                          snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-sm'
                        }`}
                      >
                        <div {...provided.dragHandleProps} className="cursor-move">
                          <GripVertical className="w-4 h-4 text-gray-400" />
                        </div>
                        
                        {editingTag === tag.id ? (
                          <>
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleEditTag(tag.id)}
                              className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleEditTag(tag.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTag(null)
                                setEditingName('')
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-gray-900">{tag.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTag(tag.id)
                                setEditingName(tag.name)
                              }}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTag(tag.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Tips:</strong> Drag tags to reorder them. This order will be reflected throughout the app. 
          Deleting a tag removes it from the list but won't affect tasks that already have the tag assigned.
        </p>
      </div>
    </div>
  )
}