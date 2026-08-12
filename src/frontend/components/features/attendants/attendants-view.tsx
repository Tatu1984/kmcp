"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Building2,
  ChartNoAxesColumn,
  LandPlot,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Smartphone,
  SmartphoneNfc,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
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
import { Money, PersonCell } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { ATTENDANTS, VENDORS, ZONES } from "@/frontend/lib/mock";
import { attendantsApi, vendorsApi, zonesApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { toAttendant } from "@/frontend/lib/adapters";
import type { Attendant } from "@/shared/types/domain.types";

export function AttendantsView() {
  const {
    items: attendants,
    isLoading,
    emptyReason,
    apply,
  } = useResource<Attendant>(
    ["attendants", "list"],
    () =>
      listAll((page, pageSize) => attendantsApi.list({ page, pageSize })).then((r) =>
        r.map(toAttendant),
      ),
    ATTENDANTS,
  );

  const { items: vendorOptions } = useResource<{ id: string; orgName: string }>(
    ["vendors", "approved"],
    () =>
      vendorsApi
        .list({ status: "APPROVED", pageSize: 100 })
        .then((r) => r.data.map((v) => ({ id: v.id, orgName: v.orgName }))),
    VENDORS.filter((v) => v.status === "APPROVED").map((v) => ({ id: v.id, orgName: v.orgName })),
  );

  const { items: zoneOptions } = useResource<{ id: string; code: string; name: string }>(
    ["zones", "picker"],
    () =>
      listAll((page, pageSize) => zonesApi.list({ page, pageSize })).then((r) =>
        r.map((z) => ({ id: z.id, code: z.code, name: z.name })),
      ),
    ZONES.map((z) => ({ id: z.id, code: z.code, name: z.name })),
  );
  const [selected, setSelected] = React.useState<Attendant | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [unbindOpen, setUnbindOpen] = React.useState(false);

  const columns = React.useMemo<ColumnDef<Attendant, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Attendant",
        meta: "Attendant",
        cell: ({ row }) => (
          <PersonCell name={row.original.name} secondary={`${row.original.employeeCode} · ${row.original.phone}`} />
        ),
      },
      {
        accessorKey: "vendorName",
        header: "Vendor",
        meta: "Vendor",
        cell: ({ row }) => <span className="truncate text-sm">{row.original.vendorName}</span>,
      },
      {
        accessorKey: "zoneName",
        header: "Zone",
        meta: "Zone",
        cell: ({ row }) =>
          row.original.zoneName ? (
            <span className="truncate text-sm">{row.original.zoneName}</span>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Unassigned
            </Badge>
          ),
      },
      {
        id: "shift",
        accessorFn: (a) => (a.onShift ? "On shift" : a.isActive ? "Off shift" : "Inactive"),
        header: "Shift",
        meta: "Shift",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.onShift ? "ACTIVE" : row.original.isActive ? "INACTIVE" : "SUSPENDED"}
            label={row.original.onShift ? "On shift" : row.original.isActive ? "Off shift" : "Deactivated"}
            pulse={row.original.onShift}
          />
        ),
      },
      {
        id: "device",
        accessorFn: (a) => (a.deviceBound ? "Bound" : "Unbound"),
        header: "Device",
        meta: "Device",
        cell: ({ row }) =>
          row.original.deviceBound ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Smartphone className="size-3.5" /> Bound
            </span>
          ) : (
            <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
              <SmartphoneNfc className="size-3" /> Not bound
            </Badge>
          ),
      },
      {
        accessorKey: "sessionsToday",
        header: "Today",
        meta: "Sessions today",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-sm tabular">{row.original.sessionsToday} sessions</p>
            <Money value={row.original.collectionToday} className="text-[11px] text-muted-foreground" />
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const attendant = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={attendant.name}
                actions={[
                  {
                    label: "Edit attendant",
                    icon: Pencil,
                    onSelect: () => {
                      setSelected(attendant);
                      setFormOpen(true);
                    },
                  },
                  {
                    label: "Call",
                    icon: Phone,
                    onSelect: () => toast.info("Calling", { description: attendant.phone }),
                  },
                  {
                    label: "Assign zone",
                    icon: LandPlot,
                    separatorBefore: true,
                    children: zoneOptions
                      .slice(0, 8)
                      .map((z) => ({
                        label: z.name,
                        onSelect: () =>
                          void apply(
                            () => attendantsApi.update(attendant.id, { defaultZoneId: z.id }),
                            (list) =>
                              list.map((a) =>
                                a.id === attendant.id ? { ...a, zoneId: z.id, zoneName: z.name } : a,
                              ),
                            { success: "Zone assigned", description: `${attendant.name} → ${z.name}` },
                          ).catch(() => undefined),
                      })),
                  },
                  {
                    label: "Move to vendor",
                    icon: Building2,
                    children: vendorOptions.map((v) => ({
                      label: v.orgName,
                      onSelect: () =>
                        void apply(
                          () =>
                            attendantsApi.transfer(
                              attendant.id,
                              v.id,
                              "Moved from the attendants screen",
                            ),
                          (list) =>
                            list.map((a) =>
                              a.id === attendant.id ? { ...a, vendorId: v.id, vendorName: v.orgName } : a,
                            ),
                          { success: "Attendant moved", description: v.orgName },
                        ).catch(() => undefined),
                    })),
                  },
                  {
                    label: "View GPS trail",
                    icon: MapPin,
                    separatorBefore: true,
                    onSelect: () =>
                      toast.info("GPS trail", {
                        description: `${attendant.name} · check-in and check-out points for today`,
                      }),
                  },
                  {
                    label: "Performance",
                    icon: ChartNoAxesColumn,
                    onSelect: () =>
                      toast.info("Performance", {
                        description: `${attendant.sessionsToday} sessions today · rating ${attendant.rating}`,
                      }),
                  },
                  {
                    label: "Unbind device",
                    icon: SmartphoneNfc,
                    hidden: !attendant.deviceBound,
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(attendant);
                      setUnbindOpen(true);
                    },
                  },
                  {
                    label: attendant.isActive ? "Deactivate" : "Reactivate",
                    icon: attendant.isActive ? UserRoundX : UserCheck,
                    destructive: attendant.isActive,
                    onSelect: () => {
                      if (attendant.isActive) {
                        setSelected(attendant);
                        setDeactivateOpen(true);
                      } else {
                        void apply(
                          () =>
                            attendantsApi.setActive(attendant.id, true, "Reactivated from the portal"),
                          (list) =>
                            list.map((a) => (a.id === attendant.id ? { ...a, isActive: true } : a)),
                          { success: "Attendant reactivated", description: attendant.name },
                        ).catch(() => undefined);
                      }
                    },
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [apply, vendorOptions, zoneOptions],
  );

  const onShift = attendants.filter((a) => a.onShift).length;
  const unbound = attendants.filter((a) => !a.deviceBound).length;
  const unassigned = attendants.filter((a) => !a.zoneId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendants"
        description="Field staff employed by vendors. Each account is bound to one device — a token from an unregistered device is refused."
        actions={
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Add attendant
          </Button>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="On shift now" numeric={onShift} icon={Users} accent="success" hint={`of ${attendants.length} attendants`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Collected today"
            value={<Money value={attendants.reduce((s, a) => s + (a.collectionToday ?? 0), 0)} compact />}
            icon={ChartNoAxesColumn}
            hint={`${attendants.reduce((s, a) => s + (a.sessionsToday ?? 0), 0)} sessions started`}
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Device not bound"
            numeric={unbound}
            icon={SmartphoneNfc}
            accent={unbound > 0 ? "warning" : "success"}
            hint="Cannot sign in until a device is registered"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="No zone assigned"
            numeric={unassigned}
            icon={LandPlot}
            accent={unassigned > 0 ? "warning" : "success"}
            hint="Cannot start a session anywhere"
          />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={attendants}
        columns={columns}
        enableSelection
        searchKeys={["name", "employeeCode", "phone", "vendorName", "zoneName"]}
        searchPlaceholder="Search name, code, phone, vendor or zone…"
        facets={[
          {
            columnId: "vendorName",
            label: "Vendor",
            options: VENDORS.map((v) => ({ value: v.orgName, label: v.orgName })),
          },
          {
            columnId: "shift",
            label: "Shift",
            options: [
              { value: "On shift", label: "On shift" },
              { value: "Off shift", label: "Off shift" },
              { value: "Inactive", label: "Deactivated" },
            ],
          },
          {
            columnId: "device",
            label: "Device",
            options: [
              { value: "Bound", label: "Bound" },
              { value: "Unbound", label: "Not bound" },
            ],
          },
        ]}
        onExport={(rows) => toast.success("Export queued", { description: `${rows.length} attendants` })}
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success(`Credentials re-sent to ${rows.length} attendants`);
                clear();
              }}
            >
              Re-send credentials
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() =>
                void apply(
                  () =>
                    Promise.all(
                      rows.map((a) =>
                        attendantsApi.unbindDevices(a.id, "Bulk unbind from the portal"),
                      ),
                    ),
                  (list) =>
                    list.map((a) => (rows.some((r) => r.id === a.id) ? { ...a, deviceBound: false } : a)),
                  { success: `${rows.length} devices unbound` },
                )
                  .then(clear)
                  .catch(() => undefined)
              }
            >
              Unbind devices
            </Button>
          </>
        )}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No attendants"}
        emptyDescription="Vendors add field staff here so they can sign in to the vendor app."
      />

      {/* ------------------------------------------------------------- form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected ? `Edit ${selected.name}` : "Add an attendant"}</DialogTitle>
            <DialogDescription>
              The attendant signs in to the vendor app with the mobile number below. Their first
              sign-in binds the account to that device.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="att-name">Full name</Label>
              <Input id="att-name" defaultValue={selected?.name} placeholder="Subhash Das" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-code">Employee code</Label>
              <Input id="att-code" defaultValue={selected?.employeeCode} className="font-mono" placeholder="METR-118" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-phone">Mobile</Label>
              <Input id="att-phone" defaultValue={selected?.phone} placeholder="+91 98300 00000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-vendor">Vendor</Label>
              <Select defaultValue={selected?.vendorId ?? vendorOptions[0]?.id}>
                <SelectTrigger id="att-vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vendorOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.orgName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-zone">Default zone</Label>
              <Select defaultValue={selected?.zoneId ?? zoneOptions[0]?.id}>
                <SelectTrigger id="att-zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} · {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setFormOpen(false);
                toast.success(selected ? "Attendant updated" : "Attendant added", {
                  description: selected
                    ? selected.name
                    : "Sign-in credentials sent by SMS to the mobile number.",
                });
              }}
            >
              {selected ? "Save changes" : "Add attendant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={`Deactivate ${selected?.name}?`}
        destructive
        confirmLabel="Deactivate"
        reason={{ label: "Reason", placeholder: "Left the vendor / disciplinary / transferred…", required: true }}
        description="They can no longer sign in to the vendor app or start sessions. Any open shift must be closed and reconciled first."
        onConfirm={async (reason) => {
          if (!selected) return;
          await apply(
            () =>
              attendantsApi.setActive(
                selected.id,
                false,
                reason ?? "Deactivated from the portal",
              ),
            (list) =>
              list.map((a) => (a.id === selected.id ? { ...a, isActive: false, onShift: false } : a)),
            { success: "Attendant deactivated", description: selected.name },
          );
        }}
      />

      <ConfirmDialog
        open={unbindOpen}
        onOpenChange={setUnbindOpen}
        title={`Unbind ${selected?.name}'s device?`}
        confirmLabel="Unbind device"
        description="Their current device stops working immediately. The next sign-in binds whichever device they use — do this only when a handset is lost or replaced."
        onConfirm={async (reason) => {
          if (!selected) return;
          await apply(
            () => attendantsApi.unbindDevices(selected.id, reason ?? "Handset lost or replaced"),
            (list) => list.map((a) => (a.id === selected.id ? { ...a, deviceBound: false } : a)),
            { success: "Device unbound", description: `${selected.name} can register a new device.` },
          );
        }}
      />

      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground">
        <Ban className="mt-0.5 size-4 shrink-0" />
        <p className="text-pretty">
          Device binding is what stops an attendant account from being shared. A token presented from
          an unregistered device is refused with <span className="font-mono">DEVICE_NOT_BOUND</span>,
          and the attempt lands in the device log.
        </p>
      </div>
    </div>
  );
}
