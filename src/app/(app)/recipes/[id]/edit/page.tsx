'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { STORE_SECTIONS } from '@/lib/constants'

interface Ingredient {
  name: string
  quantity: string
  unit: string
  section: string
}

interface Recipe {
  id: string
  name: string
  description?: string | null
  source: string
  rating?: number | null
  totalTime?: number | null
  prepTime?: number | null
  cookTime?: number | null
  imageUrl?: string | null
  categories: string[]
  servings: number
  ingredients: Array<{
    name: string
    quantity?: number
    unit?: string
    section?: string
  }>
  instructions?: string | null
  notes?: string | null
}

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
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
  const [imageUrl, setImageUrl] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: '', unit: '', section: 'PRODUCE' },
  ])

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const response = await fetch(`/api/recipes/${id}`)
        if (response.ok) {
          const recipe: Recipe = await response.json()
          setName(recipe.name)
          setDescription(recipe.description || '')
          setInstructions(recipe.instructions || '')
          setServings(recipe.servings)
          setPrepTime(recipe.prepTime || undefined)
          setCookTime(recipe.cookTime || undefined)
          setRating(recipe.rating || undefined)
          setCategories(recipe.categories.join(', '))
          setNotes(recipe.notes || '')
          setImageUrl(recipe.imageUrl || '')
          
          if (recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
            setIngredients(recipe.ingredients.map(i => ({
              name: i.name || '',
              quantity: i.quantity?.toString() || '',
              unit: i.unit || '',
              section: i.section || 'PRODUCE',
            })))
          }
        } else if (response.status === 404) {
          router.push('/recipes')
        }
      } catch (error) {
        console.error('Error fetching recipe:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRecipe()
  }, [id, router])

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '', section: 'PRODUCE' }])
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
      const response = await fetch(`/api/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          instructions: instructions || null,
          servings,
          prepTime: prepTime || null,
          cookTime: cookTime || null,
          rating: rating || null,
          notes: notes || null,
          imageUrl: imageUrl || null,
          categories: categories.split(',').map(c => c.trim()).filter(Boolean),
          ingredients: ingredients
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name,
              quantity: parseFloat(i.quantity) || undefined,
              unit: i.unit || undefined,
              section: i.section,
            })),
        }),
      })

      if (response.ok) {
        router.push(`/recipes/${id}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update recipe')
      }
    } catch (error) {
      console.error('Error updating recipe:', error)
      alert('Failed to update recipe')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/recipes/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Recipe</h1>
          <p className="text-muted-foreground">
            Update recipe details
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
            <div>
              <label className="text-sm font-medium">Image URL</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
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

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <CardDescription>
              Add ingredients with quantities, units, and store section for grocery list organization
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
                <Input
                  placeholder="Unit"
                  value={ingredient.unit}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  className="w-20"
                />
                <Input
                  placeholder="Ingredient name"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                  className="flex-1 min-w-[150px]"
                />
                <Select
                  value={ingredient.section}
                  onChange={(e) => updateIngredient(index, 'section', e.target.value)}
                  options={[...STORE_SECTIONS]}
                  className="w-36"
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
            <Link href={`/recipes/${id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={!name.trim() || isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
