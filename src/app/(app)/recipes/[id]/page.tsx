'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Trash2, Star, Clock, Users, ChefHat } from 'lucide-react'
import Link from 'next/link'
import { STORE_SECTIONS } from '@/lib/constants'

interface Ingredient {
  name: string
  quantity?: number
  unit?: string
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
  ingredients: Ingredient[]
  instructions?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export default function RecipeViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const response = await fetch(`/api/recipes/${id}`)
        if (response.ok) {
          const data = await response.json()
          setRecipe(data)
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

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
      if (response.ok) {
        router.push('/recipes')
      }
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const getSectionLabel = (section: string) => {
    return STORE_SECTIONS.find(s => s.value === section)?.label || section
  }

  const formatIngredient = (ingredient: Ingredient) => {
    const parts = []
    if (ingredient.quantity) parts.push(ingredient.quantity)
    if (ingredient.unit) parts.push(ingredient.unit)
    parts.push(ingredient.name)
    return parts.join(' ')
  }

  // Group ingredients by store section
  const groupedIngredients = recipe?.ingredients?.reduce((acc, ingredient) => {
    const section = ingredient.section || 'OTHER'
    if (!acc[section]) acc[section] = []
    acc[section].push(ingredient)
    return acc
  }, {} as Record<string, Ingredient[]>) || {}

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Recipe not found</p>
        <Button asChild className="mt-4">
          <Link href="/recipes">Back to Recipes</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/recipes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{recipe.name}</h1>
              {recipe.description && (
                <p className="text-muted-foreground mt-1">{recipe.description}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" asChild>
                <Link href={`/recipes/${recipe.id}/edit`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              {deleteConfirm ? (
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleDelete}>
                    Confirm Delete
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {recipe.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{recipe.rating}/5</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{recipe.servings} servings</span>
            </div>
            {recipe.totalTime && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{recipe.totalTime} min total</span>
                {recipe.prepTime && <span>({recipe.prepTime} prep)</span>}
              </div>
            )}
            <Badge variant="outline">{recipe.source.replace(/_/g, ' ')}</Badge>
          </div>

          {/* Categories */}
          {recipe.categories.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {recipe.categories.map((cat) => (
                <Badge key={cat} variant="secondary">
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image */}
      {recipe.imageUrl && (
        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Ingredients
          </CardTitle>
          <CardDescription>Organized by store section for easier shopping</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedIngredients).length === 0 ? (
            <p className="text-muted-foreground">No ingredients listed</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedIngredients).map(([section, ingredients]) => (
                <div key={section}>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    {getSectionLabel(section)}
                  </h4>
                  <ul className="space-y-1">
                    {ingredients.map((ingredient, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary/50" />
                        {formatIngredient(ingredient)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      {recipe.instructions && (
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {recipe.instructions}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {recipe.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{recipe.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
