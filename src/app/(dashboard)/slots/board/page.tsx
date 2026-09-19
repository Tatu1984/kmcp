import type { Metadata } from "next";
import { Suspense } from "react";
import { BayBoardView } from "@/frontend/components/features/slots/bay-board-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Bay board" };

export default function BayBoardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <BayBoardView />
    </Suspense>
  );
}
