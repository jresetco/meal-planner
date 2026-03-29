'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ArrowLeft, 
  Lock, 
  LockOpen, 
  RefreshCw, 
  MoreVertical, 
  ShoppingCart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Trash2,
  Sparkles,
  Search,
  Loader2,
  Check,
  ArrowRightLeft,
  StickyNote,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatDate } from '@/lib/utils'
import { getServingDisplay } from '@/lib/plan-servings-display'
import { isSlotAfter, ymd } from '@/lib/plan-meal-slots'
import type { MealPlan, PlannedMeal, Recipe, MealType } from '@/types'
import { RecipeMealHover } from '@/components/plans/recipe-meal-hover'

interface MealWithRecipe extends PlannedMeal {
  preparedServings?: number | null
  leftoverSourceId?: string | null
  recipe: Pick<
    Recipe,
    | 'id'
    | 'name'
    | 'imageUrl'
    | 'ingredients'
    | 'instructions'
    | 'description'
    | 'servings'
  > | null
}

interface MealPlanWithMeals extends MealPlan {
  plannedMeals: MealWithRecipe[]
  dayNotes?: Record<string, string> | null
}

interface SwapSuggestion {
  recipeId: string
  recipeName: string
  reasoning: string
}

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER']
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
}
const MEAL_TYPE_ICONS: Record<MealType, string> = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  DINNER: '🌙',
}

