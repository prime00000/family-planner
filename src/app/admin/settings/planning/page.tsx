'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { usePlanningStore } from '@/stores/planningStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { 
  Settings, 
  Timer, 
  SkipForward, 
  RotateCcw, 
  Save,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { defaultReviewConfig } from '@/lib/planning/review-config'
import type { SkipPreferences } from '@/lib/planning/agents/review-types'

export default function PlanningSettingsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAdmin } = useAuth()
  const { skipPreferences, updateSkipPreferences } = usePlanningStore()
  const { toast } = useToast()
  
  // Local state for form
  const [localPreferences, setLocalPreferences] = useState<SkipPreferences>(skipPreferences)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/')
    }
  }, [authLoading, isAdmin, router])
  
  // Update local state when store changes
  useEffect(() => {
    setLocalPreferences(skipPreferences)
  }, [skipPreferences])
  
  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(localPreferences) !== JSON.stringify(skipPreferences)
    setHasChanges(changed)
  }, [localPreferences, skipPreferences])
  
  const handleAutoContinueToggle = (enabled: boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      autoContinue: {
        ...prev.autoContinue,
        enabled
      }
    }))
  }
  
  const handleDelayChange = (value: number[]) => {
    setLocalPreferences(prev => ({
      ...prev,
      autoContinue: {
        ...prev.autoContinue,
        delaySeconds: value[0]
      }
    }))
  }
  
  const handleSkipSelectionToggle = (skip: boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      skipSelectionReview: skip
    }))
  }
  
  const handleSkipAssignmentToggle = (skip: boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      skipAssignmentReview: skip
    }))
  }
  
  const handleReset = () => {
    setLocalPreferences(defaultReviewConfig.defaultPreferences)
    toast({
      title: "Settings reset",
      description: "Review preferences have been reset to defaults",
      duration: 3000,
    })
  }
  
  const handleSave = async () => {
    setIsSaving(true)
    
    try {
      // Save to API
      const response = await fetch('/api/planning/v2/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: localPreferences
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }
      
      // Update store
      updateSkipPreferences(localPreferences)
      
      // Update orchestrator
      const { AgentOrchestrator } = await import('@/lib/planning/agents/agent-orchestrator')
      const orchestrator = AgentOrchestrator.getInstance()
      orchestrator.setSkipPreferences(localPreferences)
      
      toast({
        title: "Settings saved",
        description: "Your review preferences have been updated",
        duration: 3000,
      })
      
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save preferences",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/planning')}
            className="mb-4"
          >
            ← Back to Planning
          </Button>
          
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Planning Settings</h1>
              <p className="text-gray-600">Configure your AI planning review preferences</p>
            </div>
          </div>
        </div>
        
        {/* Settings Cards */}
        <div className="space-y-6">
          {/* Auto-Continue Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-purple-600" />
                <CardTitle>Auto-Continue Settings</CardTitle>
              </div>
              <CardDescription>
                Configure automatic progression through review checkpoints
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="auto-continue">Enable Auto-Continue</Label>
                  <p className="text-sm text-gray-500">
                    Automatically approve reviews after a countdown
                  </p>
                </div>
                <Switch
                  id="auto-continue"
                  checked={localPreferences.autoContinue.enabled}
                  onCheckedChange={handleAutoContinueToggle}
                />
              </div>
              
              {localPreferences.autoContinue.enabled && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="delay-slider">Countdown Duration</Label>
                      <Badge variant="secondary">
                        {localPreferences.autoContinue.delaySeconds}s
                      </Badge>
                    </div>
                    <Slider
                      id="delay-slider"
                      min={10}
                      max={120}
                      step={5}
                      value={[localPreferences.autoContinue.delaySeconds]}
                      onValueChange={handleDelayChange}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Time to review before auto-approval (10-120 seconds)
                    </p>
                  </div>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Auto-continue will pause if you make any manual adjustments or if warnings are present
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Skip Review Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <SkipForward className="h-5 w-5 text-purple-600" />
                <CardTitle>Skip Review Settings</CardTitle>
              </div>
              <CardDescription>
                Choose which review checkpoints to skip when conditions are met
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="skip-selection">Skip Selection Review</Label>
                    <p className="text-sm text-gray-500">
                      Auto-skip when: &lt;20 tasks, &gt;70% capacity, no warnings
                    </p>
                  </div>
                  <Switch
                    id="skip-selection"
                    checked={localPreferences.skipSelectionReview}
                    onCheckedChange={handleSkipSelectionToggle}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="skip-assignment">Skip Assignment Review</Label>
                    <p className="text-sm text-gray-500">
                      Auto-skip when: balanced workload, no overload, no warnings
                    </p>
                  </div>
                  <Switch
                    id="skip-assignment"
                    checked={localPreferences.skipAssignmentReview}
                    onCheckedChange={handleSkipAssignmentToggle}
                  />
                </div>
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Reviews will always be shown every {localPreferences.reEnableConditions.everyNthRun}th planning run, 
                  after errors, or when significant changes are detected
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          {/* Current Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Current Configuration</CardTitle>
              <CardDescription>
                Summary of your review preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    Auto-continue: {localPreferences.autoContinue.enabled ? 
                      `Enabled (${localPreferences.autoContinue.delaySeconds}s delay)` : 
                      'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    Selection review: {localPreferences.skipSelectionReview ? 
                      'Auto-skip when conditions met' : 
                      'Always show'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    Assignment review: {localPreferences.skipAssignmentReview ? 
                      'Auto-skip when conditions met' : 
                      'Always show'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">
                    Force review every: {localPreferences.reEnableConditions.everyNthRun} runs
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <Badge variant="secondary">Unsaved changes</Badge>
              )}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}