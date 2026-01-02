'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  ChefHat, 
  Sparkles, 
  Loader2,
  Check,
  X
} from 'lucide-react'

export default function NewPlanPage() {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [step, setStep] = useState(1)
  
  // Form state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [enabledMeals, setEnabledMeals] = useState({
    breakfast: true,
    lunch: true,
    dinner: true,
  })
  const [maxRepeats, setMaxRepeats] = useState(2)

  const handleGenerate = async () => {
    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          enabledMeals,
          maxRepeats,
          pinnedMeals: [],
          skippedMeals: [],
        }),
      })

      if (response.ok) {
        const plan = await response.json()
        router.push(`/plans/${plan.id}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to generate plan')
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      alert('Failed to generate plan')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generate New Plan</h1>
        <p className="text-muted-foreground">
          Configure your preferences and let AI create the perfect meal plan
        </p>
      </div>

      {/* Step 1: Date Range */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Dates
          </CardTitle>
          <CardDescription>
            Choose the date range for your meal plan (up to 4 weeks)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Meal Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Meal Settings
          </CardTitle>
          <CardDescription>
            Configure which meals to plan and constraints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enabled meals */}
          <div>
            <label className="text-sm font-medium mb-3 block">Meals to Plan</label>
            <div className="flex gap-2">
              {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
                <Button
                  key={meal}
                  variant={enabledMeals[meal] ? 'default' : 'outline'}
                  onClick={() =>
                    setEnabledMeals((prev) => ({
                      ...prev,
                      [meal]: !prev[meal],
                    }))
                  }
                >
                  {enabledMeals[meal] ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  {meal.charAt(0).toUpperCase() + meal.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Max repeats */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Maximum Meal Repeats (including leftovers)
            </label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={10}
                value={maxRepeats}
                onChange={(e) => setMaxRepeats(parseInt(e.target.value) || 2)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                times per planning period
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Ready to generate?</h3>
              <p className="text-sm text-muted-foreground">
                AI will create a personalized meal plan based on your preferences
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!startDate || !endDate || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Plan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