export default function PlanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string
  
  const [plan, setPlan] = useState<MealPlanWithMeals | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null)
  
  // Swap dialog state
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [swapMeal, setSwapMeal] = useState<MealWithRecipe | null>(null)
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [swapSearch, setSwapSearch] = useState('')
  const [manualMealName, setManualMealName] = useState('')
  const [recipes, setRecipes] = useState<Pick<Recipe, 'id' | 'name'>[]>([])
  
  // Operation states
  const [regeneratingMealId, setRegeneratingMealId] = useState<string | null>(null)
  const [regeneratingDay, setRegeneratingDay] = useState<string | null>(null)
  const [regeneratingPlan, setRegeneratingPlan] = useState(false)
  
  useEffect(() => {
    fetchPlan()
    fetchRecipes()
  }, [planId])
  
  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/plans/${planId}`)
      if (response.ok) {
        const data = await response.json()
        setPlan(data)
        // Set initial week view to the plan's start date
        if (data.startDate) {
          const start = new Date(data.startDate)
          // Adjust to start of the week (Sunday)
          const day = start.getDay()
          start.setDate(start.getDate() - day)
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

  const fetchRecipes = async () => {
    try {
      const response = await fetch('/api/recipes')
      if (response.ok) {
        const data = await response.json()
        setRecipes(data.map((r: Recipe) => ({ id: r.id, name: r.name })))
      }
    } catch (error) {
      console.error('Error fetching recipes:', error)
    }
  }
  
  const handleToggleLock = async (meal: MealWithRecipe) => {
    const newLocked = meal.isLocked !== true
    // Optimistic update - immediately reflect in UI
    setPlan(prev => {
      if (!prev) return prev
      return {
        ...prev,
        plannedMeals: prev.plannedMeals.map(m =>
          m.id === meal.id ? { ...m, isLocked: newLocked } : m
        ),
      }
    })
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: newLocked }),
      })
      if (!response.ok) {
        // Revert on failure
        setPlan(prev => {
          if (!prev) return prev
          return {
            ...prev,
            plannedMeals: prev.plannedMeals.map(m =>
              m.id === meal.id ? { ...m, isLocked: !newLocked } : m
            ),
          }
        })
      }
    } catch (error) {
      console.error('Error toggling lock:', error)
      // Revert on error
      setPlan(prev => {
        if (!prev) return prev
        return {
          ...prev,
          plannedMeals: prev.plannedMeals.map(m =>
            m.id === meal.id ? { ...m, isLocked: !newLocked } : m
          ),
        }
      })
    }
  }
  
  const handleOpenSwapDialog = async (meal: MealWithRecipe) => {
    setSwapMeal(meal)
    setSwapDialogOpen(true)
    setSwapSuggestions([])
    setSwapSearch('')
    setManualMealName('')
    
    // Get AI suggestions
    setIsLoadingSuggestions(true)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${meal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const data = await response.json()
        setSwapSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Error getting suggestions:', error)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }
  
  const handleSwapToRecipe = async (recipeId: string, targetMeal?: MealWithRecipe | null) => {
    const target = targetMeal ?? swapMeal
    if (!target) return

    setRegeneratingMealId(target.id)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${target.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId }),
      })
      if (response.ok) {
        setSwapDialogOpen(false)
        fetchPlan()
      }
    } catch (error) {
      console.error('Error swapping meal:', error)
    } finally {
      setRegeneratingMealId(null)
    }
  }

  const handleSwapToLeftoverFrom = async (sourceMealId: string) => {
    if (!swapMeal) return
    setRegeneratingMealId(swapMeal.id)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${swapMeal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftoverSourceMealId: sourceMealId }),
      })
      if (response.ok) {
        setSwapDialogOpen(false)
        fetchPlan()
      }
    } catch (error) {
      console.error('Error applying leftover:', error)
    } finally {
      setRegeneratingMealId(null)
    }
  }

  const handleSwapToManualName = async () => {
    if (!swapMeal) return
    const name = manualMealName.trim()
    if (!name) return

    setRegeneratingMealId(swapMeal.id)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${swapMeal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customName: name }),
      })
      if (response.ok) {
        setSwapDialogOpen(false)
        setManualMealName('')
        fetchPlan()
      }
    } catch (error) {
      console.error('Error setting custom meal:', error)
    } finally {
      setRegeneratingMealId(null)
    }
  }
  
  const handleRegenerateMeal = async (meal: MealWithRecipe) => {
    setRegeneratingMealId(meal.id)
    try {
      // For single meal regeneration, we use the swap endpoint without specifying a recipe
      // to get AI suggestions, then auto-select the first one
      const response = await fetch(`/api/plans/${planId}/meals/${meal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.suggestions && data.suggestions.length > 0) {
          await handleSwapToRecipe(data.suggestions[0].recipeId, meal)
        }
      }
    } catch (error) {
      console.error('Error regenerating meal:', error)
    } finally {
      setRegeneratingMealId(null)
    }
  }

  const handleRegenerateDay = async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    setRegeneratingDay(dateStr)
    try {
      const response = await fetch(`/api/plans/${planId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      })
      if (response.ok) {
        fetchPlan()
      }
    } catch (error) {
      console.error('Error regenerating day:', error)
    } finally {
      setRegeneratingDay(null)
    }
  }

  const handleRegeneratePlan = async () => {
    if (!confirm('This will regenerate all unlocked meals. Are you sure?')) return
    
    setRegeneratingPlan(true)
    try {
      const response = await fetch(`/api/plans/${planId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        fetchPlan()
      }
    } catch (error) {
      console.error('Error regenerating plan:', error)
    } finally {
      setRegeneratingPlan(false)
    }
  }
  
  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm('Remove this meal from the plan?')) return
    
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${mealId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchPlan()
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
    return plan.plannedMeals.find(
      m => new Date(m.date).toISOString().split('T')[0] === dateStr && m.mealType === mealType
    )
  }

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(swapSearch.toLowerCase())
  )

  const leftoverSourceOptions = useMemo(() => {
    if (!plan || !swapMeal) return []
    const tDate = ymd(new Date(swapMeal.date))
    return plan.plannedMeals.filter((m) => {
      if (m.isLeftover || m.id === swapMeal.id) return false
      const sDate = ymd(new Date(m.date))
      if (!isSlotAfter(sDate, m.mealType as MealType, tDate, swapMeal.mealType as MealType)) {
        return false
      }
      if (
        m.recipeId &&
        plan.plannedMeals.some(
          (o) =>
            o.id !== swapMeal.id &&
            o.recipeId === m.recipeId &&
            ymd(new Date(o.date)) === tDate
        )
      ) {
        return false
      }
      return true
    })
  }, [plan, swapMeal])

  const servingFieldList = useMemo(() => {
    if (!plan) return []
    return plan.plannedMeals.map((m) => ({
      id: m.id,
      isLeftover: m.isLeftover,
      leftoverSourceId: m.leftoverSourceId ?? null,
      preparedServings: m.preparedServings ?? null,
      servings: m.servings,
    }))
  }, [plan])

  /** Day notes are stored on the MealPlan as a JSON map keyed by date string. */
  const handleDayNotesBlur = async (dateStr: string, value: string) => {
    const next = value.trim()
    const current = ((plan?.dayNotes as Record<string, string>) ?? {})[dateStr] ?? ''
    if (current.trim() === next) return
    // Optimistic update
    setPlan(prev => {
      if (!prev) return prev
      const notes = { ...(prev.dayNotes as Record<string, string> ?? {}) }
      if (next.length > 0) {
        notes[dateStr] = next
      } else {
        delete notes[dateStr]
      }
      return { ...prev, dayNotes: Object.keys(notes).length > 0 ? notes : null }
    })
    try {
      await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayNotes: { [dateStr]: next } }),
      })
    } catch (error) {
      console.error('Error saving notes:', error)
    }
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
  const lockedCount = plan.plannedMeals.filter(m => m.isLocked).length
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleRegeneratePlan}
            disabled={regeneratingPlan}
          >
            {regeneratingPlan ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {regeneratingPlan ? 'Regenerating...' : 'Regenerate Plan'}
          </Button>
          <Button variant="outline" asChild>
            <Link
              href={`/plans/${planId}/grocery-list`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Grocery List
            </Link>
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
              const dow = day.getDay()
              const isWeekend = dow === 0 || dow === 6
              const dateStr = day.toISOString().split('T')[0]
              const isRegenerating = regeneratingDay === dateStr
              const dayMeals = plan.plannedMeals.filter(
                m => new Date(m.date).toISOString().split('T')[0] === dateStr
              )
              const hasLockedMeals = dayMeals.some(m => m.isLocked)
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "text-center py-2 rounded-lg relative",
                    isInRange && isWeekend && "bg-violet-50 text-violet-800 border border-violet-100",
                    isInRange && !isWeekend && "bg-emerald-50 text-emerald-700",
                    !isInRange && "bg-slate-50 text-slate-400"
                  )}
                >
                  <div className="text-xs uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-lg font-semibold">{day.getDate()}</div>
                  {isInRange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-6 px-2 text-xs opacity-0 hover:opacity-100 transition-opacity"
                      onClick={() => handleRegenerateDay(day)}
                      disabled={isRegenerating}
                      title={hasLockedMeals ? "Regenerate day (locked meals will be kept)" : "Regenerate day"}
                    >
                      {isRegenerating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Meal Rows */}
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 mb-2">
              <div className="flex items-center justify-end pr-4 text-sm font-medium text-muted-foreground">
                <span className="mr-2">{MEAL_TYPE_ICONS[mealType]}</span>
                {MEAL_TYPE_LABELS[mealType]}
              </div>
              {weekDays.map((day) => {
                const meal = getMealForSlot(day, mealType)
                const isInRange = day >= planStartDate && day <= planEndDate
                
                if (!isInRange) {
                  return (
                    <div key={day.toISOString()} className="min-h-28 bg-slate-50 rounded-lg" />
                  )
                }
                
                if (!meal) {
                  return (
                    <div 
                      key={day.toISOString()} 
                      className="min-h-28 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400"
                    >
                      <Utensils className="h-5 w-5" />
                    </div>
                  )
                }
                
                const isRegenerating = regeneratingMealId === meal.id
                const mealName = meal.recipe?.name || meal.customName || 'Unknown'
                const servingLabel = getServingDisplay(
                  {
                    id: meal.id,
                    isLeftover: meal.isLeftover,
                    leftoverSourceId: meal.leftoverSourceId ?? null,
                    preparedServings: meal.preparedServings ?? null,
                    servings: meal.servings,
                  },
                  servingFieldList
                )
                
                return (
                  <Card 
                    key={day.toISOString()} 
                    className={cn(
                      "min-h-28 transition-all hover:shadow-md group",
                      meal.isLocked && "ring-2 ring-emerald-500 bg-emerald-50/50"
                    )}
                  >
                    <CardContent className="p-2 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-1">
                        <RecipeMealHover
                          recipe={meal.recipe}
                          mealName={mealName}
                          triggerClassName="text-sm font-medium flex-1 break-words text-pretty"
                        >
                          {meal.isLeftover && <span className="text-orange-600">LO: </span>}
                          {mealName}
                        </RecipeMealHover>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {/* Lock button - always visible */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-6 w-6 transition-opacity",
                              meal.isLocked === true
                                ? "text-emerald-600 opacity-100" 
                                : "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={() => handleToggleLock(meal)}
                            title={meal.isLocked === true ? "Unlock meal" : "Lock meal"}
                          >
                            {meal.isLocked === true ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <LockOpen className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          
                          {/* Refresh button - visible on hover */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleOpenSwapDialog(meal)}
                            disabled={isRegenerating}
                            title="Swap recipe"
                          >
                            {isRegenerating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          
                          {/* More menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenSwapDialog(meal)}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Swap Recipe
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRegenerateMeal(meal)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Quick Regenerate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleLock(meal)}>
                                {meal.isLocked ? (
                                  <>
                                    <LockOpen className="mr-2 h-4 w-4" />
                                    Unlock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="mr-2 h-4 w-4" />
                                    Lock
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
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
                      </div>
                      <div className="mt-auto flex items-center gap-1 flex-wrap">
                        {meal.isLeftover && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200">
                            Leftover
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1 py-0 h-auto min-h-4 whitespace-normal text-left leading-tight',
                            servingLabel.isUnderAllocated &&
                              'border-red-400 text-red-700 bg-red-50'
                          )}
                        >
                          {servingLabel.text}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))}

          {/* Day notes: separate row; stored on MealPlan.dayNotes JSON keyed by date */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-2 mb-2">
            <div className="flex items-start justify-end pr-4 pt-2 text-sm font-medium text-muted-foreground">
              <StickyNote className="mr-2 h-4 w-4 shrink-0 opacity-70" aria-hidden />
              Notes
            </div>
            {weekDays.map((day) => {
              const isInRange = day >= planStartDate && day <= planEndDate
              const dateStr = day.toISOString().split('T')[0]
              if (!isInRange) {
                return (
                  <div key={day.toISOString()} className="min-h-[72px] bg-slate-50 rounded-lg" />
                )
              }
              const dayNote = ((plan.dayNotes as Record<string, string>) ?? {})[dateStr] ?? ''
              return (
                <div
                  key={day.toISOString()}
                  className="rounded-lg border border-slate-200 bg-muted/30 p-2"
                >
                  <Textarea
                    key={`day-notes-${dateStr}-${dayNote}`}
                    defaultValue={dayNote}
                    onBlur={(e) => handleDayNotesBlur(dateStr, e.target.value)}
                    placeholder="Your notes for this day…"
                    className="min-h-[64px] text-xs resize-y bg-background"
                    aria-label={`Notes for ${formatDate(day)}`}
                  />
                </div>
              )
            })}
          </div>
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
                {plan.plannedMeals.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Meals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {lockedCount}
              </div>
              <div className="text-sm text-muted-foreground">Locked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {plan.plannedMeals.filter(m => m.isLeftover).length}
              </div>
              <div className="text-sm text-muted-foreground">Leftovers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {new Set(plan.plannedMeals.map(m => m.recipeId).filter(Boolean)).size}
              </div>
              <div className="text-sm text-muted-foreground">Unique Recipes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Reasoning (if available) */}
      {plan.aiReasoning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Planning Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {plan.aiReasoning}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Swap Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Swap Recipe</DialogTitle>
            <DialogDescription>
              {swapMeal && (
                <>
                  Currently: <strong>{swapMeal.recipe?.name || swapMeal.customName}</strong>
                  <br />
                  {formatDate(new Date(swapMeal.date))} - {MEAL_TYPE_LABELS[swapMeal.mealType as MealType]}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {leftoverSourceOptions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Use leftovers from earlier</h4>
                <ScrollArea className="max-h-[140px] rounded-md border border-slate-100">
                  <div className="space-y-1 p-2">
                    {leftoverSourceOptions.map((m) => {
                      const label = m.recipe?.name || m.customName || 'Meal'
                      const d = formatDate(new Date(m.date))
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSwapToLeftoverFrom(m.id)}
                          disabled={regeneratingMealId !== null}
                          className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground text-xs block">
                            {d} · {MEAL_TYPE_LABELS[m.mealType as MealType]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="manual-meal-name">Custom meal (no recipe)</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-meal-name"
                  value={manualMealName}
                  onChange={(e) => setManualMealName(e.target.value)}
                  placeholder="e.g. Pizza night, Eating out"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleSwapToManualName()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSwapToManualName()}
                  disabled={regeneratingMealId !== null || !manualMealName.trim()}
                >
                  Apply
                </Button>
              </div>
            </div>

            {/* AI Suggestions */}
            {(isLoadingSuggestions || swapSuggestions.length > 0) && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  AI Suggestions
                </h4>
                {isLoadingSuggestions ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting suggestions...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {swapSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.recipeId}
                        onClick={() => handleSwapToRecipe(suggestion.recipeId)}
                        disabled={regeneratingMealId !== null}
                        className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <div className="font-medium">{suggestion.recipeName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {suggestion.reasoning}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search all recipes */}
            <div>
              <h4 className="text-sm font-medium mb-2">Or choose from all recipes</h4>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipes..."
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => handleSwapToRecipe(recipe.id)}
                      disabled={regeneratingMealId !== null}
                      className="w-full text-left p-2 rounded hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
                    >
                      {recipe.name}
                    </button>
                  ))}
                  {filteredRecipes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recipes found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
