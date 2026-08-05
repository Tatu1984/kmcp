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
import { Plate, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SLOTS, ZONES } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
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

  const [slots, setSlots] = React.useState<Slot[]>(SLOTS);
  const [zoneId, setZoneId] = React.useState(zoneParam ?? "__all");
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Slot | null>(null);

  const data = React.useMemo(
    () => (zoneId === "__all" ? slots : slots.filter((s) => s.zoneId === zoneId)),
    [slots, zoneId],
  );

  const setStatus = (slot: Slot, status: SlotStatus, label: string) => {
    setSlots((list) => list.map((s) => (s.id === slot.id ? { ...s, status } : s)));
    toast.success(`Bay ${slot.code} marked ${label}`, {
      description: slot.zoneName,
      action: {
        label: "Undo",
        onClick: () =>
          setSlots((list) => list.map((s) => (s.id === slot.id ? { ...s, status: slot.status } : s))),
      },
    });
  };

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
        cell: ({ row }) => <StatusBadge status={row.original.status} pulse={row.original.status === "OCCUPIED"} />,
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
                actions={[
                  {
                    label: "Edit bay",
                    icon: Pencil,
                    onSelect: () => toast.info(`Editing bay ${slot.code}`, { description: slot.zoneName }),
                  },
                  {
                    label: "Set status",
                    icon: SquareStack,
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
                    children: (["CAR", "TWO_WHEELER", "EV", "VIP", "ACCESSIBLE"] as SlotType[]).map((t) => ({
                      label: VEHICLE_TYPE_LABELS[t],
                      onSelect: () => {
                        setSlots((list) => list.map((s) => (s.id === slot.id ? { ...s, type: t } : s)));
                        toast.success(`Bay ${slot.code} is now a ${VEHICLE_TYPE_LABELS[t]} bay`);
                      },
                    })),
                  },
                  {
                    label: "Block bay",
                    icon: ShieldBan,
                    separatorBefore: true,
                    onSelect: () => setStatus(slot, "OUT_OF_SERVICE", "blocked"),
                  },
                  {
                    label: "Remove bay",
                    icon: Trash2,
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
    [],
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
        description="Individual bays within each zone — type, reservation and live status."
        actions={
          <>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger size="sm" className="h-9 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All zones</SelectItem>
                {ZONES.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.code} · {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9" onClick={() => setBulkOpen(true)}>
              <Plus className="size-4" /> Add bays
            </Button>
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
            description="Click a bay to change its status. Colour follows live occupancy."
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
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() =>
                      setStatus(
                        slot,
                        slot.status === "AVAILABLE" ? "OUT_OF_SERVICE" : "AVAILABLE",
                        slot.status === "AVAILABLE" ? "out of service" : "available",
                      )
                    }
                    className={cn(
                      "rounded-lg border p-2 text-center transition-all hover:scale-[1.04]",
                      tone,
                    )}
                    title={`${slot.zoneName} · ${VEHICLE_TYPE_LABELS[slot.type]} · ${slot.status}`}
                  >
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
            onExport={(rows) => toast.success("Export queued", { description: `${rows.length} bays` })}
            bulkActions={(rows, clear) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => {
                    setSlots((list) =>
                      list.map((s) => (rows.some((r) => r.id === s.id) ? { ...s, status: "OUT_OF_SERVICE" } : s)),
                    );
                    toast.success(`${rows.length} bays taken out of service`);
                    clear();
                  }}
                >
                  Take out of service
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => {
                    setSlots((list) =>
                      list.map((s) => (rows.some((r) => r.id === s.id) ? { ...s, status: "AVAILABLE" } : s)),
                    );
                    toast.success(`${rows.length} bays returned to service`);
                    clear();
                  }}
                >
                  Return to service
                </Button>
              </>
            )}
            emptyTitle="No bays configured"
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
              <Select defaultValue={zoneId === "__all" ? ZONES[0].id : zoneId}>
                <SelectTrigger id="bulk-zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} · {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-type">Bay type</Label>
              <Select defaultValue="CAR">
                <SelectTrigger id="bulk-type">
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
              <Input id="bulk-prefix" defaultValue="C" className="font-mono" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-count">How many</Label>
              <Input id="bulk-count" type="number" defaultValue={20} min={1} max={200} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setBulkOpen(false);
                toast.success("20 bays created", {
                  description: "C01–C20 added and available for allocation.",
                });
              }}
            >
              Create bays
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
        onConfirm={() => {
          setSlots((list) => list.filter((s) => s.id !== selected?.id));
          toast.success("Bay removed", { description: `${selected?.code} · ${selected?.zoneName}` });
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
