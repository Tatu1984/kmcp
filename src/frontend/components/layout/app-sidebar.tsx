"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, LifeBuoy, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/frontend/components/ui/sidebar";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/frontend/components/ui/tooltip";
import { Logo, LogoMark } from "@/frontend/components/brand/logo";
import { visibleNavGroups } from "@/frontend/lib/navigation";
import { DASHBOARD as DEMO_DASHBOARD } from "@/frontend/lib/mock";
import { analyticsApi } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { isLiveApi } from "@/config/env";
import { APP } from "@/config/app.config";

/**
 * Fixed widths for the placeholder rows. Random ones would differ between the
 * server render and the first client render, which React reports as a
 * hydration error on a sidebar that is only shimmering.
 */
const SKELETON_WIDTHS = ["68%", "82%", "55%", "74%", "61%", "88%", "59%", "77%"];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  /**
   * The nav is cut to what this account may open. `visibleNavGroups` returns
   * nothing at all until /auth/me has answered, so the shimmer below stands in
   * for that moment rather than an empty rail.
   */
  const permissions = usePermissions();
  const groups = React.useMemo(() => visibleNavGroups(permissions), [permissions]);

  /**
   * Every counter in this sidebar comes from the one overview call, under the
   * same query key the dashboard uses — so arriving on any page costs one
   * request between the two, not two.
   */
  const overview = useApiQuery(["analytics", "overview"], () =>
    analyticsApi.overview().then((r) => r.data),
  );

  /**
   * Nothing stands in for the live numbers while that call is in flight. A
   * badge reads as a queue somebody has to work through, and a demo figure on
   * a live deployment sends an officer looking for settlements that are not
   * there — no badge at all is the honest state until the answer lands.
   */
  const stats = isLiveApi ? overview.data : DEMO_DASHBOARD;

  const badges: Record<string, number> = {
    pendingSettlements: stats?.pendingSettlements ?? 0,
    openIncidents: stats?.openIncidents ?? 0,
    varianceShifts: stats?.varianceShifts ?? 0,
    pendingVendorApprovals: stats?.pendingVendorApprovals ?? 0,
    overstayCount: stats?.overstayCount ?? 0,
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          {collapsed ? <LogoMark /> : <Logo subtitle="Parking Authority" />}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 kmcp-scroll-fade">
        {/*
         * Shimmer rather than the whole nav greyed out while permissions
         * resolve. Greying it keeps the shape steady but promises destinations
         * that are about to vanish, and a row disappearing under a cursor
         * already moving towards it is far more jarring than one arriving —
         * the eye tracks removal. The shimmer promises nothing, holds the same
         * height, and lasts one request.
         */}
        {!permissions.isReady ? (
          <SidebarGroup className="py-1.5">
            <SidebarGroupContent>
              <SidebarMenu>
                {SKELETON_WIDTHS.map((width) => (
                  <SidebarMenuItem key={width}>
                    <div className="flex h-8 items-center gap-2.5 px-2">
                      <Skeleton className="size-4 shrink-0 rounded" />
                      <Skeleton className="h-3.5 rounded" style={{ width }} />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          groups.map((group) => (
            <SidebarGroup key={group.label} className="py-1.5">
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-sidebar-foreground/45 uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                    const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={cn(
                            "gap-2.5 transition-colors",
                            active && "font-medium shadow-xs",
                          )}
                        >
                          <Link href={item.href}>
                            <item.icon className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {badge > 0 && (
                          <SidebarMenuBadge
                            className={cn(
                              "rounded-full px-1.5 text-[10px] font-semibold tabular",
                              item.badgeKey === "openIncidents" || item.badgeKey === "varianceShifts"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-sidebar-primary/25 text-sidebar-primary-foreground",
                            )}
                          >
                            {badge}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border/60 p-3">
        {!collapsed && stats && (
          <div className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-emerald-400" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-[11px] font-medium">
                {stats.attendantsOnShift} attendants on shift
              </p>
            </div>
            <p className="mt-1 text-[11px] text-sidebar-foreground/55">
              {stats.zonesOpen} of {stats.zonesTotal} zones open · {stats.activeVehicles}{" "}
              vehicles parked
            </p>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Help & documentation" size="sm">
              <a href="#" onClick={(e) => e.preventDefault()}>
                <LifeBuoy className="size-4" />
                <span>Help &amp; docs</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="flex items-center gap-1.5 px-1 text-[10px] text-sidebar-foreground/40">
                <Radio className="size-3" /> {APP.name} v{APP.version} · Phase {APP.phase}
                <CircleHelp className="ml-auto size-3" />
              </p>
            </TooltipTrigger>
            <TooltipContent side="top">
              Phase 1 — attendants photograph the plate and type the number. ANPR arrives in Phase 2.
            </TooltipContent>
          </Tooltip>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
