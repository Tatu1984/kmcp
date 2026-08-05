import type { Metadata } from "next";
import { Suspense } from "react";
import { TwoFactorForm } from "@/frontend/components/features/auth/two-factor-form";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <TwoFactorForm />
    </Suspense>
  );
}
