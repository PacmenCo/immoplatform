import { cn } from "@/lib/cn";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] bg-[var(--color-bg-muted)]",
        className,
      )}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6 xl:p-8" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-64" />
          <SkeletonBlock className="h-3 w-40 bg-[var(--color-bg-alt)]" />
        </div>
        <SkeletonBlock className="h-10 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
          >
            <SkeletonBlock className="mb-3 h-3 w-24 bg-[var(--color-bg-alt)]" />
            <SkeletonBlock className="h-8 w-20" />
            <SkeletonBlock className="mt-4 h-2 w-full bg-[var(--color-bg-alt)]" />
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="h-8 w-28" />
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-3 w-1/3" />
                <SkeletonBlock className="h-2 w-1/2 bg-[var(--color-bg-alt)]" />
              </div>
              <SkeletonBlock className="hidden h-3 w-24 sm:block" />
              <SkeletonBlock className="hidden h-3 w-20 md:block" />
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
