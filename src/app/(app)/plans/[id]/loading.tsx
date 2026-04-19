import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function PlanDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40 mt-2" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-8" />
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, day) => (
          <div key={day} className="space-y-2">
            <Skeleton className="h-5 w-full" />
            {Array.from({ length: 3 }).map((_, meal) => (
              <Card key={meal}>
                <CardContent className="p-3">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-5 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
