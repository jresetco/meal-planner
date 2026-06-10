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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Lock,
  LockOpen,
  RefreshCw,
  MoreVertical,
  ShoppingCart,
  Trash2,
  Sparkles,
  Search,
  Loader2,
  ArrowRightLeft,
  StickyNote,
  Utensils,
  X,
  Printer,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatDate } from '@/lib/utils'
import { getServingDisplay } from '@/lib/plan-servings-display'
import { isSlotAfter, slotKey, ymd } from '@/lib/plan-meal-slots'
import type { MealPlan, PlannedMeal, Recipe, MealType, MealComponent, DynamicComponentRef, ComponentCategory } from '@/types'
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
const DYNAMIC_CATEGORY_LABELS: Record<ComponentCategory, string> = {
  PROTEIN: 'Protein',
  VEGGIE: 'Veggie',
  STARCH: 'Starch',
  SAUCE: 'Sauce',
}

export default function PlanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string
  
  const [plan, setPlan] = useState<MealPlanWithMeals | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Swap dialog state
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [swapMeal, setSwapMeal] = useState<MealWithRecipe | null>(null)
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [suggestionsRequested, setSuggestionsRequested] = useState(false)
  const [swapSearch, setSwapSearch] = useState('')
  const [manualMealName, setManualMealName] = useState('')
  const [recipes, setRecipes] = useState<Pick<Recipe, 'id' | 'name'>[]>([])

  // Dynamic meal builder state (add a component-based meal directly during swap)
  const [mealComponents, setMealComponents] = useState<MealComponent[]>([])
  const [showDynamicBuilder, setShowDynamicBuilder] = useState(false)
  const [dynamicComponents, setDynamicComponents] = useState<DynamicComponentRef[]>([])
  
  // Operation states
  const [regeneratingMealId, setRegeneratingMealId] = useState<string | null>(null)
  const [regeneratingDay, setRegeneratingDay] = useState<string | null>(null)
  const [regeneratingPlan, setRegeneratingPlan] = useState(false)

  // Regenerate plan dialog state
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [regenerateGuidance, setRegenerateGuidance] = useState('')

  // Print options dialog state
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printScale, setPrintScale] = useState('0.85')
  const [printWeeksPerPage, setPrintWeeksPerPage] = useState('1')
  const [printOrientation, setPrintOrientation] = useState('landscape')

  useEffect(() => {
    fetchPlan()
    fetchRecipes()
    fetchMealComponents()
  }, [planId])

  // Drive the printed paper size/orientation from the selected option. `@page`
  // can't be set via inline styles, so we manage a single <style> tag for it.
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = `@page { size: ${printOrientation}; margin: 0.4in; }`
    document.head.appendChild(el)
    return () => {
      el.remove()
    }
  }, [printOrientation])
  
  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/plans/${planId}`)
      if (response.ok) {
        const data = await response.json()
        setPlan(data)
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

  const fetchMealComponents = async () => {
    try {
      const response = await fetch('/api/settings/meal-components')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) setMealComponents(data)
      }
    } catch (error) {
      console.error('Error fetching meal components:', error)
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
  
  const handleOpenSwapDialog = (meal: MealWithRecipe) => {
    setSwapMeal(meal)
    setSwapDialogOpen(true)
    // Lazy: do NOT auto-fetch AI suggestions on open (saves AI cost + load time).
    // The user requests them explicitly via the "Get AI suggestions" button.
    setSwapSuggestions([])
    setSuggestionsRequested(false)
    setSwapSearch('')
    setManualMealName('')
    setDynamicComponents([])
    setShowDynamicBuilder(false)
  }

  const handleGetSuggestions = async () => {
    if (!swapMeal) return
    setSuggestionsRequested(true)
    setIsLoadingSuggestions(true)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${swapMeal.id}/swap`, {
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
  
  const toggleDynamicComponent = (component: MealComponent, prepMethod?: string) => {
    setDynamicComponents((prev) => {
      const existingIdx = prev.findIndex((c) => c.componentId === component.id)
      if (existingIdx >= 0) {
        // Already selected — toggle off, or update prep method if a different one was chosen
        if (prepMethod && prev[existingIdx].prepMethod !== prepMethod) {
          const next = [...prev]
          next[existingIdx] = { ...next[existingIdx], prepMethod }
          return next
        }
        return prev.filter((_, i) => i !== existingIdx)
      }
      return [
        ...prev,
        {
          componentId: component.id,
          componentName: component.name,
          category: component.category,
          prepMethod: prepMethod || component.prepMethods[0] || undefined,
        },
      ]
    })
  }

  const handleSwapToDynamicMeal = async () => {
    if (!swapMeal || dynamicComponents.length === 0) return
    setRegeneratingMealId(swapMeal.id)
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${swapMeal.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dynamicComponents }),
      })
      if (response.ok) {
        setSwapDialogOpen(false)
        setShowDynamicBuilder(false)
        setDynamicComponents([])
        fetchPlan()
      } else {
        console.error('Failed to apply dynamic meal')
      }
    } catch (error) {
      console.error('Error applying dynamic meal:', error)
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
    setRegenerateDialogOpen(false)
    setRegeneratingPlan(true)
    try {
      const response = await fetch(`/api/plans/${planId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidance: regenerateGuidance.trim() || undefined }),
      })
      if (response.ok) {
        fetchPlan()
      }
    } catch (error) {
      console.error('Error regenerating plan:', error)
    } finally {
      setRegeneratingPlan(false)
      setRegenerateGuidance('')
    }
  }
  
  const handleDeleteMeal = async (mealId: string) => {
    // Instant, single-click removal (no confirmation modal). Optimistically drop
    // the meal so the slot frees immediately; revert if the API call fails.
    const previousMeals = plan?.plannedMeals
    setPlan(prev =>
      prev
        ? { ...prev, plannedMeals: prev.plannedMeals.filter(m => m.id !== mealId) }
        : prev
    )
    try {
      const response = await fetch(`/api/plans/${planId}/meals/${mealId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        // Revert on failure
        setPlan(prev =>
          prev && previousMeals ? { ...prev, plannedMeals: previousMeals } : prev
        )
      }
    } catch (error) {
      console.error('Error deleting meal:', error)
      setPlan(prev =>
        prev && previousMeals ? { ...prev, plannedMeals: previousMeals } : prev
      )
    }
  }
  
  /**
   * Add a meal back into an empty slot. Creates a blank placeholder meal for the
   * given day + mealType, then opens the existing swap dialog so the user can pick
   * a recipe / leftover / custom name — reusing all the add/swap machinery.
   */
  const [addingSlotKey, setAddingSlotKey] = useState<string | null>(null)
  const handleAddMealToSlot = async (date: Date, mealType: MealType) => {
    const dateStr = ymd(date)
    const slot = slotKey(dateStr, mealType)
    if (addingSlotKey) return
    setAddingSlotKey(slot)
    try {
      const response = await fetch(`/api/plans/${planId}/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, mealType, customName: 'New meal' }),
      })
      if (response.ok) {
        const created: MealWithRecipe = await response.json()
        // Reflect the new slot immediately, then open the swap dialog on it.
        setPlan(prev =>
          prev ? { ...prev, plannedMeals: [...prev.plannedMeals, created] } : prev
        )
        handleOpenSwapDialog(created)
      }
    } catch (error) {
      console.error('Error adding meal:', error)
    } finally {
      setAddingSlotKey(null)
    }
  }

  /**
   * Lock or unlock every meal of a day in one click. If any meal is currently
   * unlocked, lock them all; otherwise (all already locked) unlock them all.
   * Batches the existing per-meal PATCH calls with an optimistic UI update.
   */
  const [togglingDayLock, setTogglingDayLock] = useState<string | null>(null)
  const handleToggleDayLock = async (date: Date) => {
    if (!plan) return
    const dateStr = ymd(date)
    const dayMeals = plan.plannedMeals.filter(m => ymd(new Date(m.date)) === dateStr)
    if (dayMeals.length === 0) return
    // Mixed or all-unlocked → lock all; all-locked → unlock all.
    const newLocked = dayMeals.some(m => !m.isLocked)
    const dayMealIds = new Set(dayMeals.map(m => m.id))

    setTogglingDayLock(dateStr)
    // Optimistic update
    setPlan(prev =>
      prev
        ? {
            ...prev,
            plannedMeals: prev.plannedMeals.map(m =>
              dayMealIds.has(m.id) ? { ...m, isLocked: newLocked } : m
            ),
          }
        : prev
    )
    try {
      const results = await Promise.all(
        dayMeals
          .filter(m => m.isLocked !== newLocked)
          .map(m =>
            fetch(`/api/plans/${planId}/meals/${m.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isLocked: newLocked }),
            })
          )
      )
      if (results.some(r => !r.ok)) {
        // Re-sync from server if any call failed
        fetchPlan()
      }
    } catch (error) {
      console.error('Error toggling day lock:', error)
      fetchPlan()
    } finally {
      setTogglingDayLock(null)
    }
  }

  /** The 7 days of a Sunday-aligned week starting at `weekStart`. */
  const getWeekDays = (weekStart: Date): Date[] => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
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

  /**
   * Sunday-aligned start date of every week the plan spans. Used to crop the
   * calendar to the plan's actual weeks (no leading/trailing empty weeks) for
   * both the on-screen grid and the print layout.
   */
  const planWeekStarts = useMemo(() => {
    if (!plan) return []
    const start = new Date(plan.startDate)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - start.getDay())
    const end = new Date(plan.endDate)
    end.setHours(23, 59, 59, 999)
    const weeks: Date[] = []
    const cursor = new Date(start)
    while (cursor <= end) {
      weeks.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 7)
    }
    return weeks
  }, [plan])

  const handlePrint = () => {
    // Close the options dialog first so its overlay isn't captured in the
    // printout, then let the DOM settle before opening the print dialog.
    setPrintDialogOpen(false)
    setTimeout(() => window.print(), 150)
  }

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
  
  const planStartDate = new Date(plan.startDate)
  const planEndDate = new Date(plan.endDate)
  const lockedCount = plan.plannedMeals.filter(m => m.isLocked).length

  return (
    <>
      <div className="space-y-6 print:hidden">
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
            onClick={() => setRegenerateDialogOpen(true)}
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
          <Button variant="outline" onClick={() => setPrintDialogOpen(true)}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Meal Grid — one grid per week the plan spans (cropped to plan range) */}
      <div className="overflow-x-auto space-y-6">
        {planWeekStarts.map((weekStart) => {
        const weekDays = getWeekDays(weekStart)
        return (
        <div key={weekStart.toISOString()} className="min-w-[1400px]">
          {/* Day Headers */}
          <div className="grid grid-cols-[80px_repeat(7,minmax(170px,1fr))] gap-2 mb-2">
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
              const allLocked = dayMeals.length > 0 && dayMeals.every(m => m.isLocked)
              const isTogglingLock = togglingDayLock === dateStr

              // Days outside the plan range render as compact greyed stubs so a
              // 2-week plan starting mid-week still fits one screen comfortably.
              if (!isInRange) {
                return (
                  <div
                    key={day.toISOString()}
                    className="text-center py-2 rounded-lg bg-slate-50 text-slate-300"
                  >
                    <div className="text-xs uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-sm font-medium">{day.getDate()}</div>
                  </div>
                )
              }

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "text-center py-2 rounded-lg relative",
                    isWeekend && "bg-violet-50 text-violet-800 border border-violet-100",
                    !isWeekend && "bg-emerald-50 text-emerald-700"
                  )}
                >
                  <div className="text-xs uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-lg font-semibold">{day.getDate()}</div>
                  <div className="absolute top-1 right-1 flex items-center gap-0.5">
                    {/* Full-day lock/unlock toggle */}
                    {dayMeals.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 transition-opacity",
                          allLocked
                            ? "text-emerald-600 opacity-100"
                            : "opacity-50 hover:opacity-100"
                        )}
                        onClick={() => handleToggleDayLock(day)}
                        disabled={isTogglingLock}
                        title={allLocked ? "Unlock all meals this day" : "Lock all meals this day"}
                      >
                        {isTogglingLock ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : allLocked ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <LockOpen className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
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
                </div>
              )
            })}
          </div>

          {/* Meal Rows */}
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="grid grid-cols-[80px_repeat(7,minmax(170px,1fr))] gap-2 mb-2">
              <div className="flex items-center justify-end pr-4 text-sm font-medium text-muted-foreground">
                <span className="mr-2">{MEAL_TYPE_ICONS[mealType]}</span>
                {MEAL_TYPE_LABELS[mealType]}
              </div>
              {weekDays.map((day) => {
                const meal = getMealForSlot(day, mealType)
                const isInRange = day >= planStartDate && day <= planEndDate
                
                if (!isInRange) {
                  return (
                    <div key={day.toISOString()} className="bg-slate-50 rounded-lg" />
                  )
                }

                if (!meal) {
                  const isAdding = addingSlotKey === slotKey(ymd(day), mealType)
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => handleAddMealToSlot(day, mealType)}
                      disabled={isAdding}
                      className="min-h-28 w-full border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors disabled:opacity-60"
                      title="Add a meal to this slot"
                    >
                      {isAdding ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5" />
                          <span className="text-xs font-medium">Add meal</span>
                        </>
                      )}
                    </button>
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
                          dynamicComponents={meal.isDynamic ? meal.dynamicComponents as any : undefined}
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
                        {meal.isDynamic && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200">
                            Dynamic
                          </Badge>
                        )}
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
          <div className="grid grid-cols-[80px_repeat(7,minmax(170px,1fr))] gap-2 mb-2">
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
        )
        })}
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
            {plan.plannedMeals.some(m => m.isDynamic) && (
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {plan.plannedMeals.filter(m => m.isDynamic).length}
                </div>
                <div className="text-sm text-muted-foreground">Dynamic Meals</div>
              </div>
            )}
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

      {/* Regenerate Plan Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Plan</DialogTitle>
            <DialogDescription>
              This will regenerate all unlocked meals ({plan.plannedMeals.length - lockedCount} of {plan.plannedMeals.length}).
              {lockedCount > 0 && ` ${lockedCount} locked meal${lockedCount > 1 ? 's' : ''} will be kept.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="regenerate-guidance">Guidance for AI (optional)</Label>
              <Textarea
                id="regenerate-guidance"
                value={regenerateGuidance}
                onChange={(e) => setRegenerateGuidance(e.target.value)}
                placeholder="e.g. More quick weeknight meals, try some Asian recipes, lighter lunches..."
                className="mt-1.5 min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Give the AI specific direction for this regeneration.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRegeneratePlan}>
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

            {/* AI Suggestions — lazy (only fetched on button click) + compact (chips) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  AI Suggestions
                </h4>
                {!isLoadingSuggestions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleGetSuggestions}
                    disabled={regeneratingMealId !== null}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5 text-purple-500" />
                    {suggestionsRequested && swapSuggestions.length > 0 ? 'Refresh' : 'Get AI suggestions'}
                  </Button>
                )}
              </div>
              {isLoadingSuggestions ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Getting suggestions...
                </div>
              ) : suggestionsRequested && swapSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No suggestions available.</p>
              ) : swapSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {swapSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.recipeId}
                      onClick={() => handleSwapToRecipe(suggestion.recipeId)}
                      disabled={regeneratingMealId !== null}
                      title={suggestion.reasoning}
                      className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                      {suggestion.recipeName}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Click to let the AI suggest recipes for this slot.
                </p>
              )}
            </div>

            {/* Dynamic meal builder — add a component-based meal directly */}
            {mealComponents.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-emerald-600" />
                    Build a dynamic meal
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowDynamicBuilder((v) => !v)}
                  >
                    {showDynamicBuilder ? 'Hide' : 'Build from components'}
                  </Button>
                </div>
                {showDynamicBuilder && (
                  <div className="space-y-3 rounded-md border border-slate-200 p-3">
                    {(['PROTEIN', 'VEGGIE', 'STARCH', 'SAUCE'] as ComponentCategory[]).map((category) => {
                      const items = mealComponents.filter((c) => c.category === category && c.isActive !== false)
                      if (items.length === 0) return null
                      return (
                        <div key={category}>
                          <p className="text-xs font-semibold text-slate-600 mb-1">
                            {DYNAMIC_CATEGORY_LABELS[category]}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((component) => {
                              const selected = dynamicComponents.find((c) => c.componentId === component.id)
                              return (
                                <button
                                  key={component.id}
                                  type="button"
                                  onClick={() => toggleDynamicComponent(component)}
                                  className={cn(
                                    'rounded-full border px-3 py-1 text-xs transition-colors',
                                    selected
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  )}
                                >
                                  {selected?.prepMethod ? `${selected.prepMethod} ` : ''}
                                  {component.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-muted-foreground">
                        {dynamicComponents.length === 0
                          ? 'Pick one or more components.'
                          : dynamicComponents
                              .map((c) => (c.prepMethod ? `${c.prepMethod} ${c.componentName}` : c.componentName))
                              .join(', ')}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => void handleSwapToDynamicMeal()}
                        disabled={dynamicComponents.length === 0 || regeneratingMealId !== null}
                      >
                        Add dynamic meal
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search all recipes */}
            <div>
              <h4 className="text-sm font-medium mb-2">Or choose from all recipes</h4>
              <div className="relative mb-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipes..."
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {swapSearch && (
                  <button
                    type="button"
                    onClick={() => setSwapSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2 px-0.5">
                {filteredRecipes.length} of {recipes.length} recipe{recipes.length === 1 ? '' : 's'}
              </p>
              <ScrollArea className="h-[200px] rounded-md border border-slate-100">
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

      {/* ------------------------------------------------------------------ */}
      {/* Print-only document: the full plan rendered week-by-week as a grid. */}
      {/* Hidden on screen (`hidden print:block`); the app shell + on-screen   */}
      {/* UI are hidden via `print:hidden`. Scale = CSS zoom; weeks-per-page    */}
      {/* inserts a page break; orientation drives the @page size (effect).    */}
      {/* ------------------------------------------------------------------ */}
      <div
        id="plan-print-root"
        className="hidden print:block text-black"
        style={{ zoom: Number(printScale) }}
      >
        <div className="mb-4">
          <h1 className="text-xl font-bold">Your Meal Plan</h1>
          <p className="text-sm">
            {formatDate(planStartDate)} – {formatDate(planEndDate)}
          </p>
        </div>

        {planWeekStarts.map((weekStart, weekIndex) => {
          const days = getWeekDays(weekStart)
          const weeksPerPage = Math.max(1, Number(printWeeksPerPage))
          const isLastWeek = weekIndex === planWeekStarts.length - 1
          const breakAfter = !isLastWeek && (weekIndex + 1) % weeksPerPage === 0
          const weekHasNotes = days.some((d) => {
            const ds = d.toISOString().split('T')[0]
            return (
              (((plan.dayNotes as Record<string, string>) ?? {})[ds] ?? '').trim()
                .length > 0
            )
          })

          return (
            <section
              key={weekStart.toISOString()}
              className="print-week mb-5"
              style={breakAfter ? { breakAfter: 'page' } : undefined}
            >
              <h2 className="text-sm font-semibold mb-1">
                Week of {formatDate(weekStart)}
              </h2>
              <table className="w-full border-collapse text-[11px] leading-tight">
                <thead>
                  <tr>
                    <th className="w-[64px] border border-slate-500 px-1 py-0.5 text-left" />
                    {days.map((day) => {
                      const inRange = day >= planStartDate && day <= planEndDate
                      return (
                        <th
                          key={day.toISOString()}
                          className={cn(
                            'border border-slate-500 px-1 py-0.5 text-center align-middle',
                            !inRange && 'text-slate-400'
                          )}
                        >
                          <div className="text-[9px] uppercase">
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="text-[12px] font-bold">
                            {day.toLocaleDateString('en-US', {
                              month: 'numeric',
                              day: 'numeric',
                            })}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.map((mealType) => (
                    <tr key={mealType}>
                      <th className="whitespace-nowrap border border-slate-500 px-1 py-0.5 text-left align-top font-semibold">
                        {MEAL_TYPE_LABELS[mealType]}
                      </th>
                      {days.map((day) => {
                        const inRange = day >= planStartDate && day <= planEndDate
                        const meal = getMealForSlot(day, mealType)
                        if (!inRange) {
                          return (
                            <td
                              key={day.toISOString()}
                              className="border border-slate-300 bg-slate-50 px-1 py-0.5 align-top"
                            />
                          )
                        }
                        if (!meal) {
                          return (
                            <td
                              key={day.toISOString()}
                              className="border border-slate-500 px-1 py-0.5 align-top text-slate-300"
                            >
                              —
                            </td>
                          )
                        }
                        const mealName =
                          meal.recipe?.name || meal.customName || 'Unknown'
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
                          <td
                            key={day.toISOString()}
                            className="border border-slate-500 px-1 py-0.5 align-top"
                          >
                            <div className="font-medium">
                              {meal.isLeftover && <span>LO: </span>}
                              {mealName}
                            </div>
                            <div className="text-[9px] text-slate-600">
                              {servingLabel.text}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {weekHasNotes && (
                    <tr>
                      <th className="border border-slate-500 px-1 py-0.5 text-left align-top font-semibold">
                        Notes
                      </th>
                      {days.map((day) => {
                        const inRange = day >= planStartDate && day <= planEndDate
                        const ds = day.toISOString().split('T')[0]
                        const note =
                          ((plan.dayNotes as Record<string, string>) ?? {})[ds] ??
                          ''
                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              'border px-1 py-0.5 align-top text-[10px]',
                              inRange
                                ? 'border-slate-500'
                                : 'border-slate-300 bg-slate-50'
                            )}
                          >
                            {inRange ? note : ''}
                          </td>
                        )
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )
        })}
      </div>

      {/* Print options dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print Meal Plan
            </DialogTitle>
            <DialogDescription>
              Prints the full plan ({planWeekStarts.length} week
              {planWeekStarts.length === 1 ? '' : 's'}) as a clean grid. Adjust the
              size and page layout, then print.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="print-scale">Scale</Label>
                <Select value={printScale} onValueChange={setPrintScale}>
                  <SelectTrigger id="print-scale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['0.6', '0.7', '0.75', '0.8', '0.85', '0.9', '1', '1.1', '1.25'].map(
                      (v) => (
                        <SelectItem key={v} value={v}>
                          {Math.round(Number(v) * 100)}%
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="print-weeks">Weeks / page</Label>
                <Select
                  value={printWeeksPerPage}
                  onValueChange={setPrintWeeksPerPage}
                >
                  <SelectTrigger id="print-weeks">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['1', '2', '3', '4'].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="print-orientation">Orientation</Label>
              <Select value={printOrientation} onValueChange={setPrintOrientation}>
                <SelectTrigger id="print-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">
                    Landscape (fits a full week best)
                  </SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
