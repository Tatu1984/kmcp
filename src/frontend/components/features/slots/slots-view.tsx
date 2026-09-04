"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Accessibility,
  BatteryCharging,
  CircleCheck,
  Crown,
  Grid3x3,
  Loader2,
  Pencil,
  Plus,
  ShieldBan,
  SquareStack,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Switch } from "@/frontend/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Can, NOT_PERMITTED } from "@/frontend/components/shared/can";
import { ZoneScopeBadge } from "@/frontend/components/shared/zone-scope";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { Plate, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SLOTS, ZONES } from "@/frontend/lib/mock";
import { slotsApi, zonesApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { toSlot } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { mapWithConcurrency } from "@/frontend/lib/concurrency";
import { ROUTES } from "@/shared/constants/routes";
import { VEHICLE_TYPE_LABELS, VEHICLE_TYPE_PREFIXES } from "@/config/app.config";
import { isLiveApi } from "@/config/env";
import { cn } from "@/lib/utils";
import type { Slot, SlotStatus, SlotType } from "@/shared/types/domain.types";

const TYPE_ICON: Partial<Record<SlotType, typeof Crown>> = {
  EV: BatteryCharging,
  VIP: Crown,
  ACCESSIBLE: Accessibility,
};

export function SlotsView() {
  const params = useSearchParams();
  const zoneParam = params.get("zone");

  const { items: zones } = useResource<{ id: string; code: string; name: string }>(
    ["zones", "picker"],
    () =>
      listAll((page, pageSize) => zonesApi.list({ page, pageSize })).then((r) =>
        r.map((z) => ({ id: z.id, code: z.code, name: z.name })),
      ),
    ZONES.map((z) => ({ id: z.id, code: z.code, name: z.name })),
  );

  const {
    items: slots,
    isLoading,
    isRefreshing,
    emptyReason,
    apply,
    refresh,
  } = useResource<Slot>(
    ["slots", "list"],
    () => listAll((page, pageSize) => slotsApi.list({ page, pageSize })).then((r) => r.map(toSlot)),
    SLOTS,
  );
  const { can, isZoneScoped } = usePermissions();
  // Every write on this screen — create, bulk create, patch, status, delete —
  // is guarded on `slot.write` (slots.controller.ts:49, :61, :76, :89, :105).
  // Only the two reads sit on `zone.read`.
  const canWrite = can("slot.write");

  const [zoneId, setZoneId] = React.useState(zoneParam ?? "__all");
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Slot | null>(null);
  const [bulk, setBulk] = React.useState({ zoneId: "", type: "CAR" as SlotType, prefix: "C", count: 20 });
  // Whether the operator has typed into the prefix themselves — once they
  // have, picking a different bay type must not clobber their edit.
  const [prefixTouched, setPrefixTouched] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [edit, setEdit] = React.useState({
    type: "CAR" as SlotType,
    isReserved: false,
    status: "AVAILABLE" as SlotStatus,
    reason: "",
  });

  const data = React.useMemo(
    () => (zoneId === "__all" ? slots : slots.filter((s) => s.zoneId === zoneId)),
    [slots, zoneId],
  );

  // Bays with a status write in flight — the table cell and the row's
  // actions trigger read this to show progress instead of sitting there
  // looking unchanged until the refetch lands.
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const markBusy = React.useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setStatus = React.useCallback(
    (slot: Slot, status: SlotStatus, label: string) => {
      markBusy(slot.id, true);
      void apply(
        () =>
          slotsApi.changeStatus(
            slot.id,
            status,
            // The API insists on a reason before a bay leaves service, and it
            // is right to: an unexplained blocked bay is lost revenue nobody
            // can account for later.
            status === "OUT_OF_SERVICE" ? `Marked ${label} from the portal` : undefined,
          ),
        (list) => list.map((s) => (s.id === slot.id ? { ...s, status } : s)),
        { success: `Bay ${slot.code} marked ${label}`, description: slot.zoneName },
      )
        .catch(() => undefined)
        .finally(() => markBusy(slot.id, false));
    },
    [apply, markBusy],
  );

  const handleRefresh = React.useCallback(() => {
    if (!isLiveApi) {
      toast.info("Demo data", {
        description: "This screen reads from the bundled demo dataset — there is nothing new to fetch.",
      });
      return;
    }
    void refresh();
  }, [refresh]);

  const openEdit = React.useCallback((slot: Slot) => {
    setSelected(slot);
    setEdit({ type: slot.type, isReserved: slot.isReserved, status: slot.status, reason: "" });
    setEditOpen(true);
  }, []);

  const columns = React.useMemo<ColumnDef<Slot, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Bay",
        meta: "Bay",
        cell: ({ row }) => {
          const Icon = TYPE_ICON[row.original.type];
          return (
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted font-mono text-[10px] font-semibold">
                {Icon ? <Icon className="size-3.5" /> : row.original.code.slice(0, 1)}
              </span>
              <span className="font-mono text-sm font-medium">{row.original.code}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "zoneName",
        header: "Zone",
        meta: "Zone",
        cell: ({ row }) => <span className="truncate text-sm">{row.original.zoneName}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        meta: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-normal">
            {VEHICLE_TYPE_LABELS[row.original.type]}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) =>
          busyIds.has(row.original.id) ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Updating…
            </span>
          ) : (
            <StatusBadge status={row.original.status} pulse={row.original.status === "OCCUPIED"} />
          ),
      },
      {
        id: "vehicle",
        accessorFn: (s) => s.currentPlate ?? "",
        header: "Vehicle",
        meta: "Vehicle",
        cell: ({ row }) =>
          row.original.currentPlate ? (
            <Plate value={row.original.currentPlate} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const slot = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={`Bay ${slot.code}`}
                trigger={
                  busyIds.has(slot.id) ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      disabled
                      aria-label="Bay update in progress"
                    >
                      <Loader2 className="size-4 animate-spin" />
                    </Button>
                  ) : undefined
                }
                actions={[
                  {
                    label: "Edit bay",
                    icon: Pencil,
                    // PATCH /slots/:id — slots.controller.ts:76
                    permission: "slot.write",
                    onSelect: () => openEdit(slot),
                  },
                  {
                    label: "Set status",
                    icon: SquareStack,
                    // POST /slots/:id/status — slots.controller.ts:89
                    permission: "slot.write",
                    separatorBefore: true,
                    children: [
                      { label: "Available", icon: CircleCheck, onSelect: () => setStatus(slot, "AVAILABLE", "available") },
                      { label: "Reserved", icon: Crown, onSelect: () => setStatus(slot, "RESERVED", "reserved") },
                      { label: "Out of service", icon: Wrench, destructive: true, onSelect: () => setStatus(slot, "OUT_OF_SERVICE", "out of service") },
                    ],
                  },
                  {
                    label: "Change type",
                    icon: Grid3x3,
                    // PATCH /slots/:id — slots.controller.ts:76
                    permission: "slot.write",
                    children: (["CAR", "TWO_WHEELER", "EV", "VIP", "ACCESSIBLE"] as SlotType[]).map((t) => ({
                      label: VEHICLE_TYPE_LABELS[t],
                      onSelect: () =>
                        void apply(
                          () => slotsApi.update(slot.id, { type: t }),
                          (list) => list.map((s) => (s.id === slot.id ? { ...s, type: t } : s)),
                          { success: `Bay ${slot.code} is now a ${VEHICLE_TYPE_LABELS[t]} bay` },
                        ).catch(() => undefined),
                    })),
                  },
                  {
                    label: "Block bay",
                    icon: ShieldBan,
                    // POST /slots/:id/status — slots.controller.ts:89
                    permission: "slot.write",
                    separatorBefore: true,
                    onSelect: () => setStatus(slot, "OUT_OF_SERVICE", "blocked"),
                  },
                  {
                    label: "Remove bay",
                    icon: Trash2,
                    // DELETE /slots/:id — slots.controller.ts:105
                    permission: "slot.write",
                    destructive: true,
                    onSelect: () => {
                      setSelected(slot);
                      setRemoveOpen(true);
                    },
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [apply, setStatus, openEdit, busyIds],
  );

  const counts = {
    total: data.length,
    available: data.filter((s) => s.status === "AVAILABLE").length,
    occupied: data.filter((s) => s.status === "OCCUPIED").length,
    outOfService: data.filter((s) => s.status === "OUT_OF_SERVICE").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking slots"
        meta={<ZoneScopeBadge />}
        description="Individual bays within each zone — type, reservation and live status."
        actions={
          <>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger size="sm" className="h-9 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{isZoneScoped ? "All my zones" : "All zones"}</SelectItem>
                {/* The same zone list the "Add bays" dialog picks from: live
                    when there is a backend, the demo roster when there is not.
                    Reading ZONES here offered zone ids the live slots below
                    have never belonged to, so choosing one showed no bays.

                    Nothing is filtered here for a zone-scoped officer either:
                    GET /zones already answers with their allocation and nothing
                    else, so a second filter over `zoneIds` would narrow a list
                    that is already narrow and go stale the day the rule
                    changes. */}
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.code} · {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* POST /slots/bulk — slots.controller.ts:61 */}
            <Can permission="slot.write">
              <Button size="sm" className="h-9" onClick={() => setBulkOpen(true)}>
                <Plus className="size-4" /> Add bays
              </Button>
            </Can>
          </>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Bays in view" numeric={counts.total} icon={SquareStack} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Available" numeric={counts.available} icon={CircleCheck} accent="success" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Occupied" numeric={counts.occupied} icon={Grid3x3} accent="info" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Out of service"
            numeric={counts.outOfService}
            icon={Wrench}
            accent={counts.outOfService > 0 ? "warning" : "success"}
          />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">Bay map</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4">
          <SectionCard
            title="Bay map"
            description={
              canWrite
                ? "Click a bay to change its status. Colour follows live occupancy."
                : "Colour follows live occupancy. Changing a bay's status is not yours to do."
            }
          >
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-12">
              {data.slice(0, 120).map((slot) => {
                const tone =
                  slot.status === "OCCUPIED"
                    ? "border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20"
                    : slot.status === "RESERVED"
                      ? "border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20"
                      : slot.status === "OUT_OF_SERVICE"
                        ? "border-red-500/35 bg-red-500/10 hover:bg-red-500/20"
                        : "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20";
                const busy = busyIds.has(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    // Tapping a bay here writes a status, so it answers to the
                    // same `slot.write` the ⋯ menu does. The tiles stay on
                    // screen either way — the map is how this screen is read.
                    disabled={!canWrite || busy}
                    onClick={() =>
                      setStatus(
                        slot,
                        slot.status === "AVAILABLE" ? "OUT_OF_SERVICE" : "AVAILABLE",
                        slot.status === "AVAILABLE" ? "out of service" : "available",
                      )
                    }
                    className={cn(
                      "relative rounded-lg border p-2 text-center transition-all",
                      canWrite && !busy ? "hover:scale-[1.04]" : "cursor-not-allowed",
                      busy && "opacity-60",
                      tone,
                    )}
                    title={
                      canWrite
                        ? `${slot.zoneName} · ${VEHICLE_TYPE_LABELS[slot.type]} · ${slot.status}`
                        : `${slot.zoneName} · ${VEHICLE_TYPE_LABELS[slot.type]} · ${slot.status} — ${NOT_PERMITTED}`
                    }
                  >
                    {busy && (
                      <Loader2 className="absolute top-1 right-1 size-3 animate-spin text-muted-foreground" />
                    )}
                    <p className="font-mono text-[11px] font-semibold">{slot.code}</p>
                    <p className="mt-0.5 truncate text-[9px] opacity-70">
                      {VEHICLE_TYPE_LABELS[slot.type]}
                    </p>
                  </button>
                );
              })}
            </div>
            {data.length > 120 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the first 120 bays. Filter by zone or use the table view to see the rest.
              </p>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <DataTable
            data={data}
            columns={columns}
            enableSelection
            searchKeys={["code", "zoneName", "currentPlate"]}
            searchPlaceholder="Search bay code, zone or plate…"
            facets={[
              {
                columnId: "status",
                label: "Status",
                options: [
                  { value: "AVAILABLE", label: "Available" },
                  { value: "OCCUPIED", label: "Occupied" },
                  { value: "RESERVED", label: "Reserved" },
                  { value: "OUT_OF_SERVICE", label: "Out of service" },
                ],
              },
              {
                columnId: "type",
                label: "Type",
                options: Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
              },
            ]}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            onExport={(rows, columns) => {
              const file = downloadCsv("bays", rows, columns);
              toast.success("Export ready", { description: `${rows.length} bays · ${file}` });
            }}
            bulkActions={(rows, clear) => (
              <Can permission="slot.write">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={rows.some((r) => busyIds.has(r.id))}
                  onClick={() => {
                    rows.forEach((r) => markBusy(r.id, true));
                    void apply(
                      () =>
                        mapWithConcurrency(rows, 4, (s) =>
                          slotsApi.changeStatus(s.id, "OUT_OF_SERVICE", "Bulk action from the portal"),
                        ),
                      (list) =>
                        list.map((s) =>
                          rows.some((r) => r.id === s.id) ? { ...s, status: "OUT_OF_SERVICE" as const } : s,
                        ),
                      { success: `${rows.length} bays taken out of service` },
                    )
                      .then(clear)
                      .catch(() => undefined)
                      .finally(() => rows.forEach((r) => markBusy(r.id, false)));
                  }}
                >
                  {rows.some((r) => busyIds.has(r.id)) && <Loader2 className="size-3.5 animate-spin" />}
                  Take out of service
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={rows.some((r) => busyIds.has(r.id))}
                  onClick={() => {
                    rows.forEach((r) => markBusy(r.id, true));
                    void apply(
                      () => mapWithConcurrency(rows, 4, (s) => slotsApi.changeStatus(s.id, "AVAILABLE")),
                      (list) =>
                        list.map((s) =>
                          rows.some((r) => r.id === s.id) ? { ...s, status: "AVAILABLE" as const } : s,
                        ),
                      { success: `${rows.length} bays returned to service` },
                    )
                      .then(clear)
                      .catch(() => undefined)
                      .finally(() => rows.forEach((r) => markBusy(r.id, false)));
                  }}
                >
                  {rows.some((r) => busyIds.has(r.id)) && <Loader2 className="size-3.5 animate-spin" />}
                  Return to service
                </Button>
              </Can>
            )}
            isLoading={isLoading}
            emptyTitle={emptyReason ? "Nothing to show" : "No bays configured"}
            emptyDescription="Add bays to this zone so attendants can assign vehicles to a specific space."
          />
        </TabsContent>
      </Tabs>

      {/* --------------------------------------------------------- bulk add */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add bays in bulk</DialogTitle>
            <DialogDescription>
              Bays are numbered automatically from the prefix you choose, so a run of 20 car bays
              becomes C01 through C20.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-zone">Zone</Label>
              <Select
                value={bulk.zoneId}
                onValueChange={(v) => setBulk((b) => ({ ...b, zoneId: v }))}
              >
                <SelectTrigger id="bulk-zone" className="w-full">
                  {/* Placeholder rather than a defaulted value: the field used to
                      display the first zone in the list while holding nothing,
                      so bays quietly went to that zone instead of the one on
                      screen. An unset picker must look unset. */}
                  <SelectValue placeholder="Choose a zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} · {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-type">Bay type</Label>
              <Select
                value={bulk.type}
                onValueChange={(v) => {
                  const type = v as SlotType;
                  setBulk((b) => ({
                    ...b,
                    type,
                    // Suggest the type's usual prefix, but only while the
                    // operator has not typed their own — an edit they made
                    // on purpose must survive switching the type back and
                    // forth while they are still filling in the rest.
                    prefix: prefixTouched ? b.prefix : (VEHICLE_TYPE_PREFIXES[type] ?? b.prefix),
                  }));
                }}
              >
                <SelectTrigger id="bulk-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-prefix">Code prefix</Label>
              <Input
                id="bulk-prefix"
                value={bulk.prefix}
                onChange={(e) => {
                  setPrefixTouched(true);
                  setBulk((b) => ({ ...b, prefix: e.target.value.toUpperCase() }));
                }}
                className="font-mono"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-count">How many</Label>
              <Input
                id="bulk-count"
                type="number"
                value={bulk.count}
                onChange={(e) => setBulk((b) => ({ ...b, count: Number(e.target.value) }))}
                min={1}
                max={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={bulkBusy}
              onClick={() => {
                const targetZone = bulk.zoneId;
                if (!targetZone) {
                  toast.error("Pick a zone for these bays");
                  return;
                }

                /**
                 * Number from the first free code, not from 1.
                 *
                 * The server skips a code that already exists, so a second run
                 * of "20 bays" against a zone that already had B001–B020
                 * created nothing at all — and the screen still said twenty
                 * bays were added. Starting after the highest existing code
                 * means a second run does what it says.
                 */
                const used = slots
                  .filter((s) => s.zoneId === targetZone && s.code.startsWith(bulk.prefix))
                  .map((s) => Number(s.code.slice(bulk.prefix.length)))
                  .filter((n) => Number.isFinite(n));
                const from = used.length ? Math.max(...used) + 1 : 1;
                const to = from + bulk.count - 1;

                let outcome: { created: number; skippedExisting: string[] } | null = null;

                setBulkBusy(true);
                void apply(
                  async () => {
                    const { data } = await slotsApi.bulkCreate({
                      zoneId: targetZone,
                      prefix: bulk.prefix,
                      from,
                      to,
                      type: bulk.type,
                    });
                    outcome = data;
                  },
                  // The demo path numbers the run the same way the server does.
                  (list) => [
                    ...Array.from({ length: bulk.count }).map((_, i) => ({
                      id: `slt_new_${targetZone}_${bulk.prefix}${from + i}`,
                      zoneId: targetZone,
                      zoneName: zones.find((z) => z.id === targetZone)?.name ?? "—",
                      code: `${bulk.prefix}${String(from + i).padStart(3, "0")}`,
                      type: bulk.type,
                      status: "AVAILABLE" as const,
                      isReserved: false,
                    })),
                    ...list,
                  ],
                  // No success message here — the real count is only known
                  // once the server answers, and it is reported below.
                )
                  .then(() => {
                    setBulkOpen(false);
                    const created = outcome?.created ?? bulk.count;
                    const skipped = outcome?.skippedExisting.length ?? 0;
                    if (created === 0) {
                      toast.warning("No bays were added", {
                        description: `All ${skipped} of those codes already exist in this zone.`,
                      });
                      return;
                    }
                    toast.success(`${created} ${created === 1 ? "bay" : "bays"} created`, {
                      description:
                        `${bulk.prefix}${String(from).padStart(3, "0")}–` +
                        `${bulk.prefix}${String(to).padStart(3, "0")}` +
                        (skipped ? ` · ${skipped} already existed and were skipped.` : " added."),
                    });
                  })
                  .catch(() => undefined)
                  .finally(() => setBulkBusy(false));
              }}
            >
              {bulkBusy && <Loader2 className="size-4 animate-spin" />}
              Create bays
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------- edit bay */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bay {selected?.code}</DialogTitle>
            <DialogDescription>
              {selected?.zoneName}. Type and reservation are one call, status is another — the
              server keeps them apart because taking a bay out of service is a decision that has to
              carry a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-code">Bay code</Label>
              <Input id="edit-code" value={selected?.code ?? ""} readOnly disabled className="font-mono" />
              {/**
               * `UpdateSlotSchema` takes `type` and `isReserved` and nothing
               * else — a bay cannot be renamed. The code is painted on the kerb
               * and printed on every session that ever used it, so a rename
               * would silently rewrite history. Retire the bay and add the new
               * one instead.
               */}
              <p className="text-xs text-muted-foreground">
                Fixed once painted. Remove the bay and add it again to renumber.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-type">Bay type</Label>
              <Select
                value={edit.type}
                onValueChange={(v) => setEdit((e) => ({ ...e, type: v as SlotType }))}
              >
                <SelectTrigger id="edit-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={edit.status}
                onValueChange={(v) => setEdit((e) => ({ ...e, status: v as SlotStatus }))}
              >
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="RESERVED">Reserved</SelectItem>
                  <SelectItem value="OUT_OF_SERVICE">Out of service</SelectItem>
                  {/* OCCUPIED is set by a session starting, never by hand — a
                      bay this screen marks occupied has no vehicle in it. */}
                  <SelectItem value="OCCUPIED" disabled>
                    Occupied — set by a session
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-reserved">Held back</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border px-3">
                <Switch
                  id="edit-reserved"
                  checked={edit.isReserved}
                  onCheckedChange={(v) => setEdit((e) => ({ ...e, isReserved: v }))}
                />
                <span className="text-xs text-muted-foreground">
                  {edit.isReserved ? "Reserved for permit holders" : "Open to any vehicle"}
                </span>
              </div>
            </div>
            {edit.status === "OUT_OF_SERVICE" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-reason">Why is it out of service?</Label>
                <Input
                  id="edit-reason"
                  value={edit.reason}
                  onChange={(e) => setEdit((s) => ({ ...s, reason: e.target.value }))}
                  placeholder="Resurfacing / bollard damaged / scaffolding over the bay"
                />
                <p className="text-xs text-muted-foreground">
                  The API insists on this, and it is right to — an unexplained blocked bay is lost
                  revenue nobody can account for later.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selected) return;
                const typeChanged = edit.type !== selected.type;
                const reservedChanged = edit.isReserved !== selected.isReserved;
                const statusChanged = edit.status !== selected.status;
                if (!typeChanged && !reservedChanged && !statusChanged) {
                  setEditOpen(false);
                  return;
                }
                if (edit.status === "OUT_OF_SERVICE" && edit.reason.trim().length < 4) {
                  toast.error("Say why the bay is out of service");
                  return;
                }
                void apply(
                  async () => {
                    // Two endpoints, in this order: the attributes first, so a
                    // bay that ends up out of service does so as the last thing
                    // written against it and the reason is the newest entry in
                    // the audit trail.
                    if (typeChanged || reservedChanged) {
                      await slotsApi.update(selected.id, {
                        ...(typeChanged ? { type: edit.type } : {}),
                        ...(reservedChanged ? { isReserved: edit.isReserved } : {}),
                      });
                    }
                    if (statusChanged) {
                      await slotsApi.changeStatus(
                        selected.id,
                        edit.status,
                        edit.status === "OUT_OF_SERVICE" ? edit.reason.trim() : undefined,
                      );
                    }
                  },
                  (list) =>
                    list.map((s) =>
                      s.id === selected.id
                        ? { ...s, type: edit.type, isReserved: edit.isReserved, status: edit.status }
                        : s,
                    ),
                  { success: `Bay ${selected.code} updated`, description: selected.zoneName },
                )
                  .then(() => setEditOpen(false))
                  .catch(() => undefined);
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove bay ${selected?.code}?`}
        destructive
        confirmLabel="Remove bay"
        description="The bay disappears from the map and can no longer be assigned. Historic sessions that referenced it are unaffected."
        onConfirm={async () => {
          if (!selected) return;
          await apply(
            () => slotsApi.remove(selected.id),
            (list) => list.filter((s) => s.id !== selected.id),
            { success: "Bay removed", description: `${selected.code} · ${selected.zoneName}` },
          );
        }}
      />

      <div className="text-xs text-muted-foreground">
        Looking for the zone itself?{" "}
        <Link href={ROUTES.zones} className="underline-offset-2 hover:underline">
          Open parking zones
        </Link>
        .
      </div>
    </div>
  );
}
