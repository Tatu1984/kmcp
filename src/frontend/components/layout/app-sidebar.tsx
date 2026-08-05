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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/frontend/components/ui/tooltip";
import { Logo, LogoMark } from "@/frontend/components/brand/logo";
import { NAV_GROUPS } from "@/frontend/lib/navigation";
import { DASHBOARD } from "@/frontend/lib/mock";
import { APP } from "@/config/app.config";

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const badges: Record<string, number> = {
    pendingSettlements: DASHBOARD.pendingSettlements,
    openIncidents: DASHBOARD.openIncidents,
    varianceShifts: DASHBOARD.varianceShifts,
    pendingVendorApprovals: DASHBOARD.pendingVendorApprovals,
    overstayCount: DASHBOARD.overstayCount,
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          {collapsed ? <LogoMark /> : <Logo subtitle="Parking Authority" />}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 kmcp-scroll-fade">
        {NAV_GROUPS.map((group) => (
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
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border/60 p-3">
        {!collapsed && (
          <div className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-emerald-400" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-[11px] font-medium">
                {DASHBOARD.attendantsOnShift} attendants on shift
              </p>
            </div>
            <p className="mt-1 text-[11px] text-sidebar-foreground/55">
              {DASHBOARD.zonesOpen} of {DASHBOARD.zonesTotal} zones open · {DASHBOARD.activeVehicles}{" "}
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
