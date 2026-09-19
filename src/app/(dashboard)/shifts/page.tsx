import type { Metadata } from "next";
import { Suspense } from "react";
import { ShiftsView } from "@/frontend/components/features/shifts/shifts-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Shifts" };

export default function ShiftsPage() {
  // The view reads `?attendant=` so the attendants screen can send an officer
  // straight to the open shift that is blocking a deactivation, transfer or
  // removal. A client component that reads the query string has to sit behind a
  // boundary or the production build refuses to prerender the page — same shape
  // as the attendants and settlements routes.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <ShiftsView />
    </Suspense>
  );
}
