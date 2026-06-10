'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  ShoppingCart,
  Printer,
  Download,
  Copy,
  Check,
  Circle,
  RefreshCw,
  AlertCircle,
  EyeOff,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HideItemDialog } from '@/components/grocery/hide-item-dialog'
import { AddItemDialog, type AddItemValues } from '@/components/grocery/add-item-dialog'

interface GroceryItem {
  id: string
  name: string
  quantity: number
  unit: string
  category: string
  isChecked: boolean
  isStaple: boolean
  mealNames: string[]
}

interface GroceryCategory {
  name: string
  items: GroceryItem[]
}

type GroceryView = 'active' | 'excluded'

const SECTION_TO_DISPLAY: Record<string, string> = {
  BREAD_BAKERY: 'Bread/Tortillas/Bakery',
  DELI_CHEESE: 'Deli Meat/Cheese/Dips',
  FROZEN_FISH: 'Frozen Fish',
  MEAT_POULTRY: 'Meat/Poultry',
  PRODUCE: 'Produce',
  EGGS_DAIRY: 'Eggs/Dairy/Vegan',
  FROZEN: 'Frozen',
  SPICES: 'Spices & Seasonings',
  PANTRY: 'Pantry – Cereal/Snacks/Etc',
  PASTA_CANNED: 'Pasta & Canned Goods',
  ASIAN_MEXICAN: 'Asian/Mexican',
  BEVERAGES: 'Beverages',
  OTHER: 'Other',
}

const CATEGORY_ORDER = [
  'Bread/Tortillas/Bakery',
  'Deli Meat/Cheese/Dips',
  'Frozen Fish',
  'Meat/Poultry',
  'Produce',
  'Eggs/Dairy/Vegan',
  'Frozen',
  'Spices & Seasonings',
  'Pantry – Cereal/Snacks/Etc',
  'Pasta & Canned Goods',
  'Asian/Mexican',
  'Beverages',
  'Other',
]

