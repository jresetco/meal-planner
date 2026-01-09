'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BaselinePreset, Recipe } from '@/types'

interface PresetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: BaselinePreset
  currentValues: {
    maxLeftoversPerWeek: number
    servingsPerMeal: number
    guaranteedMealIds: string[]
    guidelines?: string
  }
  onSave: (preset: Omit<BaselinePreset, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>) => Promise<void>
}

export function PresetDialog({ open, onOpenChange, preset, currentValues, onSave }: PresetDialogProps) {
  const [name, setName] = useState(preset?.name || '')
  const [isDefault, setIsDefault] = useState(preset?.isDefault || false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name for this preset')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave({
        name: name.trim(),
        maxLeftovers: currentValues.maxLeftoversPerWeek,
        servingsPerMeal: currentValues.servingsPerMeal,
        guaranteedMealIds: currentValues.guaranteedMealIds,
        guidelines: currentValues.guidelines || null,
        isDefault,
      })
      onOpenChange(false)
      setName('')
      setIsDefault(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{preset ? 'Edit Preset' : 'Save as Preset'}</DialogTitle>
          <DialogDescription>
            Save your current planning settings as a preset for quick reuse.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              placeholder="e.g., Weeknight Quick Meals"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is-default">Set as Default</Label>
              <p className="text-xs text-muted-foreground">
                Automatically load these settings when creating a new plan
              </p>
            </div>
            <Switch
              id="is-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              disabled={isSaving}
            />
          </div>

          <div className="rounded-lg bg-slate-50 p-3 space-y-2">
            <p className="text-sm font-medium">Settings to Save:</p>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>• Max leftovers per week: {currentValues.maxLeftoversPerWeek}</li>
              <li>• Servings per meal: {currentValues.servingsPerMeal}</li>
              <li>• Guaranteed meals: {currentValues.guaranteedMealIds.length} selected</li>
              {currentValues.guidelines && <li>• Planning guidelines: {currentValues.guidelines.length} characters</li>}
            </ul>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Preset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
