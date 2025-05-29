'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface MaintenanceFormProps {
  onClose: () => void
  onSubmit: (data: MaintenanceFormData, andContinue?: boolean) => void
}

export interface MaintenanceFormData {
  description: string
  importance?: number
  frequency: string
  tags: string[]
}

const TAGS = [
  { id: 'home', label: 'Home' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'yard', label: 'Yard' },
  { id: 'appliances', label: 'Appliances' },
  { id: 'other', label: 'Other' },
]

const FREQUENCIES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annually', label: 'Annually' },
]

export function MaintenanceForm({ onClose, onSubmit }: MaintenanceFormProps) {
  const [formData, setFormData] = useState<MaintenanceFormData>({
    description: '',
    frequency: '',
    tags: [],
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
    if (!formData.description.trim() || !formData.frequency) {
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
          frequency: '',
          tags: [],
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
              <p className="text-green-600 text-lg font-medium">Maintenance item added successfully!</p>
            </div>
          )}

          <div className="flex justify-end mb-6">
            <Button variant="ghost" size="sm" onClick={handleClose}>×</Button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                What needs regular maintenance? <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the maintenance task..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How often? <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {FREQUENCIES.find(f => f.id === formData.frequency)?.label || "Select frequency"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(freq => (
                    <SelectItem key={freq.id} value={freq.id}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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