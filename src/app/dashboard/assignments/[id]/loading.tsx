import { cn } from "@/lib/cn";

function Block({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] bg-[var(--color-bg-muted)]",
        className,
      )}
    />
  );
}

export default function AssignmentDetailLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6 xl:p-8" aria-hidden="true">
      <div className="flex items-center gap-2">
        <Block className="h-3 w-20 bg-[var(--color-bg-alt)]" />
        <Block className="h-3 w-24 bg-[var(--color-bg-alt)]" />
        <Block className="h-3 w-32" />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Block className="h-6 w-20 rounded-full" />
              <Block className="h-6 w-24 rounded-full" />
            </div>
            <Block className="h-8 w-3/4" />
            <Block className="h-4 w-1/2 bg-[var(--color-bg-alt)]" />
          </div>
          <div className="flex gap-2">
            <Block className="h-10 w-28" />
            <Block className="h-10 w-32" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
            <div className="border-b border-[var(--color-border)] p-5">
              <Block className="h-5 w-40" />
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Block className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Block className="h-3 w-1/3" />
                    <Block className="h-2 w-2/3 bg-[var(--color-bg-alt)]" />
                  </div>
                  <Block className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5">
            <Block className="mb-4 h-5 w-32" />
            <div className="space-y-3">
              <Block className="h-3 w-full bg-[var(--color-bg-alt)]" />
              <Block className="h-3 w-11/12 bg-[var(--color-bg-alt)]" />
              <Block className="h-3 w-10/12 bg-[var(--color-bg-alt)]" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5">
            <Block className="mb-4 h-5 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Block className="h-3 w-20 bg-[var(--color-bg-alt)]" />
                  <Block className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5">
            <Block className="mb-4 h-5 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Block className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Block className="h-3 w-24" />
                    <Block className="h-2 w-32 bg-[var(--color-bg-alt)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