export default function GroceryListPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string
  
  const [categories, setCategories] = useState<GroceryCategory[]>([])
  const [excludedCategories, setExcludedCategories] = useState<GroceryCategory[]>([])
  const [wholeMeals, setWholeMeals] = useState<string[]>([])
  const [checkedWholeMeals, setCheckedWholeMeals] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [hideTarget, setHideTarget] = useState<GroceryItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [fetchError, setFetchError] = useState<{ message: string; code?: string } | null>(null)
  const [view, setView] = useState<GroceryView>('active')

  useEffect(() => {
    fetchGroceryList()
  }, [planId])
  
  function applyGroceryData(data: {
    isStale?: boolean
    wholeMeals?: string[]
    checkedWholeMeals?: string[]
    items?: { id: string; name: string; section?: string; quantity?: number | null; unit?: string | null; isChecked?: boolean; isStaple?: boolean; mealNames?: string[] }[]
  }) {
    setIsStale(Boolean(data.isStale))
    setWholeMeals(Array.isArray(data.wholeMeals) ? data.wholeMeals : [])
    setCheckedWholeMeals(new Set(Array.isArray(data.checkedWholeMeals) ? data.checkedWholeMeals : []))
    const items = data.items || []
    const grouped: Record<string, GroceryItem[]> = {}
    const excludedGrouped: Record<string, GroceryItem[]> = {}

    for (const item of items) {
      const sectionKey = item.section || 'OTHER'
      const category = SECTION_TO_DISPLAY[sectionKey] || sectionKey.replace(/_/g, ' ')
      const target = item.isStaple ? excludedGrouped : grouped
      if (!target[category]) target[category] = []
      target[category].push({
        id: item.id,
        name: item.name,
        quantity: item.quantity ?? 0,
        unit: item.unit ?? '',
        category,
        isChecked: item.isChecked || false,
        isStaple: Boolean(item.isStaple),
        mealNames: item.mealNames || [],
      })
    }

    const orderGroup = (g: Record<string, GroceryItem[]>): GroceryCategory[] => {
      const sorted = CATEGORY_ORDER.filter(cat => g[cat]).map(cat => ({ name: cat, items: g[cat] }))
      Object.keys(g)
        .filter(cat => !CATEGORY_ORDER.includes(cat))
        .forEach(cat => sorted.push({ name: cat, items: g[cat] }))
      return sorted
    }

    setCategories(orderGroup(grouped))
    setExcludedCategories(orderGroup(excludedGrouped))

    const initialChecked = new Set<string>()
    items.forEach(item => { if (item.isChecked && !item.isStaple) initialChecked.add(item.id) })
    setCheckedItems(initialChecked)
  }

  async function fetchGroceryList() {
    try {
      const response = await fetch(`/api/plans/${planId}/grocery`, { cache: 'no-store' })
      if (response.ok) {
        setFetchError(null)
        applyGroceryData(await response.json())
      } else {
        // Try to parse a structured error body; fall back to plain text so users
        // see the real cause rather than an indistinguishable empty list.
        const body = await response.json().catch(async () => {
          const text = await response.text().catch(() => '')
          return { error: text || `HTTP ${response.status}`, code: undefined }
        })
        console.error(`Failed to fetch grocery list (status ${response.status}):`, body)
        setFetchError({ message: body.error || `HTTP ${response.status}`, code: body.code })
      }
    } catch (error) {
      console.error('Error fetching grocery list:', error)
      setFetchError({
        message: error instanceof Error ? error.message : 'Network error while loading grocery list',
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleToggleItem = async (itemId: string) => {
    const isCurrentlyChecked = checkedItems.has(itemId)
    const newCheckedState = !isCurrentlyChecked
    
    // Optimistically update UI
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (newCheckedState) {
        newSet.add(itemId)
      } else {
        newSet.delete(itemId)
      }
      return newSet
    })
    
    // Persist to backend
    try {
      await fetch(`/api/plans/${planId}/grocery/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: newCheckedState }),
      })
    } catch (error) {
      console.error('Failed to update item:', error)
      // Revert on error
      setCheckedItems(prev => {
        const newSet = new Set(prev)
        if (isCurrentlyChecked) {
          newSet.add(itemId)
        } else {
          newSet.delete(itemId)
        }
        return newSet
      })
    }
  }
  
  const handleClearChecked = async () => {
    const prevChecked = new Set(checkedItems)
    setCheckedItems(new Set())
    try {
      await fetch(`/api/plans/${planId}/grocery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uncheckAll: true }),
      })
    } catch (error) {
      console.error('Failed to clear checked items:', error)
      setCheckedItems(prevChecked)
    }
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    try {
      const response = await fetch(`/api/plans/${planId}/grocery`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (response.ok) {
        // POST returns the newly generated list; use it directly instead of
        // firing a second GET (which could race with the response)
        applyGroceryData(await response.json())
      } else {
        const err = await response.json().catch(() => ({}))
        console.error(`Regenerate failed (status ${response.status}):`, err)
        alert(err.error || 'Failed to regenerate list')
      }
    } catch (error) {
      console.error('Regenerate failed:', error)
      alert('Failed to regenerate list')
    } finally {
      setIsRegenerating(false)
    }
  }
  
  const handleToggleWholeMeal = async (mealName: string) => {
    const wasChecked = checkedWholeMeals.has(mealName)
    const nextSet = new Set(checkedWholeMeals)
    if (wasChecked) nextSet.delete(mealName)
    else nextSet.add(mealName)
    setCheckedWholeMeals(nextSet)

    try {
      await fetch(`/api/plans/${planId}/grocery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedWholeMeals: Array.from(nextSet) }),
      })
    } catch (err) {
      console.error('Failed to persist whole-meal check:', err)
      // Revert on error
      setCheckedWholeMeals(prev => {
        const reverted = new Set(prev)
        if (wasChecked) reverted.add(mealName)
        else reverted.delete(mealName)
        return reverted
      })
    }
  }

  const removeItemFromState = (itemId: string) => {
    setCategories(prev =>
      prev
        .map(cat => ({ ...cat, items: cat.items.filter(i => i.id !== itemId) }))
        .filter(cat => cat.items.length > 0)
    )
    setCheckedItems(prev => {
      if (!prev.has(itemId)) return prev
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  const handleHideConfirm = async () => {
    if (!hideTarget) return
    const target = hideTarget
    try {
      const stapleRes = await fetch('/api/settings/staples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientName: target.name }),
      })
      if (!stapleRes.ok) throw new Error('Failed to add pantry staple')

      const deleteRes = await fetch(`/api/plans/${planId}/grocery/${target.id}`, {
        method: 'DELETE',
      })
      if (!deleteRes.ok) throw new Error('Failed to remove item from list')

      removeItemFromState(target.id)
      setHideTarget(null)
    } catch (err) {
      console.error('Hide permanently failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to hide item')
    }
  }

  const handleAddSubmit = async (values: AddItemValues) => {
    const res = await fetch(`/api/plans/${planId}/grocery/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        quantity: values.quantity ?? null,
        unit: values.unit ?? null,
        section: values.section,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to add item')
    }
    // Refetch to get the new item placed correctly within categories
    await fetchGroceryList()
  }

  const handlePrint = () => {
    window.print()
  }
  
  // OneNote (and some other note apps) mangle pasted lines that contain " / ":
  // on the bullet-to-checkbox conversion the text after the slash is dropped,
  // so "tahini / sesame paste" pasted in as just "tahini". Normalize any
  // slash-separated alternative to " or " for the copy/export text. We also
  // strip a leading "/" / "-" so a line can't accidentally be parsed as markup.
  const sanitizeForCopy = (text: string) =>
    text
      .replace(/\s*\/\s*/g, ' or ')
      .replace(/^[\s/\-•*]+/, '')
      .trim()

  const buildGroceryText = (useBullets: boolean) => {
    const lines: string[] = []
    if (wholeMeals.length > 0) {
      lines.push('\nWhole Meals')
      wholeMeals.forEach(meal => {
        const prefix = useBullets ? '- ' : (checkedWholeMeals.has(meal) ? '[x] ' : '[ ] ')
        lines.push(`${prefix}${sanitizeForCopy(meal)}`)
      })
    }
    categories.forEach(cat => {
      lines.push(`\n${cat.name}`)
      cat.items.forEach(item => {
        const qtyParts = [item.quantity > 0 ? String(item.quantity) : '', item.unit || ''].filter(Boolean).join(' ')
        const qty = qtyParts ? ` (${qtyParts})` : ''
        const meals = item.mealNames.length > 0 ? ` [${item.mealNames.join(', ')}]` : ''
        const prefix = useBullets ? '- ' : (checkedItems.has(item.id) ? '[x] ' : '[ ] ')
        lines.push(`${prefix}${sanitizeForCopy(item.name)}${qty}${meals}`)
      })
    })
    return lines.join('\n').trim()
  }

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    // Bullet format — OneNote converts "- item" into checkable to-do items on paste
    await navigator.clipboard.writeText(buildGroceryText(true))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = () => {
    const blob = new Blob([buildGroceryText(false)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grocery-list.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0) + wholeMeals.length
  const checkedCount = checkedItems.size + Array.from(checkedWholeMeals).filter(m => wholeMeals.includes(m)).length
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/plans/${planId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-emerald-600" />
              Grocery List
            </h1>
            <p className="text-muted-foreground">
              {checkedCount} of {totalItems} items checked
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Saved with this meal plan. Checked items sync as you go. Open all lists from{' '}
              <span className="font-medium text-foreground">Grocery Lists</span> in the nav.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isRegenerating && "animate-spin")} />
            Regenerate
          </Button>
          {checkedCount > 0 && (
            <Button variant="outline" onClick={handleClearChecked}>
              Clear Checked
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      
      {/* Error banner — shown when the API call failed (e.g. missing schema migration, AI error, DB unreachable) */}
      {fetchError && (
        <div className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-900">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t load your grocery list</p>
            <p className="text-sm mt-0.5">{fetchError.message}</p>
            {fetchError.code && (
              <p className="text-xs mt-1 font-mono text-red-700">code: {fetchError.code}</p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => { setIsLoading(true); fetchGroceryList() }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Stale banner — meal plan changed since this list was generated */}
      {isStale && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">This grocery list may be out of date</p>
            <p className="text-sm mt-0.5">
              Meals in this plan have changed since the list was generated. Click Regenerate to refresh it.
            </p>
          </div>
          <Button size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isRegenerating && 'animate-spin')} />
            Regenerate
          </Button>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-3">
        <div
          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
          style={{ width: totalItems > 0 ? `${(checkedCount / totalItems) * 100}%` : '0%' }}
        />
      </div>

      {/* View tabs — Active / Excluded by pantry */}
      {(excludedCategories.length > 0 || view === 'excluded') && (
        <div className="inline-flex rounded-md border bg-muted/30 p-1 gap-1">
          <button
            className={cn(
              'px-3 py-1.5 text-sm rounded transition-colors',
              view === 'active' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setView('active')}
          >
            Active ({totalItems})
          </button>
          <button
            className={cn(
              'px-3 py-1.5 text-sm rounded transition-colors',
              view === 'excluded' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setView('excluded')}
          >
            Excluded by pantry ({excludedCategories.reduce((s, c) => s + c.items.length, 0)})
          </button>
        </div>
      )}

      {view === 'active' && <>

      {/* Whole Meals — manually added meals without ingredient lists */}
      {wholeMeals.length > 0 && (
        <Card className="border-emerald-200">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="uppercase tracking-wide text-emerald-700">Whole Meals</span>
              <span className="text-xs font-normal text-muted-foreground">
                {Array.from(checkedWholeMeals).filter(m => wholeMeals.includes(m)).length}/{wholeMeals.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-2">
            <div>
              {wholeMeals.map((mealName, idx) => {
                const isChecked = checkedWholeMeals.has(mealName)
                return (
                  <div
                    key={`${mealName}-${idx}`}
                    className={cn(
                      "flex items-center gap-3 px-2 py-1 rounded transition-colors cursor-pointer hover:bg-slate-50",
                      isChecked && "bg-slate-50"
                    )}
                    onClick={() => handleToggleWholeMeal(mealName)}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0",
                      isChecked ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                    )}>
                      {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <div className={cn(
                      "flex-1 min-w-0 text-sm transition-colors",
                      isChecked && "text-muted-foreground line-through"
                    )}>
                      <span className="font-medium break-words" title={mealName}>{mealName}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {categories.length === 0 && wholeMeals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items in grocery list</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Your grocery list will be generated based on the recipes in your meal plan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Card key={category.name}>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="uppercase tracking-wide text-muted-foreground">{category.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {category.items.filter(i => checkedItems.has(i.id)).length}/{category.items.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-1 px-2">
                <div>
                  {category.items.map((item) => {
                    const isChecked = checkedItems.has(item.id)
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "group flex items-center gap-3 px-2 py-1 rounded transition-colors cursor-pointer hover:bg-slate-50",
                          isChecked && "bg-slate-50"
                        )}
                        onClick={() => handleToggleItem(item.id)}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0",
                          isChecked
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-slate-300"
                        )}>
                          {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <div className={cn(
                          "flex-1 min-w-0 flex items-baseline gap-2 flex-wrap transition-colors text-sm",
                          isChecked && "text-muted-foreground line-through"
                        )}>
                          <span className="font-medium break-words" title={item.name}>{item.name}</span>
                          {(item.quantity > 0 || item.unit) && (
                            <span className="text-muted-foreground text-xs flex-shrink-0">
                              {item.quantity > 0 ? item.quantity : ''}{item.unit ? ` ${item.unit}` : ''}
                            </span>
                          )}
                          {item.mealNames.length > 0 && (
                            <span className="text-xs text-muted-foreground truncate ml-auto">
                              {item.mealNames.join(', ')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0 p-1 rounded hover:bg-amber-100 text-muted-foreground hover:text-amber-700"
                          aria-label={`Hide ${item.name} permanently`}
                          title="Hide permanently (add to pantry staples)"
                          onClick={(e) => {
                            e.stopPropagation()
                            setHideTarget(item)
                          }}
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      </>}

      {view === 'excluded' && (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <p className="font-medium">Excluded from this list</p>
            <p className="text-sm mt-0.5">
              These ingredients were left off because they match your{' '}
              <a href="/settings" className="underline font-medium">pantry staples</a>.
              Remove an item from pantry staples (or regenerate this list) to bring it back.
            </p>
          </div>
          {excludedCategories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-center max-w-sm">
                  Nothing was excluded from this list. Items you mark as pantry staples will appear here next time.
                </p>
              </CardContent>
            </Card>
          ) : (
            excludedCategories.map((category) => (
              <Card key={`excluded-${category.name}`}>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="uppercase tracking-wide text-muted-foreground">{category.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{category.items.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-1 px-2">
                  <ul className="divide-y">
                    {category.items.map((item) => (
                      <li key={item.id} className="flex items-baseline gap-2 flex-wrap px-2 py-1.5 text-sm text-muted-foreground">
                        <span className="font-medium break-words" title={item.name}>{item.name}</span>
                        {(item.quantity > 0 || item.unit) && (
                          <span className="text-xs">
                            {item.quantity > 0 ? item.quantity : ''}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                        {item.mealNames.length > 0 && (
                          <span className="text-xs truncate ml-auto">{item.mealNames.join(', ')}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* All Checked Message */}
      {checkedCount === totalItems && totalItems > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="flex items-center justify-center gap-4 py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-emerald-800">Shopping Complete!</h3>
              <p className="text-emerald-600">You&apos;ve checked off all items on your list.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <HideItemDialog
        open={Boolean(hideTarget)}
        itemName={hideTarget?.name ?? null}
        onCancel={() => setHideTarget(null)}
        onConfirm={handleHideConfirm}
      />

      <AddItemDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddSubmit}
      />
    </div>
  )
}
