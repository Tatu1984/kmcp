// A client boundary, for the same reason `(dashboard)/layout.tsx` is one: the
// gate below reads the principal the API resolved, which only exists in the
// browser. The pages it wraps stay server components and arrive as `children`.
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Coins, LogOut, ShieldAlert, Users } from "lucide-react";

import { ROUTES } from "@/shared/constants/routes";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { useSession } from "@/frontend/hooks/use-session";
import { cn } from "@/lib/utils";

/**
 * The vendor's own portal.
 *
 * Deliberately a separate route group with its own shell rather than a corner
 * of the authority's dashboard. A vendor is a contractor looking at their own
 * business — their zones, their staff, their settlement — and showing them a
 * navigation full of doors they cannot open teaches them the system is mostly
 * refusals. `/vendors` remains the authority's view *of* vendors; this is a
 * vendor's view of itself, and the near-identical URLs are worth the clarity
 * of keeping the two chromes entirely apart.
 */

const NAV = [
  { href: ROUTES.vendorPortal, label: "Today", icon: Building2, exact: true },
  { href: ROUTES.vendorStaff, label: "Staff & pay", icon: Users, exact: false },
  { href: ROUTES.vendorSettlements, label: "Settlements", icon: Coins, exact: false },
] as const;

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useSession();

  /**
   * The gate is the role, not a permission.
   *
   * Every screen underneath is scoped by the API to the caller's own vendor,
   * and the API refuses an account that has no vendor at all — so this is a
   * courtesy that keeps an administrator from landing on a page that would
   * only ever show them an error. It is not the boundary; the boundary is a
   * bearer token the API judges for itself on every request.
   */
  // `user` is null while /auth/me is in flight, so the role is only knowable
  // once loading has finished. Gating on the null alone would flash the refusal
  // below at a vendor on every hard refresh.
  const isVendor = user?.role === "VENDOR";

  if (!isLoading && user && !isVendor) {
    return (
      <div className="mx-auto max-w-2xl p-6 sm:p-10">
        <EmptyState
          icon={ShieldAlert}
          title="This portal belongs to the operators"
          description={
            "You are signed in as a KMC account. Vendor pages show one operator their own " +
            "zones, staff and settlement, and there is no operator here to show. The " +
            "authority's view of every vendor is under Vendors."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={ROUTES.vendors}>Go to Vendors</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href={ROUTES.vendorPortal} className="flex items-center gap-2 font-semibold">
            <Building2 className="size-5 text-primary" aria-hidden />
            <span className="hidden sm:inline">KMCP</span>
            <span className="text-muted-foreground">Operator</span>
          </Link>

          <nav className="ml-2 flex items-center gap-1" aria-label="Vendor">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="mr-1.5 inline size-4 align-[-2px]" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">{children}</main>
    </div>
  );
}
