'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UnifiedRulesEditor } from '@/components/shared/unified-rules-editor'
import { HistoricalUpload } from '@/components/settings/historical-upload'
import {
  ChefHat,
  ShoppingCart,
  Clock,
  Plus,
  X,
  Save,
  RefreshCw
} from 'lucide-react'
import type { PantryStaple, HistoricalPlan } from '@/types'

interface MealSettings {
  paprikaEmail: string | null
  paprikaPassword: string | null
  paprikaCategories: string[]
  paprikaMinRating: number | null
  paprikaLastSync: string | null
  defaultServings: number
  breakfastTime: string
  lunchTime: string
  dinnerTime: string
}

export default function SettingsPage() {
  const [staples, setStaples] = useState<PantryStaple[]>([])
  const [historicalPlans, setHistoricalPlans] = useState<HistoricalPlan[]>([])
  const [newStaple, setNewStaple] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  
  // Meal settings
  const [mealSettings, setMealSettings] = useState<MealSettings>({
    paprikaEmail: '',
    paprikaPassword: '',
    paprikaCategories: [],
    paprikaMinRating: 0,
    paprikaLastSync: null,
    defaultServings: 2,
    breakfastTime: '08:00',
    lunchTime: '12:00',
    dinnerTime: '18:00',
  })
  const [newCategory, setNewCategory] = useState('')
  const [availableCategories, setAvailableCategories] = useState<{ uid: string; name: string }[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [settingsRes, staplesRes, historicalRes] = await Promise.all([
        fetch('/api/settings/meal'),
        fetch('/api/settings/staples'),
        fetch('/api/settings/historical'),
      ])
      
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setMealSettings({
          paprikaEmail: data.paprikaEmail || '',
          paprikaPassword: data.paprikaPassword || '',
          paprikaCategories: data.paprikaCategories || [],
          paprikaMinRating: data.paprikaMinRating ?? 0,
          paprikaLastSync: data.paprikaLastSync,
          defaultServings: data.defaultServings || 2,
          breakfastTime: data.breakfastTime || '08:00',
          lunchTime: data.lunchTime || '12:00',
          dinnerTime: data.dinnerTime || '18:00',
        })
      }
      
      if (staplesRes.ok) {
        const staplesData = await staplesRes.json()
        setStaples(staplesData)
      }

      if (historicalRes.ok) {
        const historicalData = await historicalRes.json()
        setHistoricalPlans(historicalData)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleHistoricalUpload = () => {
    // Refresh historical plans after upload
    fetchData()
  }

  const handleSavePaprikaSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings/meal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paprikaEmail: mealSettings.paprikaEmail,
          paprikaPassword: mealSettings.paprikaPassword,
          paprikaCategories: mealSettings.paprikaCategories,
          paprikaMinRating: mealSettings.paprikaMinRating ?? 0,
        }),
      })
      
      if (response.ok) {
        alert('Paprika settings saved successfully!')
      } else {
        alert('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSyncPaprika = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/recipes/sync-paprika', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (response.ok) {
        let msg = data.debug?.afterFilters === 0 && data.debug?.fetchedFromApi > 0
          ? `${data.message}\n\nDebug: ${data.debug.fetchedFromApi} recipes from Paprika, 0 after filters. Check rating (3+ stars) and category filter.`
          : data.message
        const created = data.createdRecipes as { name: string; paprikaId: string }[] | undefined
        const updated = data.updatedRecipes as { name: string; paprikaId: string }[] | undefined
        if (created?.length) {
          msg += `\n\nCreated (${created.length}):\n${created.map((r) => `• ${r.name}`).join('\n')}`
        }
        if (updated?.length) {
          msg += `\n\nUpdated (${updated.length}):\n${updated.map((r) => `• ${r.name}`).join('\n')}`
        }
        alert(msg)
        // Refresh last sync time
        const settingsRes = await fetch('/api/settings/meal')
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          setMealSettings(prev => ({
            ...prev,
            paprikaLastSync: settingsData.paprikaLastSync,
          }))
        }
      } else {
        alert(data.error || 'Failed to sync recipes')
      }
    } catch (error) {
      console.error('Error syncing recipes:', error)
      alert('Failed to sync recipes')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAddCategory = () => {
    if (!newCategory.trim() || mealSettings.paprikaCategories.includes(newCategory.trim())) {
      return
    }
    setMealSettings(prev => ({
      ...prev,
      paprikaCategories: [...prev.paprikaCategories, newCategory.trim()],
    }))
    setNewCategory('')
  }

  const handleFetchPaprikaCategories = async () => {
    setIsLoadingCategories(true)
    try {
      const response = await fetch('/api/recipes/paprika-categories')
      if (response.ok) {
        const data = await response.json()
        setAvailableCategories(data.categories || [])
      } else {
        const err = await response.json()
        alert(err.error || 'Failed to fetch categories')
      }
    } catch (error) {
      console.error('Fetch categories failed:', error)
      alert('Failed to fetch categories from Paprika')
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const handleAddCategoryFromList = (name: string) => {
    if (!name.trim() || mealSettings.paprikaCategories.includes(name.trim())) return
    setMealSettings((prev) => ({
      ...prev,
      paprikaCategories: [...prev.paprikaCategories, name.trim()],
    }))
  }

  const handleRemoveCategory = (category: string) => {
    setMealSettings(prev => ({
      ...prev,
      paprikaCategories: prev.paprikaCategories.filter(c => c !== category),
    }))
  }

  const handleSaveMealSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings/meal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultServings: mealSettings.defaultServings,
          breakfastTime: mealSettings.breakfastTime,
          lunchTime: mealSettings.lunchTime,
          dinnerTime: mealSettings.dinnerTime,
        }),
      })
      
      if (response.ok) {
        alert('Meal settings saved successfully!')
      } else {
        alert('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddStaple = async () => {
    if (!newStaple.trim()) return
    
    try {
      const response = await fetch('/api/settings/staples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientName: newStaple.toLowerCase().trim() }),
      })
      
      if (response.ok) {
        const staple = await response.json()
        setStaples([...staples, staple])
        setNewStaple('')
      }
    } catch (error) {
      console.error('Error adding staple:', error)
    }
  }

  const handleRemoveStaple = async (stapleId: string) => {
    try {
      const response = await fetch(`/api/settings/staples/${stapleId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setStaples(staples.filter((s) => s.id !== stapleId))
      }
    } catch (error) {
      console.error('Error removing staple:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your meal planning preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Paprika Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Paprika Integration
            </CardTitle>
            <CardDescription>
              Connect to Paprika 3 to sync your recipes (3+ star ratings only)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Paprika Email</label>
              <Input
                type="email"
                value={mealSettings.paprikaEmail || ''}
                onChange={(e) => setMealSettings(prev => ({ ...prev, paprikaEmail: e.target.value }))}
                placeholder="your-email@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Paprika Password</label>
              <Input
                type="password"
                value={mealSettings.paprikaPassword || ''}
                onChange={(e) => setMealSettings(prev => ({ ...prev, paprikaPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            
            {/* Min Rating */}
            <div>
              <label className="text-sm font-medium">Minimum Star Rating</label>
              <p className="text-xs text-muted-foreground mb-2">
                Only sync recipes rated this many stars or higher. Use 0 to sync all recipes (including unrated).
              </p>
              <Input
                type="number"
                min={0}
                max={5}
                value={mealSettings.paprikaMinRating ?? 0}
                onChange={(e) => setMealSettings(prev => ({ ...prev, paprikaMinRating: parseInt(e.target.value) || 0 }))}
              />
            </div>
            
            {/* Category Filtering */}
            <div>
              <label className="text-sm font-medium">Category Filter (Optional)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Only sync recipes in these categories. Leave empty to sync all.
              </p>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchPaprikaCategories}
                  disabled={isLoadingCategories || !mealSettings.paprikaEmail || !mealSettings.paprikaPassword}
                >
                  {isLoadingCategories ? 'Loading...' : 'Load categories from Paprika'}
                </Button>
              </div>
              {availableCategories.length > 0 && (
                <div className="mb-3 p-3 rounded-lg border bg-muted/30 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium mb-2">Available categories (click to add):</p>
                  <div className="flex flex-wrap gap-1">
                    {availableCategories.map((cat) => (
                      <Badge
                        key={cat.uid}
                        variant={mealSettings.paprikaCategories.includes(cat.name) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => handleAddCategoryFromList(cat.name)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategoryFromList(cat.name)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Add ${cat.name} to filter`}
                      >
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Or type category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button onClick={handleAddCategory} disabled={!newCategory.trim()} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {mealSettings.paprikaCategories.map((category) => (
                  <Badge key={category} variant="secondary" className="px-2 py-1">
                    {category}
                    <button
                      type="button"
                      className="ml-1 hover:text-red-600"
                      onClick={() => handleRemoveCategory(category)}
                      aria-label={`Remove ${category}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            
            {mealSettings.paprikaLastSync && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(mealSettings.paprikaLastSync).toLocaleString()}
              </p>
            )}
            
            <div className="flex gap-2">
              <Button onClick={handleSavePaprikaSettings} disabled={isSaving} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button 
                onClick={handleSyncPaprika} 
                disabled={isSyncing || !mealSettings.paprikaEmail || !mealSettings.paprikaPassword}
                variant="outline"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Meal Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Default Meal Times
            </CardTitle>
            <CardDescription>
              Set default times for calendar events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Default Servings</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={mealSettings.defaultServings}
                onChange={(e) => setMealSettings(prev => ({ ...prev, defaultServings: parseInt(e.target.value) || 2 }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">Breakfast</label>
                <Input
                  type="time"
                  value={mealSettings.breakfastTime}
                  onChange={(e) => setMealSettings(prev => ({ ...prev, breakfastTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Lunch</label>
                <Input
                  type="time"
                  value={mealSettings.lunchTime}
                  onChange={(e) => setMealSettings(prev => ({ ...prev, lunchTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Dinner</label>
                <Input
                  type="time"
                  value={mealSettings.dinnerTime}
                  onChange={(e) => setMealSettings(prev => ({ ...prev, dinnerTime: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={handleSaveMealSettings} disabled={isSaving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Historical Data Upload */}
      <HistoricalUpload 
        historicalPlans={historicalPlans}
        onUpload={handleHistoricalUpload}
      />

      {/* Rules (System + Personal) */}
      <UnifiedRulesEditor mode="full" />

      {/* Pantry Staples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pantry Staples
          </CardTitle>
          <CardDescription>
            Ingredients that are always in your pantry and will be excluded from grocery lists
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., salt, olive oil, pepper"
              value={newStaple}
              onChange={(e) => setNewStaple(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddStaple()}
            />
            <Button onClick={handleAddStaple} disabled={!newStaple.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {staples.map((staple) => (
              <Badge
                key={staple.id}
                variant="secondary"
                className="pl-3 pr-1 py-1 flex items-center gap-1"
              >
                {staple.ingredientName}
                <button
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                  onClick={() => handleRemoveStaple(staple.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {staples.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No pantry staples yet. Add items like salt, oil, and common spices.
            </p>
          )}

          {/* Common suggestions */}
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Quick add:</p>
            <div className="flex flex-wrap gap-2">
              {['salt', 'pepper', 'olive oil', 'butter', 'garlic', 'onion'].map((item) => (
                <Button
                  key={item}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewStaple(item)
                    handleAddStaple()
                  }}
                  disabled={staples.some((s) => s.ingredientName === item)}
                >
                  + {item}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
