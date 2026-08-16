"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  BadgeIndianRupee,
  Building2,
  Clock,
  Copy,
  LandPlot,
  MapPin,
  Pencil,
  Printer,
  ShieldAlert,
  SquareStack,
  ToggleLeft,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Separator } from "@/frontend/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/frontend/components/ui/alert";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { StatusBadge, AvailabilityBadge } from "@/frontend/components/shared/status-badge";
import {
  Field,
  Money,
  OccupancyBar,
  Plate,
  SectionCard,
} from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { RevenueChart, SessionsTrendChart } from "@/frontend/components/features/dashboard/charts";
import { ZoneFormSheet } from "./zone-form-sheet";
import { ZoneStatusDialog } from "./zone-status-dialog";
import { ZoneMap } from "@/frontend/components/shared/map";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { ZONES, SLOTS, SESSIONS, TARIFFS, INCIDENTS, ATTENDANTS } from "@/frontend/lib/mock";
import {
  zonesApi,
  slotsApi,
  sessionsApi,
  tariffsApi,
  incidentsApi,
  attendantsApi,
  listAll,
} from "@/frontend/api";
import { useApiQuery, useResource } from "@/frontend/hooks/use-api";
import {
  toZone,
  toZonePayload,
  toSlot,
  toSession,
  toTariff,
  toIncident,
  toAttendant,
} from "@/frontend/lib/adapters";
import { isLiveApi } from "@/config/env";
import { ROUTES } from "@/shared/constants/routes";
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  percent,
  relativeTime,
} from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import type { Zone } from "@/shared/types/domain.types";

