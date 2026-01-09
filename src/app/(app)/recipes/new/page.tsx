'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import Link from 'next/link'
import { INGREDIENT_UNITS } from '@/lib/constants'
import { FoodIconPicker, FoodIcon } from '@/components/recipes/food-icon-picker'

interface Ingredient {
  name: string
  quantity: string
  unit: string
}

export default function NewRecipePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [servings, setServings] = useState(2)
  const [prepTime, setPrepTime] = useState<number | undefined>()
  const [cookTime, setCookTime] = useState<number | undefined>()
  const [rating, setRating] = useState<number | undefined>()
  const [categories, setCategories] = useState('')
  const [notes, setNotes] = useState('')
  const [icon, setIcon] = useState<string | undefined>()
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: '', unit: '' },
  ])

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '' }])
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients]
    updated[index][field] = value
    setIngredients(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          instructions,
          servings,
          prepTime,
          cookTime,
          rating,
          notes,
          icon,
          categories: categories.split(',').map(c => c.trim()).filter(Boolean),
          ingredients: ingredients
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name,
              quantity: parseFloat(i.quantity) || undefined,
              unit: i.unit || undefined,
            })),
        }),
      })

      if (response.ok) {
        router.push('/recipes')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create recipe')
      }
    } catch (error) {
      console.error('Error creating recipe:', error)
      alert('Failed to create recipe')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/recipes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Recipe</h1>
          <p className="text-muted-foreground">
            Create a new custom recipe
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Recipe Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Pasta Carbonara"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of the dish"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Servings</label>
                <Input
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) => setServings(parseInt(e.target.value) || 2)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Rating (1-5)</label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={rating || ''}
                  onChange={(e) => setRating(parseInt(e.target.value) || undefined)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prep Time (min)</label>
                <Input
                  type="number"
                  min={0}
                  value={prepTime || ''}
                  onChange={(e) => setPrepTime(parseInt(e.target.value) || undefined)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cook Time (min)</label>
                <Input
                  type="number"
                  min={0}
                  value={cookTime || ''}
                  onChange={(e) => setCookTime(parseInt(e.target.value) || undefined)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recipe Icon */}
        <Card>
          <CardHeader>
            <CardTitle>Recipe Icon</CardTitle>
            <CardDescription>
              Choose an icon to represent this recipe (optional - can be used instead of an image)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FoodIconPicker value={icon} onChange={setIcon} />
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <CardDescription>
              Add ingredients with quantities and units
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <div key={index} className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Input
                  placeholder="Qty"
                  value={ingredient.quantity}
                  onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                  className="w-16"
                />
                <Select
                  value={ingredient.unit}
                  onValueChange={(value) => updateIngredient(index, 'unit', value === '_empty' ? '' : value)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {INGREDIENT_UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value || '_empty'}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Ingredient name"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                  className="flex-1 min-w-[150px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(index)}
                  disabled={ingredients.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addIngredient}>
              <Plus className="mr-2 h-4 w-4" />
              Add Ingredient
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step cooking instructions..."
              rows={6}
            />
          </CardContent>
        </Card>

        {/* Categories & Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Categories & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Categories</label>
              <Input
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="e.g., Italian, Quick Meals, Vegetarian (comma-separated)"
              />
              <p className="text-xs text-muted-foreground mt-1">Separate multiple categories with commas</p>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this recipe..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/recipes">Cancel</Link>
          </Button>
          <Button type="submit" disabled={!name.trim() || isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Save Recipe'}
          </Button>
        </div>
      </form>
    </div>
  )
}
