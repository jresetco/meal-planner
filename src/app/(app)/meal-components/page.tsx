'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  X,
  LayoutList,
  LayoutGrid,
  Beef,
  Salad,
  Wheat,
  Droplets,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MealComponent, ComponentCategory } from '@/types'

const CATEGORIES: ComponentCategory[] = ['PROTEIN', 'VEGGIE', 'STARCH', 'SAUCE']

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  PROTEIN: 'Proteins',
  VEGGIE: 'Veggies',
  STARCH: 'Starches',
  SAUCE: 'Sauces',
}

const CATEGORY_ICONS: Record<ComponentCategory, typeof Beef> = {
  PROTEIN: Beef,
  VEGGIE: Salad,
  STARCH: Wheat,
  SAUCE: Droplets,
}

const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  PROTEIN: 'bg-red-50 text-red-700 border-red-200',
  VEGGIE: 'bg-green-50 text-green-700 border-green-200',
  STARCH: 'bg-amber-50 text-amber-700 border-amber-200',
  SAUCE: 'bg-purple-50 text-purple-700 border-purple-200',
}

interface Ingredient {
  name: string
  quantity?: number | null
  unit?: string | null
}

interface ComponentForm {
  category: ComponentCategory
  name: string
  prepMethods: string[]
  defaultCookTime: number | null
  typicalIngredients: Ingredient[]
}

const emptyForm: ComponentForm = {
  category: 'PROTEIN',
  name: '',
  prepMethods: [],
  defaultCookTime: null,
  typicalIngredients: [],
}

