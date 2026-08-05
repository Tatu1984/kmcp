"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  CircleSlash,
  Copy,
  Eye,
  LandPlot,
  MapPin,
  Pencil,
  Plus,
  SquareStack,
  ToggleLeft,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge, AvailabilityBadge } from "@/frontend/components/shared/status-badge";
import { Money, OccupancyBar } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { ZoneFormSheet } from "./zone-form-sheet";
import { ZoneStatusDialog } from "./zone-status-dialog";
import { ZONES, WARDS, VENDORS, DASHBOARD } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";
import { percent } from "@/shared/utils/common.util";
import type { Zone } from "@/shared/types/domain.types";

export function ZonesView() {
  const router = useRouter();
  const [zones, setZones] = React.useState<Zone[]>(ZONES);
  const [formOpen, setFormOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [retireOpen, setRetireOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Zone | null>(null);

  const openCreate = () => {
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (zone: Zone) => {
    setSelected(zone);
    setFormOpen(true);
  };
  const openStatus = (zone: Zone) => {
    setSelected(zone);
    setStatusOpen(true);
  };
  const openRetire = (zone: Zone) => {
    setSelected(zone);
    setRetireOpen(true);
  };

  const columns = React.useMemo<ColumnDef<Zone, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Zone",
        meta: "Zone",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
              <span className="truncate font-medium">{row.original.name}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.wardName} · {row.original.streetName}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge status={row.original.status} pulse={row.original.status === "OPEN"} />
            {row.original.closureReason && (
              <p className="max-w-40 truncate text-[11px] text-muted-foreground">
                {row.original.closureReason}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "occupancy",
        accessorFn: (z) => percent(z.occupied, z.capacity),
        header: "Occupancy",
        meta: "Occupancy",
        cell: ({ row }) => (
          <div className="w-40 space-y-1">
            <OccupancyBar occupied={row.original.occupied} capacity={row.original.capacity} />
            <AvailabilityBadge occupied={row.original.occupied} capacity={row.original.capacity} />
          </div>
        ),
      },
      {
        accessorKey: "vendorName",
        header: "Vendor",
        meta: "Vendor",
        cell: ({ row }) =>
          row.original.vendorName ? (
            <span className="truncate text-sm">{row.original.vendorName}</span>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Unassigned
            </Badge>
          ),
      },
      {
        id: "hours",
        accessorFn: (z) => `${z.openTime}–${z.closeTime}`,
        header: "Hours",
        meta: "Hours",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap tabular text-muted-foreground">
            {row.original.openTime}–{row.original.closeTime}
          </span>
        ),
      },
      {
        accessorKey: "revenueToday",
        header: "Today",
        meta: "Revenue today",
        cell: ({ row }) => <Money value={row.original.revenueToday} />,
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const zone = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={zone.code}
                actions={[
                  {
                    label: "View zone",
                    icon: Eye,
                    shortcut: "↵",
                    onSelect: () => router.push(ROUTES.zone(zone.id)),
                  },
                  { label: "Edit details", icon: Pencil, onSelect: () => openEdit(zone) },
                  {
                    label: "Manage slots",
                    icon: SquareStack,
                    onSelect: () => router.push(`${ROUTES.slots}?zone=${zone.id}`),
                  },
                  {
                    label: "Change status",
                    icon: ToggleLeft,
                    separatorBefore: true,
                    children: [
                      { label: "Open zone", onSelect: () => openStatus(zone) },
                      { label: "Maintenance closure", onSelect: () => openStatus(zone) },
                      { label: "Event closure", onSelect: () => openStatus(zone) },
                      { label: "Close zone", destructive: true, onSelect: () => openStatus(zone) },
                    ],
                  },
                  {
                    label: "Assign vendor",
                    icon: Building2,
                    children: VENDORS.filter((v) => v.status === "APPROVED").map((v) => ({
                      label: v.orgName,
                      onSelect: () => {
                        setZones((list) =>
                          list.map((z) =>
                            z.id === zone.id ? { ...z, vendorId: v.id, vendorName: v.orgName } : z,
                          ),
                        );
                        toast.success("Vendor assigned", {
                          description: `${zone.name} → ${v.orgName}`,
                          action: {
                            label: "Undo",
                            onClick: () =>
                              setZones((list) =>
                                list.map((z) =>
                                  z.id === zone.id
                                    ? { ...z, vendorId: zone.vendorId, vendorName: zone.vendorName }
                                    : z,
                                ),
                              ),
                          },
                        });
                      },
                    })),
                  },
                  {
                    label: "Copy zone code",
                    icon: Copy,
                    separatorBefore: true,
                    onSelect: () => {
                      void navigator.clipboard.writeText(zone.code);
                      toast.success("Copied", { description: zone.code });
                    },
                  },
                  {
                    label: "Open in maps",
                    icon: MapPin,
                    onSelect: () =>
                      toast.info("Opening map view", {
                        description: `${zone.center.lat}, ${zone.center.lng}`,
                      }),
                  },
                  {
                    label: "Retire zone",
                    icon: Trash2,
                    destructive: true,
                    separatorBefore: true,
                    onSelect: () => openRetire(zone),
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [router],
  );

  const closedCount = zones.filter((z) => z.status !== "OPEN").length;
  const unassigned = zones.filter((z) => !z.vendorId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking zones"
        description="Every geo-fenced stretch of kerb the authority operates. The boundary decides where an attendant may start a session."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() =>
                toast.info("Bulk import", {
                  description: "Upload a CSV of zones with GPS boundaries to create them in one go.",
                })
              }
            >
              <Upload className="size-4" /> Import
            </Button>
            <Button size="sm" className="h-9" onClick={openCreate}>
              <Plus className="size-4" /> New zone
            </Button>
          </>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Zones live" numeric={DASHBOARD.zonesOpen} icon={LandPlot} hint={`of ${zones.length} configured`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Bays managed"
            numeric={DASHBOARD.totalCapacity}
            icon={SquareStack}
            accent="info"
            hint={`${DASHBOARD.totalOccupied} occupied right now`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Closed or restricted"
            numeric={closedCount}
            icon={CircleSlash}
            accent={closedCount > 2 ? "warning" : "primary"}
            hint="Maintenance, event and withdrawn zones"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Unassigned kerb"
            numeric={unassigned}
            icon={TriangleAlert}
            accent={unassigned > 0 ? "danger" : "success"}
            hint="Zones with no vendor to operate them"
          />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={zones}
        columns={columns}
        enableSelection
        searchKeys={["code", "name", "wardName", "streetName", "vendorName"]}
        searchPlaceholder="Search by code, name, ward or vendor…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "OPEN", label: "Open" },
              { value: "MAINTENANCE", label: "Maintenance" },
              { value: "EVENT_CLOSURE", label: "Event closure" },
              { value: "CLOSED", label: "Closed" },
            ],
          },
          {
            columnId: "vendorName",
            label: "Vendor",
            options: VENDORS.map((v) => ({ value: v.orgName, label: v.orgName })),
          },
        ]}
        onRowClick={(zone) => router.push(ROUTES.zone(zone.id))}
        onExport={(rows) =>
          toast.success("Export queued", {
            description: `${rows.length} zones will be emailed to you as an Excel file.`,
          })
        }
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success(`${rows.length} zones closed for maintenance`, {
                  description: "Citizens now see a closure notice for these zones.",
                });
                clear();
              }}
            >
              Close for maintenance
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success(`${rows.length} zones reopened`);
                clear();
              }}
            >
              Reopen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() =>
                toast.info("Assign vendor", {
                  description: `Pick a vendor for the ${rows.length} selected zones.`,
                })
              }
            >
              Assign vendor
            </Button>
          </>
        )}
        emptyTitle="No zones yet"
        emptyDescription="Create your first parking zone to start recording sessions at the kerb."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> New zone
          </Button>
        }
      />

      <ZoneFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        zone={selected}
        onSaved={(draft) => {
          if (selected) {
            setZones((list) =>
              list.map((z) => (z.id === selected.id ? { ...z, ...draft } as Zone : z)),
            );
          } else {
            const ward = WARDS.find((w) => w.id === draft.wardId);
            setZones((list) => [
              {
                ...(draft as Zone),
                id: `zn_new_${list.length + 1}`,
                wardName: ward?.name ?? "—",
                occupied: 0,
                status: "OPEN",
                revenueToday: 0,
                revenueMonth: 0,
                slotCount: draft.capacity ?? 0,
                createdAt: new Date().toISOString(),
                center: { lat: 22.5726, lng: 88.3639 },
              },
              ...list,
            ]);
          }
        }}
      />

      <ZoneStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        zone={selected}
        onChanged={(status, reason, until) =>
          setZones((list) =>
            list.map((z) =>
              z.id === selected?.id
                ? { ...z, status, closureReason: reason, closureUntil: until }
                : z,
            ),
          )
        }
      />

      <ConfirmDialog
        open={retireOpen}
        onOpenChange={setRetireOpen}
        title={`Retire ${selected?.name}?`}
        destructive
        confirmLabel="Retire zone"
        typeToConfirm={selected?.code}
        reason={{
          label: "Why is this zone being retired?",
          placeholder: "Contract ended / kerb reallocated to a bus lane…",
          required: true,
        }}
        description={
          <div className="space-y-2">
            <p>
              Retiring removes the zone from the citizen app and blocks all new sessions. Historic
              sessions, payments and settlements are kept for audit — nothing is deleted.
            </p>
            {selected && selected.occupied > 0 && (
              <p className="font-medium text-destructive">
                {selected.occupied} vehicles are parked here right now. They will still be charged
                normally when the attendant ends their sessions.
              </p>
            )}
          </div>
        }
        onConfirm={(reason) => {
          setZones((list) =>
            list.map((z) =>
              z.id === selected?.id ? { ...z, status: "CLOSED", closureReason: reason } : z,
            ),
          );
          toast.success("Zone retired", {
            description: `${selected?.name} is withdrawn from service. Written to the audit trail.`,
          });
        }}
      />
    </div>
  );
}
