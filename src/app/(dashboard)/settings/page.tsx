import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "@/frontend/components/features/settings/settings-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SettingsView />
    </Suspense>
  );
}
