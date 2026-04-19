'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Star, ChefHat, Clock, RefreshCw, Edit, Trash2, Eye } from 'lucide-react'
import Link from 'next/link'

interface Recipe {
  id: string
  name: string
  description?: string | null
  source: string
  rating?: number | null
  totalTime?: number | null
  imageUrl?: string | null
  categories: string[]
  servings: number
  prepTime?: number | null
  cookTime?: number | null
}

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchRecipes = useCallback(async () => {
    try {
      const response = await fetch('/api/recipes')
      if (response.ok) {
        const data = await response.json()
        setRecipes(data)
      }
    } catch (error) {
      console.error('Error fetching recipes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  const handleSyncPaprika = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/recipes/sync-paprika', { method: 'POST' })
      if (response.ok) {
        await fetchRecipes()
      }
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setRecipes(recipes.filter(r => r.id !== id))
        setDeleteConfirm(null)
      }
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  // Filter recipes based on search query
  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case 'PAPRIKA':
        return 'default'
      case 'AI_DISCOVERED':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const formatSource = (source: string) => {
    return source.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
          <p className="text-muted-foreground">
            Manage your recipe library ({recipes.length} recipes)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSyncPaprika} disabled={isSyncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Paprika
          </Button>
          <Button asChild>
            <Link href="/recipes/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Recipe
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search recipes by name, description, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRecipes.length === 0 && recipes.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ChefHat className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recipes yet</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-sm">
              Sync your recipes from Paprika or add them manually to get started.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSyncPaprika} disabled={isSyncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync from Paprika
              </Button>
              <Button asChild>
                <Link href="/recipes/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manually
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredRecipes.length === 0 ? (
        /* No Search Results */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recipes found</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              No recipes match &quot;{searchQuery}&quot;. Try a different search term.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Recipes Grid */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden group relative">
              {recipe.imageUrl && (
                <div className="aspect-video bg-muted">
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-1">{recipe.name}</CardTitle>
                  {recipe.rating && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{recipe.rating}</span>
                    </div>
                  )}
                </div>
                {recipe.description && (
                  <CardDescription className="line-clamp-2">
                    {recipe.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                  {recipe.totalTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {recipe.totalTime} min
                    </div>
                  )}
                  <span>{recipe.servings} servings</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getSourceBadgeVariant(recipe.source)}>
                    {formatSource(recipe.source)}
                  </Badge>
                  {recipe.categories.slice(0, 2).map((cat) => (
                    <Badge key={cat} variant="outline">
                      {cat}
                    </Badge>
                  ))}
                  {recipe.categories.length > 2 && (
                    <Badge variant="outline">+{recipe.categories.length - 2}</Badge>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/recipes/${recipe.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/recipes/${recipe.id}/edit`}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  {deleteConfirm === recipe.id ? (
                    <>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDelete(recipe.id)}
                      >
                        Confirm
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setDeleteConfirm(recipe.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
