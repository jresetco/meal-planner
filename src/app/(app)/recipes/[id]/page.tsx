'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Trash2, Star, Clock, Users, ChefHat } from 'lucide-react'
import Link from 'next/link'
import { FoodIcon } from '@/components/recipes/food-icon-picker'

interface Ingredient {
  name: string
  quantity?: number
  unit?: string
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
  icon?: string | null
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

  const formatIngredient = (ingredient: Ingredient) => {
    const parts = []
    if (ingredient.quantity) parts.push(ingredient.quantity)
    if (ingredient.unit) parts.push(ingredient.unit)
    parts.push(ingredient.name)
    return parts.join(' ')
  }

  // Simple list of ingredients
  const ingredientsList = recipe?.ingredients || []

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
                <div className="flex gap-2 p-2 bg-destructive/10 rounded-lg border-2 border-destructive">
                  <Button 
                    variant="destructive" 
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    Yes, Delete
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setDeleteConfirm(false)}
                    className="border-red-300 text-red-700 hover:bg-red-50 font-semibold"
                  >
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
            {(recipe.totalTime || recipe.prepTime || recipe.cookTime) && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {recipe.totalTime
                    ? `${recipe.totalTime} min`
                    : recipe.prepTime && recipe.cookTime
                      ? `${recipe.prepTime + recipe.cookTime} min`
                      : null}
                </span>
                {(recipe.prepTime || recipe.cookTime) && (
                  <span className="text-xs">
                    ({[
                      recipe.prepTime && `${recipe.prepTime} prep`,
                      recipe.cookTime && `${recipe.cookTime} cook`,
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
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

      {/* Image or Icon */}
      {recipe.imageUrl ? (
        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </div>
      ) : recipe.icon ? (
        <div className="flex justify-center py-8">
          <div className="p-6 bg-muted rounded-full">
            <FoodIcon name={recipe.icon} className="h-16 w-16 text-muted-foreground" />
          </div>
        </div>
      ) : null}

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Ingredients
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ingredientsList.length === 0 ? (
            <p className="text-muted-foreground">No ingredients listed</p>
          ) : (
            <ul className="space-y-2">
              {ingredientsList.map((ingredient, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/50 shrink-0" />
                  <span>{formatIngredient(ingredient)}</span>
                </li>
              ))}
            </ul>
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
