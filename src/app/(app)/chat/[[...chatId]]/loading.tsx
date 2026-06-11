import { Skeleton } from "@/components/ui/skeleton";

export default function ChatConversationLoading() {
  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mx-auto flex w-full max-w-[var(--reading-max)] flex-1 flex-col gap-6">
        <div className="ml-auto flex w-full max-w-[80%] justify-end">
          <Skeleton className="h-12 w-3/5 rounded-[var(--radius-lg)]" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="ml-auto flex w-full max-w-[80%] justify-end">
          <Skeleton className="h-10 w-2/5 rounded-[var(--radius-lg)]" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-1/2" />
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
