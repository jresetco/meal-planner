'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Upload, Trash2, Calendar, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import type { HistoricalPlan } from '@/types'

interface HistoricalUploadProps {
  historicalPlans: HistoricalPlan[]
  onUpload: () => void
}

export function HistoricalUpload({ historicalPlans, onUpload }: HistoricalUploadProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [rawData, setRawData] = useState('')
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleUpload = async () => {
    if (!rawData.trim()) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      const response = await fetch('/api/settings/historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawData: rawData.trim(),
          source: 'table',
          description: description.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadResult({
          success: true,
          message: data.message,
        })
        setRawData('')
        setDescription('')
        onUpload()
        
        // Close dialog after success
        setTimeout(() => {
          setIsDialogOpen(false)
          setUploadResult(null)
        }, 2000)
      } else {
        setUploadResult({
          success: false,
          message: data.error || 'Failed to upload data',
        })
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Network error. Please try again.',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(id)

    try {
      const response = await fetch(`/api/settings/historical?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onUpload()
      }
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Historical Meal Plans
        </CardTitle>
        <CardDescription>
          Upload past meal plans to help the AI learn your preferences and patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing uploads */}
        {historicalPlans.length > 0 && (
          <div className="space-y-2">
            <Label>Uploaded History</Label>
            <ScrollArea className="h-[150px] rounded-md border p-2">
              <div className="space-y-2">
                {historicalPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {plan.description || 'Imported meal history'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {plan.weekCount} week{plan.weekCount !== 1 ? 's' : ''}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          Imported {formatDate(plan.importedAt)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(plan.id)}
                      disabled={isDeleting === plan.id}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      {isDeleting === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Upload button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Historical Data
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Historical Meal Plan</DialogTitle>
              <DialogDescription>
                Paste your meal plan data in a table format. The AI will parse it automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Example format */}
              <div className="bg-slate-50 rounded-lg p-4 text-sm">
                <div className="font-medium mb-2">Example Format:</div>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
{`|     | B              | L                  | D                    |
|-----|----------------|--------------------|--------------------- |
| Sat |                |                    | Chicken & Veggies    |
| Sun |                | Lunch Wrap (LO Chx)| Buddha bowl          |
| Mon |                | LO Buddha Bowl     | Tilapia & Green beans|
| Tue |                | Lunch Wrap (Chx)   | LO Tilapia & veg     |
| Wed |                | Hippie Bowl x2     | Sausage & Pepper pasta|`}
                </pre>
                <div className="mt-2 text-xs text-slate-500">
                  <strong>Tips:</strong> Use "LO" for leftovers, include notes like "x2" or "(SLOW)" for special instructions.
                  Restaurant names will be detected automatically.
                </div>
              </div>

              {/* Description input */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., December 2025 meal plan"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Data input */}
              <div className="space-y-2">
                <Label htmlFor="rawData">Meal Plan Data</Label>
                <Textarea
                  id="rawData"
                  placeholder="Paste your meal plan table here..."
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>

              {/* Upload result */}
              {uploadResult && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg ${
                    uploadResult.success
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="text-sm">{uploadResult.message}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!rawData.trim() || isUploading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Parse
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info text */}
        <p className="text-sm text-slate-500">
          The AI uses your historical data to understand patterns like which meals you prefer on weekends,
          how often you use leftovers, and your typical cooking style.
        </p>
      </CardContent>
    </Card>
  )
}
