import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="mx-auto w-full px-4 pt-5 md:px-[var(--space-6)] md:pt-[var(--space-8)]"
      style={{ maxWidth: "var(--content-max)" }}
    >
      <span role="status" className="sr-only">
        Loading
      </span>

      <div className="flex flex-col gap-10" aria-hidden="true">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-3/4 max-w-md" />
        </div>

        <div
          className="glass flex flex-col gap-3 rounded-[var(--radius-lg)] p-[var(--space-6)]"
          style={{ maxWidth: "var(--reading-max)" }}
        >
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-36" />
          <div className="flex flex-wrap gap-3 pt-1">
            <Skeleton className="rounded-pill h-11 w-40" />
            <Skeleton className="rounded-pill h-11 w-44" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-28" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="glass flex flex-col gap-2 rounded-[var(--radius-lg)] p-[var(--space-5)]"
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
