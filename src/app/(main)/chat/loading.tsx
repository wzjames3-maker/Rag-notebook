import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] -mt-4 -mx-4 lg:-mt-6 lg:-mx-6">
      <aside className="hidden lg:block w-64 shrink-0 border-r bg-muted/20 p-3 space-y-2">
        <Skeleton className="h-7 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </aside>

      <div className="flex flex-1 flex-col min-w-0 bg-background">
        <div className="flex items-center border-b px-4 py-2">
          <Skeleton className="h-5 w-32" />
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl space-y-4">
            <div className="flex justify-end">
              <Skeleton className="h-10 w-64 rounded-2xl" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-20 w-80 rounded-2xl" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-16 w-72 rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="border-t p-4">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
