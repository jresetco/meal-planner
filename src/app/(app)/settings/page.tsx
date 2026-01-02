'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { RulesEditor } from '@/components/settings/rules-editor'
import { 
  Settings as SettingsIcon, 
  ChefHat, 
  ShoppingCart, 
  Clock,
  Plus,
  X,
  Save
} from 'lucide-react'
import type { SoftRule, PantryStaple } from '@/types'

export default function SettingsPage() {
  // Mock data - in real app, fetch from API
  const [rules, setRules] = useState<SoftRule[]>([])
  const [staples, setStaples] = useState<PantryStaple[]>([])
  const [newStaple, setNewStaple] = useState('')
  
  // Paprika settings
  const [paprikaEmail, setPaprikaEmail] = useState('')
  const [paprikaPassword, setPaprikaPassword] = useState('')
  
  // Meal settings
  const [defaultServings, setDefaultServings] = useState(2)
  const [breakfastTime, setBreakfastTime] = useState('08:00')
  const [lunchTime, setLunchTime] = useState('12:00')
  const [dinnerTime, setDinnerTime] = useState('18:00')

  const handleAddRule = async (ruleText: string) => {
    const newRule: SoftRule = {
      id: crypto.randomUUID(),
      householdId: '',
      ruleText,
      isActive: true,
      priority: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setRules([...rules, newRule])
    
    // In real app, POST to /api/settings/rules
  }

  const handleDeleteRule = async (ruleId: string) => {
    setRules(rules.filter((r) => r.id !== ruleId))
    // In real app, DELETE to /api/settings/rules/[id]
  }

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    setRules(rules.map((r) => (r.id === ruleId ? { ...r, isActive } : r)))
    // In real app, PUT to /api/settings/rules/[id]
  }

  const handleAddStaple = async () => {
    if (!newStaple.trim()) return
    
    const staple: PantryStaple = {
      id: crypto.randomUUID(),
      householdId: '',
      ingredientName: newStaple.toLowerCase().trim(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setStaples([...staples, staple])
    setNewStaple('')
    
    // In real app, POST to /api/settings/staples
  }

  const handleRemoveStaple = async (stapleId: string) => {
    setStaples(staples.filter((s) => s.id !== stapleId))
    // In real app, DELETE to /api/settings/staples
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
              Connect to Paprika 3 to sync your recipes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Paprika Email</label>
              <Input
                type="email"
                value={paprikaEmail}
                onChange={(e) => setPaprikaEmail(e.target.value)}
                placeholder="your-email@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Paprika Password</label>
              <Input
                type="password"
                value={paprikaPassword}
                onChange={(e) => setPaprikaPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save & Test Connection
            </Button>
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
                value={defaultServings}
                onChange={(e) => setDefaultServings(parseInt(e.target.value) || 2)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">Breakfast</label>
                <Input
                  type="time"
                  value={breakfastTime}
                  onChange={(e) => setBreakfastTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Lunch</label>
                <Input
                  type="time"
                  value={lunchTime}
                  onChange={(e) => setLunchTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Dinner</label>
                <Input
                  type="time"
                  value={dinnerTime}
                  onChange={(e) => setDinnerTime(e.target.value)}
                />
              </div>
            </div>
            <Button className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Soft Rules */}
      <RulesEditor
        rules={rules}
        onAddRule={handleAddRule}
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
