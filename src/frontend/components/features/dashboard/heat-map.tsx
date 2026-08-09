"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/frontend/components/ui/tooltip";
import { ZONES } from "@/frontend/lib/mock";
import { zonesApi } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { ROUTES } from "@/shared/constants/routes";
import { formatMoney, percent } from "@/shared/utils/common.util";

/**
 * A treemap-style occupancy heat map. Tile area is capacity, tile colour is
 * utilisation — so a big red tile is the zone that needs attention first.
 */
export function OccupancyHeatMap() {
  const query = useApiQuery(["zones", "heatmap"], () =>
    zonesApi.list({ pageSize: 200 }).then((r) => r.data),
  );

  const zones = [...(query.data ?? ZONES)]
    .map((zone) => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      capacity: zone.capacity,
      occupied: zone.occupied,
      status: zone.status,
      wardName: "wardName" in zone ? zone.wardName : (zone.ward?.name ?? "—"),
      streetName: "streetName" in zone ? zone.streetName : (zone.street?.name ?? "—"),
      closureReason: zone.closureReason ?? undefined,
      // Only the demo set carries a revenue figure per zone; the tooltip omits
      // it rather than showing ₹0 for a zone that simply was not asked about.
      revenueToday: "revenueToday" in zone ? zone.revenueToday : undefined,
    }))
    .sort((a, b) => b.capacity - a.capacity);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
        {zones.map((zone) => {
          const pct = percent(zone.occupied, zone.capacity);
          const closed = zone.status !== "OPEN";
          const tone = closed
            ? "bg-muted text-muted-foreground"
            : pct >= 95
              ? "bg-red-500/85 text-white"
              : pct >= 80
                ? "bg-orange-500/80 text-white"
                : pct >= 60
                  ? "bg-amber-400/80 text-amber-950"
                  : pct >= 35
                    ? "bg-emerald-400/70 text-emerald-950"
                    : "bg-emerald-500/25 text-emerald-900 dark:text-emerald-100";

          return (
            <Tooltip key={zone.id}>
              <TooltipTrigger asChild>
                <Link
                  href={ROUTES.zone(zone.id)}
                  className={cn(
                    "group flex aspect-4/3 flex-col justify-between rounded-lg p-2 transition-all hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:ring-offset-background",
                    tone,
                  )}
                >
                  <span className="truncate font-mono text-[10px] font-semibold opacity-80">
                    {zone.code}
                  </span>
                  <span className="space-y-0.5">
                    <span className="block text-lg leading-none font-semibold tabular">
                      {closed ? "—" : `${pct}%`}
                    </span>
                    <span className="block truncate text-[10px] leading-tight opacity-85">
                      {zone.name}
                    </span>
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="max-w-56">
                <p className="font-medium">{zone.name}</p>
                <p className="text-xs opacity-80">
                  {zone.wardName} · {zone.streetName}
                </p>
                <p className="mt-1 text-xs">
                  {closed
                    ? `${zone.status.replace("_", " ").toLowerCase()} — ${zone.closureReason ?? "not accepting vehicles"}`
                    : `${zone.occupied} of ${zone.capacity} bays occupied`}
                </p>
                <p className="text-xs">Today: {formatMoney(zone.revenueToday)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="font-medium">Utilisation</span>
        {[
          { label: "0–35%", className: "bg-emerald-500/25" },
          { label: "35–60%", className: "bg-emerald-400/70" },
          { label: "60–80%", className: "bg-amber-400/80" },
          { label: "80–95%", className: "bg-orange-500/80" },
          { label: "95%+", className: "bg-red-500/85" },
          { label: "Closed", className: "bg-muted" },
        ].map((k) => (
          <span key={k.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", k.className)} />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}
