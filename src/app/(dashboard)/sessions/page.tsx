import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionsView } from "@/frontend/components/features/sessions/sessions-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Parking sessions" };

export default function SessionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SessionsView />
    </Suspense>
  );
}
