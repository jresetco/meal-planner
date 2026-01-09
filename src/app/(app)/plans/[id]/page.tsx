'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ArrowLeft, 
  Lock, 
  Unlock, 
  RefreshCw, 
  MoreVertical, 
  ShoppingCart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Trash2
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { MealPlan, PlannedMeal, Recipe, MealType } from '@/types'

interface MealPlanWithMeals extends MealPlan {
  meals: (PlannedMeal & { recipe: Recipe })[]
}

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER']
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
}

export default function PlanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string
  
  const [plan, setPlan] = useState<MealPlanWithMeals | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  
  useEffect(() => {
    fetchPlan()
  }, [planId])
  
  async function fetchPlan() {
    try {
      const response = await fetch(`/api/plans/${planId}`)
      if (response.ok) {
        const data = await response.json()
        setPlan(data)
        // Set initial week view to the plan's start date
        if (data.startDate) {
          const start = new Date(data.startDate)
          // Adjust to start of the week (Monday)
          const day = start.getDay()
          const diff = day === 0 ? -6 : 1 - day
          start.setDate(start.getDate() + diff)
          setCurrentWeekStart(start)
        }
      } else {
        console.error('Failed to fetch plan')
      }
    } catch (error) {
      console.error('Error fetching plan:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleToggleLock = async (mealId: string, currentlyLocked: boolean) => {
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !currentlyLocked }),
      })
      if (response.ok) {
        fetchPlan() // Refresh
      }
    } catch (error) {
      console.error('Error toggling lock:', error)
    }
  }
  
  const handleSwapMeal = async (mealId: string) => {
    setIsRegenerating(true)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${mealId}/swap`, {
        method: 'POST',
      })
      if (response.ok) {
        fetchPlan() // Refresh
      }
    } catch (error) {
      console.error('Error swapping meal:', error)
    } finally {
      setIsRegenerating(false)
    }
  }
  
  const handleDeleteMeal = async (mealId: string) => {
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${mealId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchPlan() // Refresh
      }
    } catch (error) {
      console.error('Error deleting meal:', error)
    }
  }
  
  const handlePreviousWeek = () => {
    if (!currentWeekStart) return
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }
  
  const handleNextWeek = () => {
    if (!currentWeekStart) return
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }
  
  const getWeekDays = (): Date[] => {
    if (!currentWeekStart) return []
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart)
      day.setDate(day.getDate() + i)
      days.push(day)
    }
    return days
  }
  
  const getMealForSlot = (date: Date, mealType: MealType) => {
    if (!plan) return null
    const dateStr = date.toISOString().split('T')[0]
    return plan.meals.find(
      m => new Date(m.date).toISOString().split('T')[0] === dateStr && m.mealType === mealType
    )
  }
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: 21 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }
  
  if (!plan) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Plan not found</h2>
        <Button variant="outline" onClick={() => router.push('/plans')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Plans
        </Button>
      </div>
    )
  }
  
  const weekDays = getWeekDays()
  const planStartDate = new Date(plan.startDate)
  const planEndDate = new Date(plan.endDate)
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/plans')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Your Meal Plan</h1>
            <p className="text-muted-foreground">
              {formatDate(planStartDate)} - {formatDate(planEndDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/plans/${planId}/grocery-list`)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Grocery List
          </Button>
        </div>
      </div>
      
      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
        <Button variant="ghost" size="sm" onClick={handlePreviousWeek}>
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {weekDays[0] && formatDate(weekDays[0])} - {weekDays[6] && formatDate(weekDays[6])}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleNextWeek}>
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Meal Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Day Headers */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 mb-2">
            <div /> {/* Empty corner */}
            {weekDays.map((day) => {
              const isInRange = day >= planStartDate && day <= planEndDate
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "text-center py-2 rounded-lg",
                    isInRange ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"
                  )}
                >
                  <div className="text-xs uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-lg font-semibold">{day.getDate()}</div>
                </div>
              )
            })}
          </div>
          
          {/* Meal Rows */}
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 mb-2">
              <div className="flex items-center justify-end pr-4 text-sm font-medium text-muted-foreground">
                {MEAL_TYPE_LABELS[mealType]}
              </div>
              {weekDays.map((day) => {
                const meal = getMealForSlot(day, mealType)
                const isInRange = day >= planStartDate && day <= planEndDate
                
                if (!isInRange) {
                  return (
                    <div key={day.toISOString()} className="h-28 bg-slate-50 rounded-lg" />
                  )
                }
                
                if (!meal) {
                  return (
                    <div 
                      key={day.toISOString()} 
                      className="h-28 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400"
                    >
                      <Utensils className="h-5 w-5" />
                    </div>
                  )
                }
                
                return (
                  <Card 
                    key={day.toISOString()} 
                    className={cn(
                      "h-28 overflow-hidden transition-all hover:shadow-md",
                      meal.isLocked && "ring-2 ring-emerald-500"
                    )}
                  >
                    <CardContent className="p-3 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-medium line-clamp-2 flex-1">
                          {meal.recipe.name}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleToggleLock(meal.id, meal.isLocked ?? false)}
                            >
                              {meal.isLocked ? (
                                <>
                                  <Unlock className="mr-2 h-4 w-4" />
                                  Unlock
                                </>
                              ) : (
                                <>
                                  <Lock className="mr-2 h-4 w-4" />
                                  Lock
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleSwapMeal(meal.id)}
                              disabled={isRegenerating}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Swap Recipe
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteMeal(meal.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-auto flex items-center gap-2">
                        {meal.isLocked && (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                            <Lock className="mr-1 h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                        {meal.isLeftover && (
                          <Badge variant="outline" className="text-xs">
                            Leftover
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {plan.meals.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Meals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {plan.meals.filter(m => m.isLocked).length}
              </div>
              <div className="text-sm text-muted-foreground">Locked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {plan.meals.filter(m => m.isLeftover).length}
              </div>
              <div className="text-sm text-muted-foreground">Leftovers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {new Set(plan.meals.map(m => m.recipeId)).size}
              </div>
              <div className="text-sm text-muted-foreground">Unique Recipes</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