export function ZoneDetailView({ zoneId }: { zoneId: string }) {
  const demoZone = ZONES.find((z) => z.id === zoneId);

  /**
   * The zone itself, carried through the same list machinery the other detail
   * screens use, so the write path and the demo fallback behave identically.
   *
   * This page used to take the zone straight out of the demo dataset with a
   * non-null assertion. A live id is not in that dataset, so every real zone
   * opened to a crash — the page could not render its own title.
   */
  const { items, isLoading, emptyReason, apply } = useResource<Zone>(
    ["zones", "detail", zoneId],
    () => zonesApi.get(zoneId).then((r) => [toZone(r.data)]),
    demoZone ? [demoZone] : [],
  );
  const zone = items[0];
  const [editOpen, setEditOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);

  /**
   * Each tab asks the API for its own slice of the zone. Filtering the demo
   * dataset by a live id matched nothing — and for incidents, which matched on
   * zone *name*, it could show another zone's reports as this one's.
   */
  const slotsQuery = useApiQuery(["slots", "zone", zoneId], () =>
    listAll((page, pageSize) => slotsApi.list({ zoneId, page, pageSize })).then((r) =>
      r.map(toSlot),
    ),
  );
  const sessionsQuery = useApiQuery(["sessions", "zone", zoneId], () =>
    listAll((page, pageSize) => sessionsApi.list({ zoneId, page, pageSize }), 200).then((r) =>
      r.map(toSession),
    ),
  );
  // Every tariff, not the zone's: a rate with no zone is city-wide and applies
  // here too, and the API's zoneId filter matches only the zone-specific ones.
  const tariffsQuery = useApiQuery(["tariffs", "for-zone"], () =>
    listAll((page, pageSize) => tariffsApi.list({ page, pageSize })).then((r) => r.map(toTariff)),
  );
  const incidentsQuery = useApiQuery(["incidents", "zone", zoneId], () =>
    listAll((page, pageSize) => incidentsApi.list({ zoneId, page, pageSize })).then((r) =>
      r.map(toIncident),
    ),
  );
  const attendantsQuery = useApiQuery(["attendants", "zone", zoneId], () =>
    listAll((page, pageSize) => attendantsApi.list({ zoneId, page, pageSize })).then((r) =>
      r.map(toAttendant),
    ),
  );

  // items[0] is genuinely absent while the first fetch runs, and stays absent
  // if the id does not exist — neither may be allowed to reach the render below.
  if (!zone) {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : (
          <EmptyState
            icon={LandPlot}
            title="Zone not found"
            description={emptyReason ?? "No zone exists with this reference."}
            action={
              <Button size="sm" asChild>
                <Link href={ROUTES.zones}>All zones</Link>
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const slots = isLiveApi ? (slotsQuery.data ?? []) : SLOTS.filter((s) => s.zoneId === zone.id);
  const sessions = isLiveApi
    ? (sessionsQuery.data ?? [])
    : SESSIONS.filter((s) => s.zoneId === zone.id);
  const activeSessions = sessions.filter((s) => s.status === "ACTIVE" || s.status === "OVERSTAY");
  const tariffs = (isLiveApi ? (tariffsQuery.data ?? []) : TARIFFS).filter(
    (t) => t.zoneId === zone.id || !t.zoneId,
  );
  const incidents = isLiveApi
    ? (incidentsQuery.data ?? [])
    : INCIDENTS.filter((i) => i.zoneName === zone.name);
  const attendants = isLiveApi
    ? (attendantsQuery.data ?? [])
    : ATTENDANTS.filter((a) => a.zoneId === zone.id);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: ROUTES.zones, label: "All zones" }}
        title={zone.name}
        description={`${zone.wardName} · ${zone.streetName} · open ${zone.openTime}–${zone.closeTime}`}
        meta={
          <>
            <Badge variant="outline" className="font-mono">
              {zone.code}
            </Badge>
            <StatusBadge status={zone.status} pulse={zone.status === "OPEN"} />
            <AvailabilityBadge occupied={zone.occupied} capacity={zone.capacity} />
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setStatusOpen(true)}>
              <ToggleLeft className="size-4" /> Change status
            </Button>
            <Button size="sm" className="h-9" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit zone
            </Button>
            <RowActions
              label="More"
              actions={[
                {
                  label: "Manage slots",
                  icon: SquareStack,
                  onSelect: () => toast.info("Opening slot manager for this zone"),
                },
                {
                  label: "Print zone signage",
                  icon: Printer,
                  onSelect: () =>
                    toast.success("Signage sheet queued", {
                      description: `${zone.code} · tariff board and QR for ${zone.name}`,
                    }),
                },
                {
                  label: "Copy GPS centre",
                  icon: Copy,
                  onSelect: () => {
                    void navigator.clipboard.writeText(`${zone.center.lat}, ${zone.center.lng}`);
                    toast.success("Copied GPS centre");
                  },
                },
                {
                  label: "Open in maps",
                  icon: MapPin,
                  onSelect: () =>
                    window.open(
                      `https://www.openstreetmap.org/?mlat=${zone.center.lat}&mlon=${zone.center.lng}#map=18/${zone.center.lat}/${zone.center.lng}`,
                      "_blank",
                      "noopener,noreferrer",
                    ),
                },
              ]}
            />
          </>
        }
      />

      {zone.status !== "OPEN" && (
        <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
          <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>This zone is not accepting new vehicles</AlertTitle>
          <AlertDescription>
            {zone.closureReason ?? "No reason recorded."}
            {zone.closureUntil && ` Expected to reopen on ${formatDateTime(zone.closureUntil).split(",")[0]}.`}
          </AlertDescription>
        </Alert>
      )}

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard
            label="Occupancy"
            numeric={percent(zone.occupied, zone.capacity)}
            suffix="%"
            icon={SquareStack}
            accent={percent(zone.occupied, zone.capacity) > 90 ? "warning" : "success"}
            hint={`${zone.occupied} of ${zone.capacity} bays`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Revenue today"
            value={formatMoney(zone.revenueToday)}
            icon={BadgeIndianRupee}
            trend="up"
            trendValue="8%"
            hint={`${formatMoney(zone.revenueMonth, { compact: true })} this month`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Active sessions"
            numeric={activeSessions.length}
            icon={Activity}
            accent="info"
            hint={`${sessions.length} sessions recorded here`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Open incidents"
            numeric={incidents.filter((i) => i.status === "OPEN").length}
            icon={ShieldAlert}
            accent={incidents.some((i) => i.status === "OPEN") ? "warning" : "success"}
            hint={`${incidents.length} reported in total`}
          />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="slots">Slots ({slots.length})</TabsTrigger>
          <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
          <TabsTrigger value="tariffs">Tariffs ({tariffs.length})</TabsTrigger>
          <TabsTrigger value="team">Team ({attendants.length})</TabsTrigger>
          <TabsTrigger value="incidents">Incidents ({incidents.length})</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Zone details" className="lg:col-span-1">
              <dl className="divide-y divide-border/60">
                <Field label="Zone code">
                  <span className="font-mono">{zone.code}</span>
                </Field>
                <Field label="Ward">{zone.wardName}</Field>
                <Field label="Street">{zone.streetName}</Field>
                <Field label="Working hours">
                  {zone.openTime}–{zone.closeTime}
                </Field>
                <Field label="Capacity">{zone.capacity} bays</Field>
                <Field label="Geo-fence">{zone.boundaryPoints}-point polygon</Field>
                <Field label="GPS centre">
                  <span className="font-mono text-xs">
                    {zone.center.lat}, {zone.center.lng}
                  </span>
                </Field>
                <Field label="Created">{formatDateTime(zone.createdAt)}</Field>
              </dl>

              <div className="mt-4">
                <ZoneMap
                  zones={[
                    {
                      id: zone.id,
                      code: zone.code,
                      name: zone.name,
                      center: zone.center,
                      capacity: zone.capacity,
                      occupied: zone.occupied,
                      status: zone.status,
                    },
                  ]}
                  height={260}
                />
              </div>
            </SectionCard>

            <SectionCard title="Operator" className="lg:col-span-1">
              {zone.vendorName ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{zone.vendorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {attendants.length} attendants assigned here
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <dl className="divide-y divide-border/60">
                    <Field label="Attendants on shift">
                      {attendants.filter((a) => a.onShift).length}
                    </Field>
                    <Field label="Collected today">
                      <Money value={zone.revenueToday} />
                    </Field>
                    <Field label="Collected this month">
                      <Money value={zone.revenueMonth} />
                    </Field>
                  </dl>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={ROUTES.vendors}>View vendor</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No vendor operates this kerb yet, so no sessions can be started here.
                  </p>
                  <Button size="sm" asChild>
                    <Link href={ROUTES.vendors}>Assign a vendor</Link>
                  </Button>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Vehicle types accepted"
              description="An attendant cannot start a session for a type that is not listed"
              className="lg:col-span-1"
            >
              <div className="flex flex-wrap gap-1.5">
                {zone.allowedVehicleTypes.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {VEHICLE_TYPE_LABELS[t]}
                  </Badge>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Live utilisation</p>
                <OccupancyBar occupied={zone.occupied} capacity={zone.capacity} />
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div>
                    <p className="text-lg font-semibold tabular">{zone.occupied}</p>
                    <p className="text-[11px] text-muted-foreground">Occupied</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular">{zone.capacity - zone.occupied}</p>
                    <p className="text-[11px] text-muted-foreground">Free</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular">{zone.capacity}</p>
                    <p className="text-[11px] text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Revenue"
              description="Cash and digital over 30 days"
              action={<TrendingUp className="size-4 text-muted-foreground" />}
            >
              <RevenueChart height={220} />
            </SectionCard>
            <SectionCard title="Sessions" description="Daily session count over 30 days">
              <SessionsTrendChart />
            </SectionCard>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- slots */}
        <TabsContent value="slots" className="mt-4">
          <SectionCard
            title="Bays in this zone"
            description={`${slots.filter((s) => s.status === "AVAILABLE").length} available · ${slots.filter((s) => s.status === "OCCUPIED").length} occupied`}
            action={
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={`${ROUTES.slots}?zone=${zone.id}`}>Manage slots</Link>
              </Button>
            }
          >
            {slots.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No bays have been laid out in this zone yet.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {slots.map((slot) => {
                const tone =
                  slot.status === "OCCUPIED"
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    : slot.status === "RESERVED"
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : slot.status === "OUT_OF_SERVICE"
                        ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
                        : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
                return (
                  <div
                    key={slot.id}
                    className={`rounded-lg border p-2 text-center transition-transform hover:scale-[1.03] ${tone}`}
                    title={`${slot.code} · ${VEHICLE_TYPE_LABELS[slot.type]} · ${slot.status}`}
                  >
                    <p className="font-mono text-xs font-semibold">{slot.code}</p>
                    <p className="mt-0.5 truncate text-[10px] opacity-75">
                      {VEHICLE_TYPE_LABELS[slot.type]}
                    </p>
                    {slot.currentPlate && (
                      <p className="mt-1 truncate font-mono text-[9px] opacity-90">
                        {slot.currentPlate}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------- sessions */}
        <TabsContent value="sessions" className="mt-4">
          <SectionCard
            title="Recent sessions"
            description="Newest first"
            contentClassName="p-0"
            action={
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={`${ROUTES.sessions}?zone=${zone.id}`}>Open in session log</Link>
              </Button>
            }
          >
            {sessions.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No sessions have been recorded in this zone yet.
              </p>
            )}
            <ul className="divide-y divide-border/60">
              {sessions.slice(0, 12).map((session) => (
                <li key={session.id}>
                  <Link
                    href={ROUTES.session(session.id)}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <Plate value={session.plateNumber} />
                    <StatusBadge status={session.status} pulse={session.status === "ACTIVE"} />
                    <span className="text-xs text-muted-foreground">
                      {VEHICLE_TYPE_LABELS[session.vehicleType]}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {session.durationMinutes
                        ? formatDuration(session.durationMinutes)
                        : relativeTime(session.startAt)}
                    </span>
                    <Money value={session.payableAmount} className="w-20 text-right text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* -------------------------------------------------------- tariffs */}
        <TabsContent value="tariffs" className="mt-4">
          <SectionCard
            title="Applicable tariffs"
            description="Zone-specific rates take priority over city-wide rates"
            contentClassName="p-0"
            action={
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={ROUTES.tariffs}>Manage tariffs</Link>
              </Button>
            }
          >
            {tariffs.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No tariff covers this zone, so nothing can be charged here yet.
              </p>
            )}
            <ul className="divide-y divide-border/60">
              {tariffs.map((tariff) => (
                <li key={tariff.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tariff.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {VEHICLE_TYPE_LABELS[tariff.vehicleType]} ·{" "}
                      {tariff.zoneId ? "Zone-specific" : "City-wide"} · v{tariff.version}
                    </p>
                  </div>
                  <StatusBadge
                    status={tariff.isPublished ? "APPROVED" : "DRAFT"}
                    label={tariff.isPublished ? "Published" : "Draft"}
                  />
                  <div className="text-right">
                    <p className="text-sm font-medium tabular">
                      {formatMoney(tariff.baseAmount)} / {tariff.baseMinutes}m
                    </p>
                    <p className="text-xs text-muted-foreground tabular">
                      then {formatMoney(tariff.incrementAmount)} / {tariff.incrementMinutes}m
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* ----------------------------------------------------------- team */}
        <TabsContent value="team" className="mt-4">
          <SectionCard
            title="Attendants working this zone"
            description={`${attendants.filter((a) => a.onShift).length} on shift right now`}
            contentClassName="p-0"
            action={
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={ROUTES.attendants}>All attendants</Link>
              </Button>
            }
          >
            {attendants.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No attendants are assigned to this zone yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {attendants.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted">
                      <Users className="size-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.employeeCode} · {a.vendorName}
                      </p>
                    </div>
                    <StatusBadge
                      status={a.onShift ? "ACTIVE" : "INACTIVE"}
                      label={a.onShift ? "On shift" : "Off shift"}
                      pulse={a.onShift}
                    />
                    <div className="text-right">
                      <Money value={a.collectionToday} className="text-sm" />
                      <p className="text-xs text-muted-foreground">{a.sessionsToday} sessions</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------ incidents */}
        <TabsContent value="incidents" className="mt-4">
          <SectionCard title="Incidents reported here" contentClassName="p-0">
            {incidents.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No incidents have been reported in this zone.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {incidents.map((incident) => (
                  <li key={incident.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {incident.reference}
                        </span>
                        <StatusBadge status={incident.status} />
                      </div>
                      <p className="mt-1 text-sm text-pretty">{incident.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {incident.reportedBy} · {relativeTime(incident.createdAt)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                      <Link href={ROUTES.incidents}>Open</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/*
        Both of these edited the page's own copy of the zone and nothing else,
        so a change made here survived until the next reload and no further.
        They go to the API now, exactly as the same two dialogs do on the list.
      */}
      <ZoneFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        zone={zone}
        onSaved={(draft) =>
          apply(
            () => zonesApi.update(zone.id, toZonePayload(draft)),
            (list) => list.map((z) => ({ ...z, ...draft }) as Zone),
            { success: "Zone updated", description: draft.name },
          )
        }
      />
      <ZoneStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        zone={zone}
        onChanged={(status, reason, until) => {
          void apply(
            () => zonesApi.changeStatus(zone.id, status, reason, until),
            (list) =>
              list.map((z) => ({ ...z, status, closureReason: reason, closureUntil: until })),
          ).catch(() => undefined);
        }}
      />
    </div>
  );
}
