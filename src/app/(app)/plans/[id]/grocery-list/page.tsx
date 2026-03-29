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
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GroceryItem {
  id: string
  name: string
  quantity: number
  unit: string
  category: string
  isChecked: boolean
  mealNames: string[]
}

interface GroceryCategory {
  name: string
  items: GroceryItem[]
}

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
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  
  useEffect(() => {
    fetchGroceryList()
  }, [planId])
  
  async function fetchGroceryList() {
    try {
      const response = await fetch(`/api/plans/${planId}/grocery`)
      if (response.ok) {
        const data = await response.json()
        const items = data.items || []
        // Group items by section (map to display name)
        const grouped: Record<string, GroceryItem[]> = {}
        
        for (const item of items) {
          const sectionKey = item.section || 'OTHER'
          const category = SECTION_TO_DISPLAY[sectionKey] || sectionKey.replace(/_/g, ' ')
          if (!grouped[category]) {
            grouped[category] = []
          }
          grouped[category].push({
            id: item.id,
            name: item.name,
            quantity: item.quantity ?? 0,
            unit: item.unit ?? '',
            category,
            isChecked: item.isChecked || false,
            mealNames: item.mealNames || [],
          })
        }
        
        // Sort categories according to order
        const sortedCategories = CATEGORY_ORDER
          .filter(cat => grouped[cat])
          .map(cat => ({ name: cat, items: grouped[cat] }))
        
        // Add any categories not in the order list
        Object.keys(grouped)
          .filter(cat => !CATEGORY_ORDER.includes(cat))
          .forEach(cat => sortedCategories.push({ name: cat, items: grouped[cat] }))
        
        setCategories(sortedCategories)
        
        // Load checked items from state
        const initialChecked = new Set<string>()
        items.forEach((item: { id: string; isChecked?: boolean }) => {
          if (item.isChecked) {
            initialChecked.add(item.id)
          }
        })
        setCheckedItems(initialChecked)
      } else {
        console.error('Failed to fetch grocery list')
      }
    } catch (error) {
      console.error('Error fetching grocery list:', error)
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
      })
      if (response.ok) {
        await fetchGroceryList()
      } else {
        const err = await response.json()
        alert(err.error || 'Failed to regenerate list')
      }
    } catch (error) {
      console.error('Regenerate failed:', error)
      alert('Failed to regenerate list')
    } finally {
      setIsRegenerating(false)
    }
  }
  
  const handlePrint = () => {
    window.print()
  }
  
  const buildGroceryText = (useBullets: boolean) => {
    const lines: string[] = []
    categories.forEach(cat => {
      lines.push(`\n${cat.name}`)
      cat.items.forEach(item => {
        const qty = item.quantity > 0 ? `${item.quantity}` : ''
        const unit = item.unit ? ` ${item.unit}` : ''
        const meals = item.mealNames.length > 0 ? ` (${item.mealNames.join(', ')})` : ''
        const prefix = useBullets ? '- ' : (checkedItems.has(item.id) ? '[x] ' : '[ ] ')
        lines.push(`${prefix}${qty}${unit} ${item.name}${meals}`)
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
  
  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0)
  const checkedCount = checkedItems.size
  
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
    <div className="space-y-6">
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
      
      {/* Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-3">
        <div 
          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
          style={{ width: totalItems > 0 ? `${(checkedCount / totalItems) * 100}%` : '0%' }}
        />
      </div>
      
      {/* Empty State */}
      {categories.length === 0 ? (
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
        <div className="grid md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <Card key={category.name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{category.name}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {category.items.filter(i => checkedItems.has(i.id)).length}/{category.items.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {category.items.map((item) => {
                    const isChecked = checkedItems.has(item.id)
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-slate-50",
                          isChecked && "bg-slate-50"
                        )}
                        onClick={() => handleToggleItem(item.id)}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          isChecked 
                            ? "border-emerald-500 bg-emerald-500" 
                            : "border-slate-300"
                        )}>
                          {isChecked && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className={cn(
                          "flex-1 min-w-0 transition-colors",
                          isChecked && "text-muted-foreground line-through"
                        )}>
                          <div>
                            <span className="font-medium">{item.name}</span>
                            {(item.quantity > 0 || item.unit) && (
                              <span className="text-muted-foreground ml-2">
                                {item.quantity > 0 ? item.quantity : ''}{item.unit ? ` ${item.unit}` : ''}
                              </span>
                            )}
                          </div>
                          {item.mealNames.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.mealNames.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  )
}
