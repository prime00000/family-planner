'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

interface PriorityPromptProps {
  onSubmit: (priority: string | null) => void
  onBack: () => void
}

export function PriorityPrompt({ onSubmit, onBack }: PriorityPromptProps) {
  const [priority, setPriority] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    const adjustHeight = () => {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
    
    adjustHeight()
  }, [priority])
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-2 sm:px-4 py-4 sm:py-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="px-3 py-4 sm:px-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Plan Week
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Set your priorities for the upcoming week
                </p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6">
            <label className="block text-lg font-medium text-gray-900 mb-4">
              What would you like to prioritize this week?
            </label>
            
            <textarea
              ref={textareaRef}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="Example: Focus on kids' homework, avoid scheduling meetings before 10am, prioritize health-related tasks..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
            />
            
            <p className="mt-2 text-sm text-gray-500">
              (just use ⭐ and 🔥 inputs)
            </p>
            
            <div className="mt-6 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => onSubmit(null)}
                className="px-6"
              >
                Skip
              </Button>
              <Button
                onClick={() => onSubmit(priority)}
                disabled={!priority.trim()}
                className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}