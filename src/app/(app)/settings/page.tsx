'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { RulesEditor } from '@/components/settings/rules-editor'
import { 
  Settings as SettingsIcon, 
  ChefHat, 
  ShoppingCart, 
  Clock,
  Plus,
  X,
  Save,
  RefreshCw
} from 'lucide-react'
import type { SoftRule, PantryStaple } from '@/types'

interface MealSettings {
  paprikaEmail: string | null
  paprikaPassword: string | null
  paprikaCategories: string[]
  paprikaLastSync: string | null
  defaultServings: number
  breakfastTime: string
  lunchTime: string
  dinnerTime: string
}

export default function SettingsPage() {
  const [rules, setRules] = useState<SoftRule[]>([])
  const [staples, setStaples] = useState<PantryStaple[]>([])
  const [newStaple, setNewStaple] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  
  // Meal settings
  const [mealSettings, setMealSettings] = useState<MealSettings>({
    paprikaEmail: '',
    paprikaPassword: '',
    paprikaCategories: [],
    paprikaLastSync: null,
    defaultServings: 2,
    breakfastTime: '08:00',
    lunchTime: '12:00',
    dinnerTime: '18:00',
  })
  const [newCategory, setNewCategory] = useState('')

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [settingsRes, rulesRes, staplesRes] = await Promise.all([
          fetch('/api/settings/meal'),
          fetch('/api/settings/rules'),
          fetch('/api/settings/staples'),
        ])
        
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          setMealSettings({
            paprikaEmail: data.paprikaEmail || '',
            paprikaPassword: data.paprikaPassword || '',
            paprikaCategories: data.paprikaCategories || [],
            paprikaLastSync: data.paprikaLastSync,
            defaultServings: data.defaultServings || 2,
            breakfastTime: data.breakfastTime || '08:00',
            lunchTime: data.lunchTime || '12:00',
            dinnerTime: data.dinnerTime || '18:00',
          })
        }
        
        if (rulesRes.ok) {
          const rulesData = await rulesRes.json()
          setRules(rulesData)
        }
        
        if (staplesRes.ok) {
          const staplesData = await staplesRes.json()
          setStaples(staplesData)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [])

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
        alert(`${data.message}`)
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

  const handleAddRule = async (ruleText: string, isHardRule: boolean) => {
    try {
      const response = await fetch('/api/settings/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleText, isHardRule }),
      })
      
      if (response.ok) {
        const newRule = await response.json()
        setRules([...rules, newRule])
      }
    } catch (error) {
      console.error('Error adding rule:', error)
    }
  }

  const handleUpdateRule = async (ruleId: string, updates: Partial<SoftRule>) => {
    try {
      const response = await fetch(`/api/settings/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      if (response.ok) {
        const updatedRule = await response.json()
        setRules(rules.map((r) => (r.id === ruleId ? updatedRule : r)))
      }
    } catch (error) {
      console.error('Error updating rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/settings/rules/${ruleId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setRules(rules.filter((r) => r.id !== ruleId))
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/settings/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      
      if (response.ok) {
        setRules(rules.map((r) => (r.id === ruleId ? { ...r, isActive } : r)))
      }
    } catch (error) {
      console.error('Error toggling rule:', error)
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
            
            {/* Category Filtering */}
            <div>
              <label className="text-sm font-medium">Category Filter (Optional)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Only sync recipes with these categories. Leave empty to sync all 3+ star recipes.
              </p>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="e.g., Dinner, Quick, Weeknight"
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
                      className="ml-1 hover:text-red-600"
                      onClick={() => handleRemoveCategory(category)}
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

      {/* Soft Rules */}
      <RulesEditor
        rules={rules}
        onAddRule={handleAddRule}
        onUpdateRule={handleUpdateRule}
        onDeleteRule={handleDeleteRule}
        onToggleRule={handleToggleRule}
      />

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