export default function MealComponentsPage() {
  const [components, setComponents] = useState<MealComponent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'tabs'>('tabs')
  const [filterCategory, setFilterCategory] = useState<ComponentCategory | 'ALL'>('ALL')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ComponentForm>(emptyForm)
  const [prepMethodInput, setPrepMethodInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  useEffect(() => {
    fetchComponents()
  }, [])

  async function fetchComponents() {
    try {
      const response = await fetch('/api/settings/meal-components')
      if (response.ok) {
        setComponents(await response.json())
      }
    } catch (error) {
      console.error('Error fetching components:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openAddDialog = (category?: ComponentCategory) => {
    setEditingId(null)
    setForm({ ...emptyForm, ...(category ? { category } : {}) })
    setPrepMethodInput('')
    setDialogOpen(true)
  }

  const openEditDialog = (component: MealComponent) => {
    setEditingId(component.id)
    setForm({
      category: component.category,
      name: component.name,
      prepMethods: component.prepMethods,
      defaultCookTime: component.defaultCookTime ?? null,
      typicalIngredients: (component.typicalIngredients as Ingredient[]) || [],
    })
    setPrepMethodInput('')
    setDialogOpen(true)
  }

  const handleAddPrepMethod = () => {
    const method = prepMethodInput.trim()
    if (method && !form.prepMethods.includes(method)) {
      setForm(prev => ({ ...prev, prepMethods: [...prev.prepMethods, method] }))
      setPrepMethodInput('')
    }
  }

  const handleRemovePrepMethod = (method: string) => {
    setForm(prev => ({ ...prev, prepMethods: prev.prepMethods.filter(m => m !== method) }))
  }

  const handleSuggestIngredients = async () => {
    setIsSuggesting(true)
    try {
      const response = await fetch('/api/settings/meal-components/suggest-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          prepMethods: form.prepMethods,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setForm(prev => ({ ...prev, typicalIngredients: data.ingredients }))
      }
    } catch (error) {
      console.error('Error suggesting ingredients:', error)
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleAddIngredient = () => {
    setForm(prev => ({
      ...prev,
      typicalIngredients: [...prev.typicalIngredients, { name: '', quantity: null, unit: null }],
    }))
  }

  const handleUpdateIngredient = (index: number, field: keyof Ingredient, value: string | number | null) => {
    setForm(prev => ({
      ...prev,
      typicalIngredients: prev.typicalIngredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }))
  }

  const handleRemoveIngredient = (index: number) => {
    setForm(prev => ({
      ...prev,
      typicalIngredients: prev.typicalIngredients.filter((_, i) => i !== index),
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setIsSaving(true)

    try {
      const payload = {
        category: form.category,
        name: form.name.trim(),
        prepMethods: form.prepMethods,
        defaultCookTime: form.defaultCookTime,
        typicalIngredients: form.typicalIngredients.filter(i => i.name.trim()),
      }

      if (editingId) {
        const response = await fetch(`/api/settings/meal-components/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const updated = await response.json()
          setComponents(prev => prev.map(c => c.id === editingId ? updated : c))
        }
      } else {
        const response = await fetch('/api/settings/meal-components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const created = await response.json()
          setComponents(prev => [...prev, created])
        }
      }
      setDialogOpen(false)
    } catch (error) {
      console.error('Error saving component:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/meal-components/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setComponents(prev => prev.filter(c => c.id !== id))
      }
    } catch (error) {
      console.error('Error deleting component:', error)
    }
  }

  const filteredComponents = filterCategory === 'ALL'
    ? components
    : components.filter(c => c.category === filterCategory)

  const componentsByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = components.filter(c => c.category === cat)
    return acc
  }, {} as Record<ComponentCategory, MealComponent[]>)

  const ComponentCard = ({ component }: { component: MealComponent }) => {
    const Icon = CATEGORY_ICONS[component.category]
    const ingredients = (component.typicalIngredients as Ingredient[]) || []

    return (
      <div className="flex items-start justify-between p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{component.name}</span>
            {viewMode === 'list' && (
              <Badge variant="outline" className={cn('text-xs', CATEGORY_COLORS[component.category])}>
                {CATEGORY_LABELS[component.category]}
              </Badge>
            )}
          </div>
          {component.prepMethods.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {component.prepMethods.map(method => (
                <Badge key={method} variant="secondary" className="text-xs">
                  {method}
                </Badge>
              ))}
            </div>
          )}
          {ingredients.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {ingredients.map(i => i.name).join(', ')}
            </p>
          )}
          {component.defaultCookTime && (
            <p className="text-xs text-muted-foreground mt-0.5">
              ~{component.defaultCookTime} min
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(component)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(component.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Components</h1>
          <p className="text-muted-foreground">
            Build your library of proteins, veggies, starches, and sauces for dynamic meals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'tabs' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('tabs')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => openAddDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Component
          </Button>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">All Components ({components.length})</CardTitle>
              <Select
                value={filterCategory}
                onValueChange={(v) => setFilterCategory(v as ComponentCategory | 'ALL')}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredComponents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No components yet. Add your first one!
              </p>
            ) : (
              <div className="space-y-2">
                {filteredComponents.map(c => <ComponentCard key={c.id} component={c} />)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabbed View */}
      {viewMode === 'tabs' && (
        <Tabs defaultValue="PROTEIN">
          <TabsList className="grid w-full grid-cols-4">
            {CATEGORIES.map(cat => {
              const Icon = CATEGORY_ICONS[cat]
              return (
                <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {CATEGORY_LABELS[cat]} ({componentsByCategory[cat].length})
                </TabsTrigger>
              )
            })}
          </TabsList>
          {CATEGORIES.map(cat => (
            <TabsContent key={cat} value={cat}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{CATEGORY_LABELS[cat]}</CardTitle>
                    <Button size="sm" onClick={() => openAddDialog(cat)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add {CATEGORY_LABELS[cat].replace(/s$/, '')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {componentsByCategory[cat].length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No {CATEGORY_LABELS[cat].toLowerCase()} yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {componentsByCategory[cat].map(c => <ComponentCard key={c.id} component={c} />)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Component' : 'Add Component'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update this meal component.' : 'Add a new ingredient to your dynamic meals library.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category */}
            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm(prev => ({ ...prev, category: v as ComponentCategory }))}
                disabled={!!editingId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat].replace(/s$/, '')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="component-name">Name</Label>
              <Input
                id="component-name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Chicken Breast"
                className="mt-1.5"
              />
            </div>

            {/* Prep Methods */}
            <div>
              <Label>Prep Methods</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={prepMethodInput}
                  onChange={(e) => setPrepMethodInput(e.target.value)}
                  placeholder="e.g. Grilled"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddPrepMethod()
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={handleAddPrepMethod} disabled={!prepMethodInput.trim()}>
                  Add
                </Button>
              </div>
              {form.prepMethods.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.prepMethods.map(method => (
                    <Badge key={method} variant="secondary" className="gap-1">
                      {method}
                      <button onClick={() => handleRemovePrepMethod(method)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Cook Time */}
            <div>
              <Label htmlFor="cook-time">Default Cook Time (minutes)</Label>
              <Input
                id="cook-time"
                type="number"
                value={form.defaultCookTime ?? ''}
                onChange={(e) => setForm(prev => ({ ...prev, defaultCookTime: e.target.value ? Number(e.target.value) : null }))}
                placeholder="15"
                className="mt-1.5 w-32"
              />
            </div>

            {/* Typical Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Typical Ingredients</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestIngredients}
                  disabled={!form.name.trim() || isSuggesting}
                >
                  {isSuggesting ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                  )}
                  {isSuggesting ? 'Suggesting...' : 'Suggest Ingredients'}
                </Button>
              </div>
              <div className="space-y-2">
                {form.typicalIngredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={ing.name}
                      onChange={(e) => handleUpdateIngredient(i, 'name', e.target.value)}
                      placeholder="Ingredient name"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={ing.quantity ?? ''}
                      onChange={(e) => handleUpdateIngredient(i, 'quantity', e.target.value ? Number(e.target.value) : null)}
                      placeholder="Qty"
                      className="w-20"
                    />
                    <Input
                      value={ing.unit ?? ''}
                      onChange={(e) => handleUpdateIngredient(i, 'unit', e.target.value || null)}
                      placeholder="Unit"
                      className="w-20"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemoveIngredient(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={handleAddIngredient}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add Ingredient
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
