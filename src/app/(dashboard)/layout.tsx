// A client boundary for the route guard below. Nothing in this layout was ever
// server work — the sidebar, header and sidebar provider are all client
// components already — and the pages it wraps stay server components, arriving
// as the `children` prop with their own metadata intact.
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { SidebarInset, SidebarProvider } from "@/frontend/components/ui/sidebar";
import { AppSidebar } from "@/frontend/components/layout/app-sidebar";
import { AppHeader } from "@/frontend/components/layout/app-header";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { NOT_PERMITTED } from "@/frontend/components/shared/can";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { mayOpen, navItemForPath, visibleNavGroups } from "@/frontend/lib/navigation";

/**
 * The gate the edge cannot be: see the long note at the top of `src/proxy.ts`.
 * A bookmarked /settlements is a URL an Attendant can type, and until now it
 * rendered the whole screen and then filled it with 403s. Here the answer comes
 * from the permissions /auth/me resolved — the same rows the API's guards read —
 * so the page is never built in the first place.
 *
 * It is a courtesy, not a boundary. Anyone can edit this out of the bundle; the
 * data stays where it is, because every request underneath still carries a
 * bearer token the API judges for itself.
 */
function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const permissions = usePermissions();
  const item = navItemForPath(pathname);

  /**
   * While the principal is in flight `can()` denies, which is right for a
   * button and wrong for a whole page — holding every navigation until
   * /auth/me returns would make the portal feel slower for exactly the people
   * who are allowed in. The pages show their own skeletons meanwhile, and
   * nothing of substance can reach the screen without the API agreeing to it.
   */
  if (!permissions.isReady || !item || mayOpen(item, permissions)) return <>{children}</>;

  /**
   * Somewhere they can actually go, rather than a hardcoded /dashboard that a
   * Citizen account — which holds nothing at all — would bounce straight back
   * off. And no automatic redirect: being moved without explanation is how a
   * permission problem gets mistaken for a broken link, and reported as one.
   */
  const elsewhere = visibleNavGroups(permissions)[0]?.items[0];

  return (
    <EmptyState
      icon={ShieldAlert}
      title={`${item.label} is not yours to open`}
      description={`${NOT_PERMITTED} Ask an administrator if you need it.`}
      action={
        elsewhere ? (
          <Button asChild variant="outline" size="sm">
            <Link href={elsewhere.href}>Go to {elsewhere.label}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AppHeader />
        <div className="flex-1 space-y-6 p-4 sm:p-6">
          <RouteGuard>{children}</RouteGuard>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
