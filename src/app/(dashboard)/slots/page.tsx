import type { Metadata } from "next";
import { Suspense } from "react";
import { SlotsView } from "@/frontend/components/features/slots/slots-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Parking slots" };

export default function SlotsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SlotsView />
    </Suspense>
  );
}
