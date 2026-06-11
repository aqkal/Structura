import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mx-auto flex w-full max-w-[var(--reading-max)] flex-1 flex-col">
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-4">
          <Skeleton className="h-9 w-72 max-w-full rounded-[var(--radius-sm)]" />
          <Skeleton className="h-5 w-56 max-w-full rounded-[var(--radius-sm)]" />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Skeleton className="h-8 w-28 rounded-[var(--radius-pill)]" />
            <Skeleton className="h-8 w-32 rounded-[var(--radius-pill)]" />
            <Skeleton className="h-8 w-28 rounded-[var(--radius-pill)]" />
          </div>
        </div>
        <div className="mt-auto pb-2">
          <div className="glass flex flex-col gap-2 rounded-[var(--radius-lg)] p-2">
            <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
            <Skeleton className="h-8 w-36 rounded-[var(--radius-pill)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
