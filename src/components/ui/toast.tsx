'use client'

import { useEffect, useState } from 'react'
import { useToast, type Toast } from './use-toast'

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(enterTimer)
  }, [])

  const baseStyles = 'fixed transform transition-all duration-300 ease-in-out'
  const positionStyles = 'bottom-4 right-4'
  const variantStyles = {
    default: 'bg-white border border-gray-200 shadow-lg',
    destructive: 'bg-red-50 border border-red-200'
  }
  const visibilityStyles = isVisible
    ? 'translate-y-0 opacity-100'
    : 'translate-y-2 opacity-0'

  return (
    <div
      className={`
        ${baseStyles}
        ${positionStyles}
        ${variantStyles[toast.variant || 'default']}
        ${visibilityStyles}
        rounded-lg p-4 min-w-[300px] max-w-[500px]
      `}
      role="alert"
    >
      {toast.title && (
        <h3 className="font-medium text-gray-900 mb-1">{toast.title}</h3>
      )}
      {toast.description && (
        <div className="text-sm text-gray-700">{toast.description}</div>
      )}
    </div>
  )
}

export function Toaster() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
} 