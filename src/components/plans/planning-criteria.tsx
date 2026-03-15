'use client'

import { useState, useEffect } from 'react'
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
import { ChevronLeft, Search, X, Plus, Save } from 'lucide-react'
import { PresetDialog } from './preset-dialog'
import type { Recipe, BaselinePreset, SoftRule } from '@/types'

export interface PlanningCriteriaData {
  baselinePresetId?: string
  maxLeftoversPerWeek: number
  servingsPerMeal: number
  guaranteedMeals: Pick<Recipe, 'id' | 'name'>[]
  guidelines?: string
}

interface PlanningCriteriaProps {
  presets: BaselinePreset[]
  recipes: Pick<Recipe, 'id' | 'name' | 'categories'>[]
  softRules: Pick<SoftRule, 'id' | 'ruleText' | 'isActive'>[]
  initialData?: PlanningCriteriaData
  onGenerate: (criteria: PlanningCriteriaData) => void
  onBack: () => void
}

export function PlanningCriteria({ 
  presets,
  recipes,
  softRules,
  initialData,
  onGenerate, 
  onBack 
}: PlanningCriteriaProps) {
  const [baselinePresetId, setBaselinePresetId] = useState(initialData?.baselinePresetId || '')
  const [maxLeftovers, setMaxLeftovers] = useState(initialData?.maxLeftoversPerWeek || 3)
  const [servingsPerMeal, setServingsPerMeal] = useState(initialData?.servingsPerMeal || 4)
  const [guaranteedMeals, setGuaranteedMeals] = useState<Pick<Recipe, 'id' | 'name'>[]>(
    initialData?.guaranteedMeals || []
  )
  const [guidelines, setGuidelines] = useState(initialData?.guidelines || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  
  const handlePresetChange = (value: string) => {
    setBaselinePresetId(value)
    const preset = presets.find(p => p.id === value)
    if (preset) {
      setMaxLeftovers(preset.maxLeftovers)
      setServingsPerMeal(preset.servingsPerMeal)
      setGuidelines(preset.guidelines || '')
      // Load guaranteed meals from preset
      const meals = recipes.filter(r => preset.guaranteedMealIds.includes(r.id))
      setGuaranteedMeals(meals.map(m => ({ id: m.id, name: m.name })))
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
    
    // Reload presets if parent provides a way, or just close dialog
    // In a real app, we'd refresh the presets list here
  }
  
  const handleGenerate = () => {
    onGenerate({
      baselinePresetId: baselinePresetId || undefined,
      maxLeftoversPerWeek: maxLeftovers,
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

  const activeRules = softRules.filter(r => r.isActive)

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
          
          {/* Numeric Settings */}
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
                  />
                  <p className="text-sm text-slate-600">
                    Maximum number of leftover meals allowed per week
                  </p>
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
            </div>
          </Card>

          {/* Active Soft Rules */}
          {activeRules.length > 0 && (
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Active Planning Rules</h3>
                  <p className="text-sm text-slate-600">
                    These rules will be applied during plan generation
                  </p>
                </div>
                <div className="space-y-2">
                  {activeRules.map((rule) => (
                    <div 
                      key={rule.id}
                      className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-sm text-slate-700">{rule.ruleText}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
          
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
            maxLeftoversPerWeek: maxLeftovers,
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
