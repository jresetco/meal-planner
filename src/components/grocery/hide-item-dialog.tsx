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
import { EyeOff } from 'lucide-react'

interface HideItemDialogProps {
  open: boolean
  itemName: string | null
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function HideItemDialog({ open, itemName, onCancel, onConfirm }: HideItemDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-amber-600" />
            Hide “{itemName}” permanently?
          </DialogTitle>
          <DialogDescription>
            This adds <span className="font-medium">{itemName}</span> to your pantry staples
            and excludes it from this list and all future grocery lists. You can re-enable it
            anytime in Settings → Pantry Staples.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Hiding…' : 'Hide permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
