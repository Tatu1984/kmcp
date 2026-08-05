import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/frontend/components/features/auth/login-form";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <LoginForm />
    </Suspense>
  );
}
