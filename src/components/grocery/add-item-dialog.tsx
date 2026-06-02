'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { STORE_SECTION_LABELS } from '@/types'
import type { StoreSection } from '@/types'

export interface AddItemValues {
  name: string
  quantity?: number
  unit?: string
  section: StoreSection
}

interface AddItemDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: AddItemValues) => Promise<void>
}

const SECTIONS = Object.keys(STORE_SECTION_LABELS) as StoreSection[]

export function AddItemDialog({ open, onClose, onSubmit }: AddItemDialogProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [section, setSection] = useState<StoreSection>('OTHER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setQuantity('')
    setUnit('')
    setSection('OTHER')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }
    const qty = quantity.trim() ? Number(quantity) : undefined
    if (qty !== undefined && (Number.isNaN(qty) || qty < 0)) {
      setError('Quantity must be a positive number')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: trimmed,
        quantity: qty,
        unit: unit.trim() || undefined,
        section,
      })
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-600" />
            Add a custom item
          </DialogTitle>
          <DialogDescription>
            Add a one-off item to this grocery list. For items you always need, set up a
            recurring buy in Settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-name">Item</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Greek yogurt"
              autoFocus
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="add-qty">Quantity (optional)</Label>
              <Input
                id="add-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-unit">Unit (optional)</Label>
              <Input
                id="add-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="lb / cups / cans"
                maxLength={40}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-section">Section</Label>
            <Select value={section} onValueChange={(v) => setSection(v as StoreSection)}>
              <SelectTrigger id="add-section">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{STORE_SECTION_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
