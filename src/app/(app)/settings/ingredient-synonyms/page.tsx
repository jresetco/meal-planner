'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Trash2, ArrowRight, Merge } from 'lucide-react'

interface Synonym {
  id: string
  fromName: string
  toName: string
}

export default function IngredientSynonymsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Synonym[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    try {
      const res = await fetch('/api/settings/ingredient-synonyms', { cache: 'no-store' })
      if (res.ok) {
        setItems(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch synonyms', e)
    } finally {
      setIsLoading(false)
    }
  }

  const resetDraft = () => {
    setDraftFrom('')
    setDraftTo('')
    setError(null)
  }

  async function handleAdd() {
    const fromName = draftFrom.trim()
    const toName = draftTo.trim()
    if (!fromName) { setError('"From" name is required'); return }
    if (!toName) { setError('"To" name is required'); return }
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/ingredient-synonyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromName, toName }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to add synonym')
      }
      resetDraft()
      await fetchItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add synonym')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(item: Synonym) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    try {
      const res = await fetch(`/api/settings/ingredient-synonyms/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
    } catch (e) {
      console.error(e)
      await fetchItems()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Merge className="h-6 w-6 text-emerald-600" />
            Ingredient Synonyms
          </h1>
          <p className="text-muted-foreground text-sm">
            {items.length} mapping{items.length === 1 ? '' : 's'} · merged before each grocery list is built
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a synonym</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rename one ingredient to another before the list is generated, so variants merge
            into a single line (e.g. &quot;spring onions&quot; → &quot;green onions&quot;).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="syn-from">From (variant)</Label>
              <Input
                id="syn-from"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                placeholder="e.g. spring onions"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="syn-to">To (canonical)</Label>
              <Input
                id="syn-to"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                placeholder="e.g. green onions"
                maxLength={200}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetDraft} disabled={adding}>Clear</Button>
            <Button onClick={handleAdd} disabled={adding || !draftFrom.trim() || !draftTo.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your synonyms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No synonyms yet. Add one above to merge ingredient variants automatically.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                    <span className="font-medium break-words">{item.fromName}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium break-words text-emerald-700">{item.toName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item)}
                    aria-label={`Delete ${item.fromName} synonym`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
