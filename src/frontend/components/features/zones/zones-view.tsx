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
  Printer,
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
import { DataTable, facetOptionsFrom } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge, AvailabilityBadge } from "@/frontend/components/shared/status-badge";
import { Can } from "@/frontend/components/shared/can";
import { ZoneScopeBadge } from "@/frontend/components/shared/zone-scope";
import { Money, OccupancyBar } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { ZoneFormSheet } from "./zone-form-sheet";
import { ZoneStatusDialog } from "./zone-status-dialog";
import { ZONES, VENDORS } from "@/frontend/lib/mock";
import { zonesApi, vendorsApi, documentsApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { isLiveApi } from "@/config/env";
import { toZone, toZonePayload } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { ROUTES } from "@/shared/constants/routes";
import { percent } from "@/shared/utils/common.util";
import type { Zone } from "@/shared/types/domain.types";

export function ZonesView() {
  const router = useRouter();
  const { isZoneScoped } = usePermissions();

  const {
    items: zones,
    isLoading,
    emptyReason,
    apply,
  } = useResource<Zone>(
    ["zones", "list"],
    () => listAll((page, pageSize) => zonesApi.list({ page, pageSize })).then((r) => r.map(toZone)),
    ZONES,
  );

  // The assign-vendor menu offers whoever the API says is approved, falling
  // back to the demo roster when no backend is configured.
  const { items: vendors } = useResource<{ id: string; orgName: string }>(
    ["vendors", "approved"],
    () =>
      listAll((page, pageSize) => vendorsApi.list({ status: "APPROVED", page, pageSize })).then(
        (r) => r.map((v) => ({ id: v.id, orgName: v.orgName })),
      ),
    VENDORS.filter((v) => v.status === "APPROVED").map((v) => ({ id: v.id, orgName: v.orgName })),
  );
  const { run: runDocument } = useDocument();

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
                    // GET /zones/:id — zones.controller.ts:79
                    permission: "zone.read",
                    shortcut: "↵",
                    onSelect: () => router.push(ROUTES.zone(zone.id)),
                  },
                  {
                    label: "Edit details",
                    icon: Pencil,
                    // PATCH /zones/:id — zones.controller.ts:105
                    permission: "zone.write",
                    onSelect: () => openEdit(zone),
                  },
                  {
                    label: "Manage slots",
                    icon: SquareStack,
                    // The slots screen lists bays from GET /slots, which is
                    // guarded on zone.read (slots.controller.ts:32). Editing
                    // them there needs slot.write, and that screen says so.
                    permission: "zone.read",
                    onSelect: () => router.push(`${ROUTES.slots}?zone=${zone.id}`),
                  },
                  {
                    label: "Print zone signage",
                    icon: Printer,
                    // GET /documents/zones/:id/signage — documents.controller.ts,
                    // on zone.read like the detail route. Offered from the list
                    // as well as the detail page because signage is reprinted a
                    // dozen zones at a time when a tariff changes, and walking
                    // into each zone to do it is the reason it does not happen.
                    permission: "zone.read",
                    onSelect: () => {
                      void runDocument(zone.id, () => documentsApi.zoneSignage(zone.id), {
                        demo: () =>
                          toast.success("Signage sheet queued", {
                            description: `${zone.code} · tariff board and QR for ${zone.name}`,
                          }),
                        mode: "print",
                        success: "Signage opened for printing",
                        description: `${zone.code} · ${zone.name}`,
                      });
                    },
                  },
                  {
                    label: "Change status",
                    icon: ToggleLeft,
                    // POST /zones/:id/status — zones.controller.ts:118. Its own
                    // permission, separate from zone.write: closing a zone is
                    // an operational call a duty officer makes, while editing
                    // the kerb itself is not.
                    permission: "zone.status",
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
                    // POST /zones/:id/vendor — zones.controller.ts:136
                    permission: "zone.write",
                    children: vendors.map((v) => ({
                      label: v.orgName,
                      onSelect: () =>
                        void apply(
                          () => zonesApi.assignVendor(zone.id, v.id),
                          (list) =>
                            list.map((z) =>
                              z.id === zone.id ? { ...z, vendorId: v.id, vendorName: v.orgName } : z,
                            ),
                          { success: "Vendor assigned", description: `${zone.name} → ${v.orgName}` },
                        ).catch(() => undefined),
                    })),
                  },
                  // Copying a code and opening a map are the browser's own
                  // doing — no request, so no permission to check.
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
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${zone.center.lat},${zone.center.lng}`,
                        "_blank",
                        "noopener,noreferrer",
                      ),
                  },
                  {
                    label: "Retire zone",
                    icon: Trash2,
                    // DELETE /zones/:id — zones.controller.ts:149
                    permission: "zone.write",
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
    [router, apply, vendors, runDocument],
  );

  /**
   * All four cards are counted from the zone list this screen already holds.
   *
   * `GET /analytics/overview` carries the first three, but they sit beside
   * "of N configured" and beside the closed and unassigned counts, which can
   * only come from these rows — and an overview fetched separately drifts a
   * few seconds out of step with them, so the row of cards ends up quietly
   * contradicting itself. One list cannot disagree with itself, and it saves
   * a request. (These read the mock DASHBOARD until now, which reported the
   * demo city's totals on a live deployment.)
   */
  const openCount = zones.filter((z) => z.status === "OPEN").length;
  const totalCapacity = zones.reduce((sum, z) => sum + z.capacity, 0);
  const totalOccupied = zones.reduce((sum, z) => sum + z.occupied, 0);
  const closedCount = zones.filter((z) => z.status !== "OPEN").length;
  const unassigned = zones.filter((z) => !z.vendorId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking zones"
        // The badge is the whole scope treatment on this screen. The four cards
        // below are already counted from these rows and the API only sends a
        // scoped officer their own — so the figures were right all along; what
        // was missing was any way to tell that "of 3 configured" meant three in
        // *your* wards rather than three in the city.
        meta={<ZoneScopeBadge />}
        description="Every geo-fenced stretch of kerb the authority operates. The boundary decides where an attendant may start a session."
        actions={
          /**
           * Both create zones, so both answer to `zone.write`
           * (zones.controller.ts:93). Hidden rather than disabled: a create
           * button an account can never press is noise on every visit.
           */
          <Can permission="zone.write">
            {/**
             * Still a toast. There is no bulk-create route — POST /zones takes
             * one zone — and a real import is not a loop over it: it needs CSV
             * parsing, a preview of what will be created, per-row validation of
             * the boundary polygons, and a partial-failure report. That belongs
             * behind a zones import endpoint, not in this button.
             */}
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
          </Can>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard
            label="Zones live"
            numeric={openCount}
            icon={LandPlot}
            hint={`of ${zones.length} ${isZoneScoped ? "allocated to you" : "configured"}`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Bays managed"
            numeric={totalCapacity}
            icon={SquareStack}
            accent="info"
            hint={`${totalOccupied} occupied right now`}
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
            /**
             * The operators named in this column, not the demo roster: a live
             * deployment's vendors have their own names, so options built from
             * VENDORS match no row and empty the table when picked. Reading the
             * rows also keeps the list to vendors that actually hold kerb —
             * `vendors` above is the approved roster, which is the right list
             * to assign from and the wrong one to filter by.
             */
            options: isLiveApi
              ? facetOptionsFrom(zones, (z) => z.vendorName)
              : VENDORS.map((v) => ({ value: v.orgName, label: v.orgName })),
          },
        ]}
        onRowClick={(zone) => router.push(ROUTES.zone(zone.id))}
        onExport={(rows, columns) => {
          // What the operator is looking at — current search, filters and
          // visible columns — written to a file here, rather than a toast
          // promising an email nothing was ever going to send.
          const file = downloadCsv("zones", rows, columns);
          toast.success("Export ready", { description: `${rows.length} zones · ${file}` });
        }}
        bulkActions={(rows, clear) => (
          <>
            {/* Both call POST /zones/:id/status — zones.controller.ts:118 */}
            <Can permission="zone.status">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() =>
                  void apply(
                    () =>
                      Promise.all(
                        rows.map((z) =>
                          zonesApi.changeStatus(z.id, "MAINTENANCE", "Closed for maintenance"),
                        ),
                      ),
                    (list) =>
                      list.map((z) =>
                        rows.some((r) => r.id === z.id)
                          ? { ...z, status: "MAINTENANCE" as const, closureReason: "Closed for maintenance" }
                          : z,
                      ),
                    {
                      success: `${rows.length} zones closed for maintenance`,
                      description: "Citizens now see a closure notice for these zones.",
                    },
                  )
                    .then(clear)
                    .catch(() => undefined)
                }
              >
                Close for maintenance
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() =>
                  void apply(
                    () => Promise.all(rows.map((z) => zonesApi.changeStatus(z.id, "OPEN"))),
                    (list) =>
                      list.map((z) =>
                        rows.some((r) => r.id === z.id)
                          ? { ...z, status: "OPEN" as const, closureReason: undefined }
                          : z,
                      ),
                    { success: `${rows.length} zones reopened` },
                  )
                    .then(clear)
                    .catch(() => undefined)
                }
              >
                Reopen
              </Button>
            </Can>
            {/**
             * Still a toast. Unlike the two above it, this one cannot be a loop
             * over the single-zone route (POST /zones/:id/vendor): picking the
             * vendor needs a dialog this toolbar has nowhere to put, and
             * reassigning kerb mid-contract has commission and settlement
             * consequences the API settles one zone at a time. It waits on a
             * bulk assign-vendor endpoint that can accept or refuse the whole
             * set at once — half a set reassigned is worse than none.
             */}
            <Can permission="zone.write">
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
            </Can>
          </>
        )}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No zones yet"}
        emptyDescription={
          emptyReason ?? "Create your first parking zone to start recording sessions at the kerb."
        }
        emptyAction={
          <Can permission="zone.write">
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> New zone
            </Button>
          </Can>
        }
      />

      <ZoneFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        zone={selected}
        onSaved={(draft) =>
          apply(
            () =>
              selected
                ? zonesApi.update(selected.id, toZonePayload(draft))
                : zonesApi.create(toZonePayload(draft)),
            (list) =>
              selected
                ? list.map((z) => (z.id === selected.id ? ({ ...z, ...draft } as Zone) : z))
                : [
                    {
                      ...(draft as Zone),
                      id: `zn_new_${list.length + 1}`,
                      wardName: draft.wardName ?? "—",
                      occupied: 0,
                      status: "OPEN",
                      createdAt: new Date().toISOString(),
                      center: draft.center ?? { lat: 22.5726, lng: 88.3639 },
                    },
                    ...list,
                  ],
            { success: selected ? "Zone updated" : "Zone created", description: draft.name },
          )
        }
      />

      <ZoneStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        zone={selected}
        onChanged={(status, reason, until) => {
          if (!selected) return;
          void apply(
            () => zonesApi.changeStatus(selected.id, status, reason, until),
            (list) =>
              list.map((z) =>
                z.id === selected.id ? { ...z, status, closureReason: reason, closureUntil: until } : z,
              ),
          ).catch(() => undefined);
        }}
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
        onConfirm={async (reason) => {
          if (!selected) return;
          await apply(
            () => zonesApi.retire(selected.id, reason ?? "Retired from the portal"),
            (list) =>
              list.map((z) =>
                z.id === selected.id ? { ...z, status: "CLOSED", closureReason: reason } : z,
              ),
            {
              success: "Zone retired",
              description: `${selected.name} is withdrawn from service. Written to the audit trail.`,
            },
          );
        }}
      />
    </div>
  );
}
