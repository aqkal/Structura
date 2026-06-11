import { Skeleton } from "@/components/ui/skeleton";

export default function SessionLoading() {
  return (
    <div className="flex flex-col">
      <div className="w-full">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-7 w-3/4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-[22px] w-full rounded-full" />
          <div className="glass flex flex-col gap-4 rounded-[var(--radius-lg)] p-5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="h-[120px] w-full rounded-[var(--radius-md)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
