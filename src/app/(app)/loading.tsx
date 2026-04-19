import { Skeleton } from '@/components/ui/skeleton'
import { StatCardSkeleton, ActivityCardSkeleton } from '@/components/dashboard/skeletons'

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <ActivityCardSkeleton />
        <ActivityCardSkeleton />
      </div>
    </div>
  )
}
