"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/frontend/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/frontend/components/ui/tooltip";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { zonesApi } from "@/frontend/api";

/**
 * Saying whose numbers these are.
 *
 * The API restricts a Zone Officer's rows to their allocated wards, and until
 * now the portal rendered the result as though it were the city: "12 zones
 * configured" above a table of three, a network occupancy that was really one
 * ward's, a revenue figure an officer could reasonably quote in a meeting as
 * the authority's own. The number was never wrong — the caption was.
 *
 * One treatment, used everywhere: a quiet badge beside the page title naming
 * the wards the account can see. It is not an alert, because nothing has gone
 * wrong and there is nothing to dismiss; it is the same class of thing as the
 * "Live" pill next to it. Screens that mix scoped and unscoped figures — the
 * dashboard is the only one — additionally mark the city-wide tiles, because a
 * single badge cannot honestly caption a page where half the numbers are the
 * officer's and half are the authority's.
 *
 * Nothing renders for an unscoped account, and `isZoneScoped` is false in demo
 * mode, so the walkthrough is untouched.
 */

export interface ScopeZone {
  id: string;
  code: string;
  name: string;
  wardName: string | null;
}

export interface ZoneScope {
  /** True only for an account the API restricts to `zones`. */
  isZoneScoped: boolean;
  /** The zones themselves, once they have loaded. */
  zones: ScopeZone[];
  /** Distinct ward names across those zones. */
  wards: string[];
  /** "Ward 12 and Ward 14", or "3 zones" before the names arrive. */
  label: string;
}

/** Joins names the way a sentence would: "a", "a and b", "a, b and c". */
function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function useZoneScope(): ZoneScope {
  const { isZoneScoped, zoneIds } = usePermissions();

  /**
   * `GET /zones` is itself scoped, so the officer's own zone list *is* their
   * scope — there is no separate "what am I allowed to see" endpoint to call
   * and no id-to-name lookup to write. Only fetched for a scoped account: an
   * administrator would be asking for the whole city to render nothing.
   */
  const query = useApiQuery(
    ["zones", "scope"],
    () => zonesApi.list({ pageSize: 100 }).then((r) => r.data),
    { enabled: isZoneScoped, staleTime: 5 * 60_000 },
  );

  return React.useMemo(() => {
    const zones: ScopeZone[] = (query.data ?? []).map((zone) => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      wardName: zone.ward?.name ?? null,
    }));

    const wards = [...new Set(zones.map((z) => z.wardName).filter((w): w is string => Boolean(w)))];

    /**
     * Ward names when there are few enough to read at a glance, a count when
     * there are not — and a count from the principal itself while the zone
     * list is still in flight, so the badge never appears empty and then
     * grows. `zoneIds` is on /auth/me, which has always resolved by the time
     * a page renders.
     */
    const count = zones.length || zoneIds.length;
    const label =
      wards.length > 0 && wards.length <= 3
        ? list(wards)
        : `${count} ${count === 1 ? "zone" : "zones"}`;

    return { isZoneScoped, zones, wards, label };
  }, [isZoneScoped, zoneIds, query.data]);
}

/**
 * The scope indicator. Goes in `PageHeader`'s `meta` slot, beside the title.
 */
export function ZoneScopeBadge({ className }: { className?: string }) {
  const { isZoneScoped, zones, label } = useZoneScope();

  if (!isZoneScoped) return null;

  const badge = (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <MapPin className="size-3 text-muted-foreground" />
      Your zones · {label}
    </Badge>
  );

  // Nothing to expand into before the list arrives, and a tooltip that opens
  // onto an empty card is worse than no tooltip.
  if (zones.length === 0) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default">{badge}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p className="font-medium">Everything on this page is limited to:</p>
        <ul className="mt-1 space-y-0.5">
          {zones.map((zone) => (
            <li key={zone.id} className="text-xs">
              <span className="font-mono opacity-70">{zone.code}</span> {zone.name}
              {zone.wardName ? ` · ${zone.wardName}` : ""}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The caption for a figure the API counts across the whole authority even for a
 * scoped account.
 *
 * `GET /analytics/overview` scopes its money, sessions, occupancy and zone
 * counts to the officer's wards, and does not scope incidents, shifts, vendors,
 * attendants, settlements, citizens or passes — those queries carry no zone
 * filter at all. Rather than paper over the split, the tiles that show an
 * unscoped figure say so.
 */
export const CITYWIDE = "Counted across the whole authority, not just your zones";
