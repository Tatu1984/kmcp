import type { Metadata } from "next";
import { Suspense } from "react";
import { VendorLoginForm } from "@/frontend/components/features/vendor-portal/vendor-login-form";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Operator sign-in",
  description: "Sign in to the KMCP operator portal.",
};

/**
 * Outside the `(portal)` group on purpose: that group's layout carries the
 * signed-in chrome and the role gate, neither of which belongs on the door.
 */
export default function VendorLoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      {/* useSearchParams needs a suspense boundary to prerender this route. */}
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-sm rounded-xl" />}>
        <VendorLoginForm />
      </Suspense>
    </main>
  );
}
