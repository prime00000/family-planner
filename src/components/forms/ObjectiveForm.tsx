'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ObjectiveFormProps {
  onClose: () => void
  onSubmit: (data: ObjectiveFormData, andContinue?: boolean) => void
}

export interface ObjectiveFormData {
  description: string
  importance?: number
}

export function ObjectiveForm({ onClose, onSubmit }: ObjectiveFormProps) {
  const [formData, setFormData] = useState<ObjectiveFormData>({
    description: '',
  })
  const [showSuccess, setShowSuccess] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Trigger animation after mount
    requestAnimationFrame(() => {
      setIsOpen(true)
    })
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    // Wait for animation to complete before actually closing
    setTimeout(onClose, 500)
  }

  const handleSubmit = async (andContinue = false) => {
    if (!formData.description.trim()) {
      return // Add proper validation feedback later
    }

    onSubmit(formData, andContinue)
    setShowSuccess(true)
    
    if (!andContinue) {
      setTimeout(() => {
        handleClose()
      }, 1500)
    } else {
      // For Submit+, show overlay success message and reset form
      setTimeout(() => {
        setShowSuccess(false)
        setFormData({
          description: '',
          importance: undefined,
        })
      }, 1500)
    }
  }

  // Force rebuild
  const renderRatingGroup = (
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
        <div className="p-4 max-h-[90vh] overflow-y-auto">
          {/* Success Message Overlay */}
          {showSuccess && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center animate-fade-in z-[60]">
              <p className="text-green-600 text-lg font-medium">Objective added successfully!</p>
            </div>
          )}

          <div className="flex justify-end mb-6">
            <Button variant="ghost" size="sm" onClick={handleClose}>×</Button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                What is your objective? <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your objective..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Importance
              </label>
              {renderRatingGroup(
                (value) => setFormData(prev => ({ ...prev, importance: value })),
                formData.importance
              )}
            </div>

            <div className="flex gap-3 pt-6 mt-8 border-t">
              <Button
                className="flex-1 h-12 text-base"
                onClick={() => handleSubmit(false)}
              >
                Submit
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-base"
                onClick={() => handleSubmit(true)}
              >
                Submit +
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
} 