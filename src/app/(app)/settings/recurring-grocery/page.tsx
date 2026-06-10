'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Trash2, Repeat } from 'lucide-react'
import { STORE_SECTION_LABELS } from '@/types'
import type { StoreSection } from '@/types'

interface RecurringItem {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  section: StoreSection
  notes: string | null
  isActive: boolean
}

const SECTIONS = Object.keys(STORE_SECTION_LABELS) as StoreSection[]

export default function RecurringGroceryPage() {
  const router = useRouter()
  const [items, setItems] = useState<RecurringItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftName, setDraftName] = useState('')
  const [draftQty, setDraftQty] = useState('')
  const [draftUnit, setDraftUnit] = useState('')
  const [draftSection, setDraftSection] = useState<StoreSection>('OTHER')
  const [draftNotes, setDraftNotes] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    try {
      const res = await fetch('/api/settings/recurring-grocery', { cache: 'no-store' })
      if (res.ok) {
        setItems(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch recurring items', e)
    } finally {
      setIsLoading(false)
    }
  }

  const resetDraft = () => {
    setDraftName('')
    setDraftQty('')
    setDraftUnit('')
    setDraftSection('OTHER')
    setDraftNotes('')
    setError(null)
  }

  async function handleAdd() {
    const name = draftName.trim()
    if (!name) { setError('Name is required'); return }
    const qty = draftQty.trim() ? Number(draftQty) : null
    if (qty !== null && (Number.isNaN(qty) || qty < 0)) {
      setError('Quantity must be a positive number'); return
    }
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/recurring-grocery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          quantity: qty,
          unit: draftUnit.trim() || null,
          section: draftSection,
          notes: draftNotes.trim() || null,
          isActive: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to add recurring item')
      }
      resetDraft()
      await fetchItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add recurring item')
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleActive(item: RecurringItem) {
    const next = !item.isActive
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: next } : i))
    try {
      await fetch(`/api/settings/recurring-grocery/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
    } catch (e) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: !next } : i))
      console.error(e)
    }
  }

  async function handleDelete(item: RecurringItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    try {
      const res = await fetch(`/api/settings/recurring-grocery/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
    } catch (e) {
      console.error(e)
      await fetchItems()
    }
  }

  const activeCount = items.filter(i => i.isActive).length

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6 text-emerald-600" />
            Recurring Grocery Items
          </h1>
          <p className="text-muted-foreground text-sm">
            {activeCount} active · automatically added to every new grocery list
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a recurring item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-name">Item</Label>
              <Input
                id="rec-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Whole milk"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-section">Section</Label>
              <Select value={draftSection} onValueChange={(v) => setDraftSection(v as StoreSection)}>
                <SelectTrigger id="rec-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{STORE_SECTION_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-qty">Quantity (optional)</Label>
              <Input
                id="rec-qty"
                inputMode="decimal"
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-unit">Unit (optional)</Label>
              <Input
                id="rec-unit"
                value={draftUnit}
                onChange={(e) => setDraftUnit(e.target.value)}
                placeholder="gallon / lb / cans"
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="rec-notes">Notes (optional)</Label>
              <Input
                id="rec-notes"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="e.g. Costco brand only"
                maxLength={500}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetDraft} disabled={adding}>Clear</Button>
            <Button onClick={handleAdd} disabled={adding || !draftName.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your recurring items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No recurring items yet. Add one above and it will appear in every new grocery list.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <Switch
                    checked={item.isActive}
                    onCheckedChange={() => handleToggleActive(item)}
                    aria-label={`Toggle ${item.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${item.isActive ? '' : 'text-muted-foreground line-through'}`}>
                      {item.name}
                      {(item.quantity || item.unit) && (
                        <span className="text-muted-foreground text-xs ml-2">
                          {item.quantity ?? ''}{item.unit ? ` ${item.unit}` : ''}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {STORE_SECTION_LABELS[item.section]}
                      {item.notes && ` · ${item.notes}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item)}
                    aria-label={`Delete ${item.name}`}
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
