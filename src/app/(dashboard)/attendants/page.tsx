import type { Metadata } from "next";
import { Suspense } from "react";
import { AttendantsView } from "@/frontend/components/features/attendants/attendants-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Attendants" };

export default function AttendantsPage() {
  // The view reads `?vendor=` so the vendor screen can send an officer straight
  // into "add an attendant for this operator". A client component that reads
  // the query string has to sit behind a boundary or the production build
  // refuses to prerender the page — same shape as the settlements route.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <AttendantsView />
    </Suspense>
  );
}
