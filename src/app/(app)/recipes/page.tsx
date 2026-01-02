'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Star, ChefHat, Clock, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  
  // In a real app, this would fetch from the API
  const recipes: any[] = []

  const handleSyncPaprika = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/recipes/sync-paprika', { method: 'POST' })
      if (response.ok) {
        // Refresh the page or recipes list
        window.location.reload()
      }
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
          <p className="text-muted-foreground">
            Manage your recipe library
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
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Recipes Grid */}
      {recipes.length === 0 ? (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden">
              {recipe.imageUrl && (
                <div className="aspect-video bg-muted">
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{recipe.name}</CardTitle>
                  {recipe.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{recipe.rating}</span>
                    </div>
                  )}
                </div>
                <CardDescription className="line-clamp-2">
                  {recipe.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {recipe.totalTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {recipe.totalTime} min
                    </div>
                  )}
                  <Badge variant="outline">{recipe.source}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
