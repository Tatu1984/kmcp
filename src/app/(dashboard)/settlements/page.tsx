import type { Metadata } from "next";
import { Suspense } from "react";
import { SettlementsView } from "@/frontend/components/features/settlements/settlements-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Settlements" };

export default function SettlementsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SettlementsView />
    </Suspense>
  );
}
