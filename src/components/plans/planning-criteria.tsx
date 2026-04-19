'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, Search, X, Plus, Save } from 'lucide-react'
import { PresetDialog } from './preset-dialog'
import { UnifiedRulesEditor } from '@/components/shared/unified-rules-editor'
import type { Recipe, BaselinePreset } from '@/types'

export interface PlanningCriteriaData {
  baselinePresetId?: string
  maxLeftoversPerWeek: number
  maxDynamicMealsPerWeek?: number
  servingsPerMeal: number
  guaranteedMeals: Pick<Recipe, 'id' | 'name'>[]
  guidelines?: string
}

interface PlanningCriteriaProps {
  presets: BaselinePreset[]
  recipes: Pick<Recipe, 'id' | 'name' | 'categories'>[]
  hasMealComponents?: boolean
  initialData?: PlanningCriteriaData
  onGenerate: (criteria: PlanningCriteriaData) => void
  onBack: () => void
}

export function PlanningCriteria({
  presets,
  recipes,
  hasMealComponents = false,
  initialData,
  onGenerate,
  onBack
}: PlanningCriteriaProps) {
  const [baselinePresetId, setBaselinePresetId] = useState(initialData?.baselinePresetId || '')
  const [maxLeftovers, setMaxLeftovers] = useState(initialData?.maxLeftoversPerWeek === -1 ? 3 : (initialData?.maxLeftoversPerWeek ?? 3))
  const [unlimitedLeftovers, setUnlimitedLeftovers] = useState(initialData?.maxLeftoversPerWeek === -1 || initialData?.maxLeftoversPerWeek === undefined)
  const [servingsPerMeal, setServingsPerMeal] = useState(initialData?.servingsPerMeal ?? 2)
  const [maxDynamic, setMaxDynamic] = useState(initialData?.maxDynamicMealsPerWeek ?? 3)
  const [enableDynamic, setEnableDynamic] = useState((initialData?.maxDynamicMealsPerWeek ?? 0) > 0 || hasMealComponents)
  const [guaranteedMeals, setGuaranteedMeals] = useState<Pick<Recipe, 'id' | 'name'>[]>(
    initialData?.guaranteedMeals || []
  )
  const [guidelines, setGuidelines] = useState(initialData?.guidelines || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const didApplyBaselineRef = useRef(false)

  // Track preset values to know when user has changed something
  const [presetGuidelines, setPresetGuidelines] = useState('')
  const [presetMaxLeftovers, setPresetMaxLeftovers] = useState(-1)
  const [presetServings, setPresetServings] = useState(2)
  const [isSavingDefault, setIsSavingDefault] = useState(false)

  const applyPresetById = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id)
      if (!preset) return
      setBaselinePresetId(id)
      setUnlimitedLeftovers(preset.maxLeftovers === -1)
      setMaxLeftovers(preset.maxLeftovers === -1 ? 3 : preset.maxLeftovers)
      setServingsPerMeal(preset.servingsPerMeal)
      setGuidelines(preset.guidelines || '')
      const meals = recipes.filter((r) => preset.guaranteedMealIds.includes(r.id))
      setGuaranteedMeals(meals.map((m) => ({ id: m.id, name: m.name })))
      // Track preset values for "Set as Default" comparison
      setPresetGuidelines(preset.guidelines || '')
      setPresetMaxLeftovers(preset.maxLeftovers)
      setPresetServings(preset.servingsPerMeal)
    },
    [presets, recipes]
  )

  useEffect(() => {
    if (presets.length === 0 || didApplyBaselineRef.current) return

    if (initialData?.baselinePresetId) {
      applyPresetById(initialData.baselinePresetId)
      didApplyBaselineRef.current = true
      return
    }

    const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0]
    if (defaultPreset) {
      applyPresetById(defaultPreset.id)
      didApplyBaselineRef.current = true
    }
  }, [presets, initialData?.baselinePresetId, applyPresetById])

  useEffect(() => {
    if (recipes.length === 0 || presets.length === 0 || !baselinePresetId) return
    const preset = presets.find((p) => p.id === baselinePresetId)
    if (!preset || preset.guaranteedMealIds.length === 0) return
    setGuaranteedMeals((prev) => {
      if (prev.length > 0) return prev
      const meals = recipes.filter((r) => preset.guaranteedMealIds.includes(r.id))
      return meals.map((m) => ({ id: m.id, name: m.name }))
    })
  }, [recipes, presets, baselinePresetId])

  const handlePresetChange = (value: string) => {
    didApplyBaselineRef.current = true
    applyPresetById(value)
  }

  const currentLeftoversValue = unlimitedLeftovers ? -1 : maxLeftovers
  const mealSettingsChanged = currentLeftoversValue !== presetMaxLeftovers || servingsPerMeal !== presetServings
  const guidelinesChanged = guidelines !== presetGuidelines

  const handleSaveDefaultMealSettings = async () => {
    if (!baselinePresetId) return
    setIsSavingDefault(true)
    try {
      const res = await fetch(`/api/settings/presets/${baselinePresetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxLeftovers: currentLeftoversValue,
          servingsPerMeal,
        }),
      })
      if (res.ok) {
        setPresetMaxLeftovers(currentLeftoversValue)
        setPresetServings(servingsPerMeal)
      }
    } catch (error) {
      console.error('Error saving default meal settings:', error)
    } finally {
      setIsSavingDefault(false)
    }
  }

  const handleSaveDefaultGuidelines = async () => {
    if (!baselinePresetId) return
    setIsSavingDefault(true)
    try {
      const res = await fetch(`/api/settings/presets/${baselinePresetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidelines: guidelines || null }),
      })
      if (res.ok) {
        setPresetGuidelines(guidelines)
      }
    } catch (error) {
      console.error('Error saving default guidelines:', error)
    } finally {
      setIsSavingDefault(false)
    }
  }

  const handleAddMeal = (recipe: Pick<Recipe, 'id' | 'name'>) => {
    if (!guaranteedMeals.find(m => m.id === recipe.id)) {
      setGuaranteedMeals([...guaranteedMeals, recipe])
    }
    setSearchQuery('')
  }

  const handleRemoveMeal = (recipeId: string) => {
    setGuaranteedMeals(guaranteedMeals.filter(m => m.id !== recipeId))
  }

  const handleSavePreset = async (presetData: Omit<BaselinePreset, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>) => {
    const response = await fetch('/api/settings/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presetData),
    })

    if (!response.ok) {
      throw new Error('Failed to save preset')
    }
  }

  const handleGenerate = () => {
    onGenerate({
      baselinePresetId: baselinePresetId || undefined,
      maxLeftoversPerWeek: unlimitedLeftovers ? -1 : maxLeftovers,
      maxDynamicMealsPerWeek: enableDynamic ? maxDynamic : undefined,
      servingsPerMeal,
      guaranteedMeals,
      guidelines: guidelines || undefined,
    })
  }

  const filteredRecipes = recipes.filter(
    (recipe) =>
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !guaranteedMeals.find(m => m.id === recipe.id)
  )

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Planning Criteria</h1>
              <p className="text-slate-600">Configure settings for meal plan generation</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Baseline Settings */}
          {presets.length > 0 && (
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="baseline">Baseline Preset</Label>
                  <p className="text-sm text-slate-600 mb-2">
                    Load a saved configuration preset
                  </p>
                  <Select value={baselinePresetId} onValueChange={handlePresetChange}>
                    <SelectTrigger id="baseline">
                      <SelectValue placeholder="Select a preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                          {preset.isDefault && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          )}

          {/* Meal Settings */}
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Meal Settings</h3>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="leftover">Max Leftover Meals per Week</Label>
                  <Input
                    id="leftover"
                    type="number"
                    min="0"
                    max="10"
                    value={maxLeftovers}
                    onChange={(e) => setMaxLeftovers(parseInt(e.target.value) || 0)}
                    disabled={unlimitedLeftovers}
                    className={unlimitedLeftovers ? 'opacity-50' : ''}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      id="unlimited-leftovers"
                      checked={unlimitedLeftovers}
                      onCheckedChange={setUnlimitedLeftovers}
                    />
                    <Label htmlFor="unlimited-leftovers" className="text-sm text-slate-600 font-normal cursor-pointer">
                      Do not limit leftovers
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="servings">Servings per Meal</Label>
                  <Input
                    id="servings"
                    type="number"
                    min="1"
                    max="12"
                    value={servingsPerMeal}
                    onChange={(e) => setServingsPerMeal(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-sm text-slate-600">
                    Number of servings to prepare for each meal
                  </p>
                </div>
              </div>

              {/* Dynamic Meals */}
              {hasMealComponents && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="enable-dynamic"
                      checked={enableDynamic}
                      onCheckedChange={setEnableDynamic}
                    />
                    <Label htmlFor="enable-dynamic" className="cursor-pointer">
                      Include Dynamic Meals
                    </Label>
                  </div>
                  <p className="text-sm text-slate-600">
                    Allow the AI to compose meals from your meal components (protein + veggie + starch + sauce) alongside traditional recipes
                  </p>
                  {enableDynamic && (
                    <div className="space-y-2">
                      <Label htmlFor="max-dynamic">Max Dynamic Meals per Week</Label>
                      <Input
                        id="max-dynamic"
                        type="number"
                        min="1"
                        max="14"
                        value={maxDynamic}
                        onChange={(e) => setMaxDynamic(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Set as Default button for meal settings */}
              {mealSettingsChanged && baselinePresetId && (
                <div className="flex justify-end pt-2 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDefaultMealSettings}
                    disabled={isSavingDefault}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingDefault ? 'Saving...' : 'Set as Default'}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Planning Rules (unified editor) */}
          <UnifiedRulesEditor mode="planning" />

          {/* Planning Guidelines */}
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Planning Guidelines</h3>
                <p className="text-sm text-slate-600">
                  Provide any specific requirements or preferences for meal planning
                </p>
              </div>
              <Textarea
                placeholder="Example goals: Low-carb, PCOS Friendly, Lots of Dark Leafy Greens (Kale, Spinach, Broccoli), Anti-inflammatory, Consider whole30 snacks and recipes. Add your own or edit as needed."
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                rows={4}
                className="resize-none"
              />
              {/* Set as Default button for guidelines */}
              {guidelinesChanged && baselinePresetId && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDefaultGuidelines}
                    disabled={isSavingDefault}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingDefault ? 'Saving...' : 'Set as Default'}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Guaranteed Meals */}
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Guaranteed Meals</h3>
                <p className="text-sm text-slate-600">
                  Select meals that must be included in the plan
                </p>
              </div>

              {/* Selected meals */}
              {guaranteedMeals.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {guaranteedMeals.map((meal) => (
                    <Badge key={meal.id} variant="secondary" className="px-3 py-2">
                      {meal.name}
                      <button
                        onClick={() => handleRemoveMeal(meal.id)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Search and add */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search meals to add..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {searchQuery && (
                  <ScrollArea className="h-[200px] rounded-md border border-slate-200">
                    <div className="p-2 space-y-1">
                      {filteredRecipes.length > 0 ? (
                        filteredRecipes.map((recipe) => (
                          <button
                            key={recipe.id}
                            onClick={() => handleAddMeal(recipe)}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 transition-colors text-left"
                          >
                            <div>
                              <div className="font-medium text-slate-900">{recipe.name}</div>
                              <div className="text-sm text-slate-600">
                                {recipe.categories?.join(', ') || 'Uncategorized'}
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-slate-400" />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-slate-600">
                          No meals found
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </Card>

          {/* Generate Button */}
          <div className="flex justify-between items-center">
            <Button
              onClick={() => setPresetDialogOpen(true)}
              variant="outline"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Preset
            </Button>
            <Button
              onClick={handleGenerate}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 px-8"
            >
              Generate meal plan
            </Button>
          </div>
        </div>

        <PresetDialog
          open={presetDialogOpen}
          onOpenChange={setPresetDialogOpen}
          currentValues={{
            maxLeftoversPerWeek: unlimitedLeftovers ? -1 : maxLeftovers,
            servingsPerMeal,
            guaranteedMealIds: guaranteedMeals.map(m => m.id),
            guidelines,
          }}
          onSave={handleSavePreset}
        />
      </div>
    </div>
  )
}
