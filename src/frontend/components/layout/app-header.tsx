"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, LandPlot, Building2, BadgeIndianRupee, FileBarChart } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Separator } from "@/frontend/components/ui/separator";
import { SidebarTrigger } from "@/frontend/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/frontend/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { CommandPalette } from "./command-palette";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { ALL_NAV_ITEMS } from "@/frontend/lib/navigation";
import { ROUTES } from "@/shared/constants/routes";
import { titleCase } from "@/shared/utils/common.util";

function useCrumbs() {
  const pathname = usePathname();
  return React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];

    const crumbs: { label: string; href: string; last: boolean }[] = [];
    let href = "";
    segments.forEach((segment, i) => {
      href += `/${segment}`;
      const nav = ALL_NAV_ITEMS.find((n) => n.href === href);
      const isId = /^[a-z]{3}_/.test(segment) || segment.length > 18;
      crumbs.push({
        label: nav?.label ?? (isId ? "Detail" : titleCase(segment.replace(/-/g, "_"))),
        href,
        last: i === segments.length - 1,
      });
    });
    return crumbs;
  }, [pathname]);
}

const CREATE_ACTIONS = [
  { label: "Parking zone", href: ROUTES.zones, icon: LandPlot, hint: "Define a geo-fenced kerb" },
  { label: "Vendor", href: ROUTES.vendors, icon: Building2, hint: "Register a parking operator" },
  { label: "Tariff", href: ROUTES.tariffs, icon: BadgeIndianRupee, hint: "Draft a new rate card" },
  { label: "Report", href: ROUTES.reports, icon: FileBarChart, hint: "Queue an export" },
];

export function AppHeader() {
  const crumbs = useCrumbs();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <Breadcrumb className="hidden min-w-0 md:block">
        <BreadcrumbList>
          {crumbs.map((crumb) => (
            <React.Fragment key={crumb.href}>
              <BreadcrumbItem>
                {crumb.last ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!crumb.last && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <CommandPalette />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5">
              <CirclePlus className="size-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Create something new
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CREATE_ACTIONS.map((action) => (
              <DropdownMenuItem key={action.label} asChild>
                <Link href={action.href}>
                  <action.icon className="size-4" />
                  <div className="flex flex-col">
                    <span>{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.hint}</span>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationsMenu />
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <UserMenu />
      </div>
    </header>
  );
}
