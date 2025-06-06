'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

interface CommandBarProps {
  selectedCount: number
  onSubmit: (feedback: string) => void
  isProcessing: boolean
}

export function CommandBar({ selectedCount, onSubmit, isProcessing }: CommandBarProps) {
  const [feedback, setFeedback] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [feedback])
  
  const handleSubmit = () => {
    if (feedback.trim() && !isProcessing) {
      onSubmit(feedback.trim())
      setFeedback('')
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  const placeholder = selectedCount > 0
    ? `What shall I do with these ${selectedCount} items?`
    : '💭 What adjustments would you like?'
  
  return (
    <>
      {selectedCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-t-md px-3 py-2 -mx-3 sm:-mx-4 -mt-4 mb-3">
          <p className="text-sm text-blue-800">
            {selectedCount} {selectedCount === 1 ? 'task' : 'tasks'} selected
          </p>
        </div>
      )}
      
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isProcessing}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
          rows={1}
        />
        <Button
          onClick={handleSubmit}
          disabled={!feedback.trim() || isProcessing}
          size="sm"
          className="px-3 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </>
  )
}