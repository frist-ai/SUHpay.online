'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function CatalogSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header with Search - Fixed at top */}
      <div className="relative z-50 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Category Menu */}
      <div className="shrink-0 bg-background border-b">
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          <Skeleton className="h-9 w-14 rounded-full shrink-0" />
          <Skeleton className="h-9 w-28 rounded-full shrink-0" />
          <Skeleton className="h-9 w-24 rounded-full shrink-0" />
          <Skeleton className="h-9 w-20 rounded-full shrink-0" />
          <Skeleton className="h-9 w-24 rounded-full shrink-0" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-4 space-y-4">
          {/* Banners Skeleton */}
          <div className="relative">
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>

          {/* Section 1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-3 p-3 rounded-xl border bg-card">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-3 p-3 rounded-xl border bg-card">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-3 p-3 rounded-xl border bg-card">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
