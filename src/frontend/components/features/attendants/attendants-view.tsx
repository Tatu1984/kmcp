"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Building2,
  CalendarClock,
  ChartNoAxesColumn,
  Eye,
  EyeOff,
  LandPlot,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Smartphone,
  SmartphoneNfc,
  Trash2,
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
import { DataTable, facetOptionsFrom } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { Can } from "@/frontend/components/shared/can";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { ROUTES } from "@/shared/constants/routes";
import { relativeTime } from "@/shared/utils/common.util";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, PersonCell } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { ATTENDANTS, VENDORS, ZONES } from "@/frontend/lib/mock";
import { attendantsApi, vendorsApi, zonesApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { isLiveApi } from "@/config/env";
import { toAttendant } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { mapWithConcurrency } from "@/frontend/lib/concurrency";
import type { Attendant } from "@/shared/types/domain.types";

/** What the form holds. `email` is absent because the list never carries one. */
type AttendantDraft = {
  name: string;
  employeeCode: string;
  phone: string;
  vendorId: string;
  zoneId: string;
  /**
   * Set once, when the account is created, and never read back.
   *
   * `UpdateAttendantSchema` omits `password` on purpose, so this is only ever
   * sent on the create call — the edit form does not show the field at all
   * rather than showing one that would be silently dropped.
   */
  password: string;
};

/** The shortest password `CreateAttendantSchema` will accept. */
const MIN_PASSWORD = 8;

/** The `Device.platform` strings the API stores, in the words an officer reads. */
const PLATFORM_LABEL: Record<string, string> = {
  android: "Android",
  ios: "iPhone",
  web: "Browser",
};

const EMPTY_DRAFT: AttendantDraft = {
  name: "",
  employeeCode: "",
  phone: "",
  vendorId: "",
  zoneId: "",
  password: "",
};

export function AttendantsView() {
  const {
    items: attendants,
    isLoading,
    isRefreshing,
    emptyReason,
    apply,
    refresh,
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
  const [formBusy, setFormBusy] = React.useState(false);
  const [form, setForm] = React.useState<AttendantDraft>(EMPTY_DRAFT);
  /**
   * The officer setting the password is the person who has to read it out to
   * the attendant, so they need to be able to see what they typed. It is also
   * the only check against a typo: there is no "reset password" endpoint, so a
   * mistyped password cannot be corrected from here afterwards.
   */
  const [showPassword, setShowPassword] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [unbindOpen, setUnbindOpen] = React.useState(false);

  const openForm = React.useCallback(
    (attendant: Attendant | null, presetVendorId?: string) => {
      setSelected(attendant);
      setForm({
        name: attendant?.name ?? "",
        employeeCode: attendant?.employeeCode ?? "",
        phone: attendant?.phone ?? "",
        vendorId: attendant?.vendorId ?? presetVendorId ?? vendorOptions[0]?.id ?? "",
        zoneId: attendant?.zoneId ?? zoneOptions[0]?.id ?? "",
        // Never carried over from an existing account: the portal cannot read
        // a password back (only a bcrypt hash exists server-side), and an edit
        // cannot change one.
        password: "",
      });
      setShowPassword(false);
      setFormOpen(true);
    },
    [vendorOptions, zoneOptions],
  );

  /**
   * The vendor screen sends people here to add staff to one operator.
   *
   * It links rather than growing its own copy of this form — this one knows the
   * zone roster and the employee-code rules, and two of it would drift — so the
   * vendor arrives in the query string and the form opens already pointed at
   * them. Fired once: reopening the dialog every time the URL is re-read would
   * make it impossible to close.
   */
  const router = useRouter();
  const params = useSearchParams();
  const presetVendor = params.get("vendor");
  const wantsNew = params.get("new") === "1";
  const openedFromUrl = React.useRef(false);

  React.useEffect(() => {
    if (!wantsNew || openedFromUrl.current) return;
    openedFromUrl.current = true;
    setSelected(null);
    setForm({ ...EMPTY_DRAFT, vendorId: presetVendor ?? "" });
    setShowPassword(false);
    setFormOpen(true);
  }, [wantsNew, presetVendor]);

  /**
   * The API requires all three, and an employee code in its own shape.
   *
   * A new account additionally needs a vendor and a password. The password is
   * required here although the DTO marks it optional, because an attendant
   * created without one holds a null hash and cannot sign in at all — and
   * nothing in this portal can give them one afterwards.
   */
  const canSaveAttendant =
    form.name.trim().length > 1 &&
    form.phone.trim().length > 7 &&
    /^[A-Za-z0-9-]{2,24}$/.test(form.employeeCode.trim()) &&
    (Boolean(selected) || (form.vendorId !== "" && form.password.length >= MIN_PASSWORD));

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
        cell: ({ row }) => {
          const { deviceBound, boundDevice } = row.original;
          if (!deviceBound) {
            return (
              <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                <SmartphoneNfc className="size-3" /> Not bound
              </Badge>
            );
          }
          /**
           * Which handset, and when it was last heard from — the two things an
           * officer deciding whether to release a binding actually needs. "Bound"
           * on its own cannot tell a working phone from a lost one.
           */
          return (
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 text-xs">
                <Smartphone className="size-3.5 shrink-0" />
                {PLATFORM_LABEL[boundDevice?.platform ?? ""] ?? boundDevice?.platform ?? "Bound"}
                {boundDevice?.appVersion ? (
                  <span className="text-muted-foreground">v{boundDevice.appVersion}</span>
                ) : null}
              </span>
              <p className="truncate text-[11px] text-muted-foreground">
                {boundDevice?.lastSeenAt ? `seen ${relativeTime(boundDevice.lastSeenAt)}` : "not seen yet"}
              </p>
            </div>
          );
        },
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
                    // PATCH /attendants/:id — attendants.controller.ts:69.
                    permission: "attendant.write",
                    onSelect: () => openForm(attendant),
                  },
                  {
                    label: "Call",
                    icon: Phone,
                    // Hands the number to the operator's machine. No call.
                    onSelect: () => toast.info("Calling", { description: attendant.phone }),
                  },
                  {
                    label: "Assign zone",
                    icon: LandPlot,
                    separatorBefore: true,
                    // PATCH /attendants/:id — attendants.controller.ts:69.
                    permission: "attendant.write",
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
                    /**
                     * POST /attendants/:id/transfer — attendants.controller.ts:115,
                     * and the only action in this menu guarded by `vendor.write`
                     * rather than `attendant.write`. Moving somebody between
                     * operators changes whose payroll and whose settlement they
                     * land in, so it is treated as an act on the vendors.
                     */
                    permission: "vendor.write",
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
                    // Waits on the sessions work: the positions are recorded per
                    // session event, and nothing here reads them back as a trail.
                    onSelect: () =>
                      toast.info("GPS trail", {
                        description: `${attendant.name} · check-in and check-out points for today`,
                      }),
                  },
                  {
                    label: "Performance",
                    icon: ChartNoAxesColumn,
                    // Repeats what is already on the row. A real performance
                    // view waits on the analytics module, which has no
                    // per-attendant endpoint yet.
                    onSelect: () =>
                      toast.info("Performance", {
                        description: `${attendant.sessionsToday} sessions today · rating ${attendant.rating}`,
                      }),
                  },
                  {
                    /**
                     * The way out of a refusal. Deactivate, transfer and delete
                     * are all blocked while a shift is open, and each says to
                     * close it — but the shift lives on another screen, under a
                     * name the officer would otherwise have to search for.
                     */
                    label: "Open shift",
                    icon: CalendarClock,
                    hidden: !attendant.onShift,
                    separatorBefore: true,
                    permission: "session.read",
                    onSelect: () =>
                      router.push(
                        `${ROUTES.shifts}?attendant=${encodeURIComponent(attendant.name)}`,
                      ),
                  },
                  {
                    label: "Unbind device",
                    icon: SmartphoneNfc,
                    hidden: !attendant.deviceBound,
                    separatorBefore: true,
                    // POST /attendants/:id/unbind-device — attendants.controller.ts:99.
                    permission: "attendant.write",
                    onSelect: () => {
                      setSelected(attendant);
                      setUnbindOpen(true);
                    },
                  },
                  {
                    label: attendant.isActive ? "Deactivate" : "Reactivate",
                    icon: attendant.isActive ? UserRoundX : UserCheck,
                    destructive: attendant.isActive,
                    // POST /attendants/:id/status — attendants.controller.ts:82.
                    permission: "attendant.write",
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
                  {
                    label: "Delete",
                    icon: Trash2,
                    destructive: true,
                    separatorBefore: true,
                    // DELETE /attendants/:id — attendants.controller.ts:133.
                    permission: "attendant.write",
                    onSelect: () => {
                      setSelected(attendant);
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
    [apply, vendorOptions, zoneOptions, openForm, router],
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
          // POST /attendants — attendants.controller.ts:54.
          <Can permission="attendant.write">
            <Button size="sm" className="h-9" onClick={() => openForm(null, presetVendor ?? undefined)}>
              <Plus className="size-4" /> Add attendant
            </Button>
          </Can>
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
            /**
             * The employers named in this column. Against a live backend the
             * demo roster offers vendors no attendant works for, so picking
             * one empties the table; `vendorOptions` above is the approved
             * roster, which is right for reassigning an attendant and wrong
             * here, where an attendant of a suspended vendor is still listed.
             */
            options: isLiveApi
              ? facetOptionsFrom(attendants, (a) => a.vendorName)
              : VENDORS.map((v) => ({ value: v.orgName, label: v.orgName })),
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
        onRefresh={() => {
          if (!isLiveApi) {
            toast.info("Demo data", {
              description: "This screen reads from the bundled demo dataset — there is nothing new to fetch.",
            });
            return;
          }
          void refresh();
        }}
        isRefreshing={isRefreshing}
        onExport={(rows, columns) => {
          const file = downloadCsv("attendants", rows, columns);
          toast.success("Export ready", { description: `${rows.length} attendants · ${file}` });
        }}
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              // Waits on the messaging module — credentials go out by SMS, and
              // no provider is configured.
              onClick={() => {
                toast.success(`Credentials re-sent to ${rows.length} attendants`);
                clear();
              }}
            >
              Re-send credentials
            </Button>
            {/* POST /attendants/:id/unbind-device — attendants.controller.ts:99. */}
            <Can permission="attendant.write">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() =>
                  void apply(
                    () =>
                      mapWithConcurrency(rows, 4, (a) =>
                        attendantsApi.unbindDevices(a.id, "Bulk unbind from the portal"),
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
            </Can>
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
              {selected
                ? "The attendant signs in to the vendor app with the mobile number below. Their first sign-in binds the account to that device."
                : "Set the mobile number and password the attendant will sign in to the vendor app with. Their first sign-in binds the account to that device."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="att-name">Full name</Label>
              <Input
                id="att-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Subhash Das"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-code">Employee code</Label>
              <Input
                id="att-code"
                value={form.employeeCode}
                // Uppercased on the way in because the API uppercases it anyway
                // — better the officer sees the code they will actually get.
                onChange={(e) => setForm({ ...form, employeeCode: e.target.value.toUpperCase() })}
                className="font-mono"
                placeholder="METR-118"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-phone">Mobile</Label>
              <Input
                id="att-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+919830000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-vendor">Vendor</Label>
              <Select
                value={form.vendorId}
                onValueChange={(vendorId) => setForm({ ...form, vendorId })}
                // An attendant cannot change employer through an edit — that is
                // a transfer, with its own endpoint and its own reason.
                disabled={Boolean(selected)}
              >
                <SelectTrigger id="att-vendor" className="w-full">
                  <SelectValue placeholder="Choose a vendor" />
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
              <Select value={form.zoneId} onValueChange={(zoneId) => setForm({ ...form, zoneId })}>
                <SelectTrigger id="att-zone" className="w-full">
                  <SelectValue placeholder="No default zone" />
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

            {/*
              * Creation only. An edit cannot change a password — the update DTO
              * drops the field — so showing the input there would be a control
              * that quietly does nothing.
              */}
            {selected ? null : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="att-password">Password</Label>
                <div className="relative">
                  <Input
                    id="att-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pr-10 font-mono"
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <p className="text-pretty text-xs text-muted-foreground">
                  {form.password.length > 0 && form.password.length < MIN_PASSWORD
                    ? `${MIN_PASSWORD - form.password.length} more character${
                        MIN_PASSWORD - form.password.length === 1 ? "" : "s"
                      } needed.`
                    : "They sign in to the vendor app with this mobile number and this password. Write it down before saving — it is stored only as a hash, so nothing can show it again, and it cannot be reset from the portal."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formBusy}>
              Cancel
            </Button>
            <Button
              disabled={!canSaveAttendant || formBusy}
              onClick={() => {
                if (!canSaveAttendant) return;
                const draft = {
                  name: form.name.trim(),
                  phone: form.phone.trim(),
                  employeeCode: form.employeeCode.trim(),
                  defaultZoneId: form.zoneId || undefined,
                };
                const vendorName =
                  vendorOptions.find((v) => v.id === form.vendorId)?.orgName ?? "—";
                const zoneName = zoneOptions.find((z) => z.id === form.zoneId)?.name;
                setFormBusy(true);
                void apply(
                  () =>
                    selected
                      ? // The update DTO omits vendorId on purpose; a change of
                        // employer goes through /transfer, which records why.
                        attendantsApi.update(selected.id, draft)
                      : // `password` is deliberately not part of `draft`: the
                        // same object feeds the update branch above, whose DTO
                        // drops the field, and the optimistic row below, which
                        // must never carry it.
                        attendantsApi.create({
                          ...draft,
                          vendorId: form.vendorId,
                          password: form.password,
                        }),
                  (list) =>
                    selected
                      ? list.map((a) =>
                          a.id === selected.id
                            ? { ...a, ...draft, zoneId: form.zoneId || undefined, zoneName }
                            : a,
                        )
                      : [
                          {
                            id: `att_new_${list.length}`,
                            name: draft.name,
                            employeeCode: draft.employeeCode,
                            phone: draft.phone,
                            vendorId: form.vendorId,
                            vendorName,
                            zoneId: form.zoneId || undefined,
                            zoneName,
                            isActive: true,
                            onShift: false,
                            // Nobody has signed in on a handset yet, so this is
                            // a definite false rather than "not known here".
                            deviceBound: false,
                            sessionsToday: 0,
                            collectionToday: 0,
                            createdAt: new Date().toISOString(),
                          },
                          ...list,
                        ],
                  {
                    success: selected ? "Attendant updated" : "Attendant added",
                    description: selected
                      ? selected.name
                      : `${draft.name} · ${vendorName}. They bind a device on their first sign-in.`,
                  },
                )
                  .then(() => {
                    // Drop the password from component state the moment it has
                    // been accepted; the dialog can be reopened without it
                    // sitting in memory behind a reveal toggle.
                    setForm((f) => ({ ...f, password: "" }));
                    setShowPassword(false);
                    setFormOpen(false);
                  })
                  // The error is already a toast; leaving the dialog open keeps
                  // what was typed, which matters most when the API rejects an
                  // employee code that is already taken.
                  .catch(() => undefined)
                  .finally(() => setFormBusy(false));
              }}
            >
              {formBusy && <Loader2 className="size-4 animate-spin" />}
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
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Delete ${selected?.name}?`}
        destructive
        confirmLabel="Delete attendant"
        reason={{
          label: "Reason",
          placeholder: "Dismissed / resigned / created in error…",
          required: true,
        }}
        description={
          "They lose access immediately — no password works, every device is released and they " +
          "leave the roster. Their shifts, sessions, cash collections and photographs are kept and " +
          "stay attributable to them, because the money and the evidence have to remain " +
          "explainable. This cannot be undone from the portal, and their mobile number and " +
          "employee code stay reserved."
        }
        onConfirm={async (reason) => {
          if (!selected) return;
          await apply(
            () => attendantsApi.remove(selected.id, reason ?? "Removed from the portal"),
            (list) => list.filter((a) => a.id !== selected.id),
            { success: "Attendant deleted", description: `${selected.name} · ${selected.employeeCode}` },
          );
        }}
      />

      <ConfirmDialog
        open={unbindOpen}
        onOpenChange={setUnbindOpen}
        title={`Unbind ${selected?.name}'s device?`}
        confirmLabel="Unbind device"
        description={
          // Name the handset being released. An officer doing this from a phone
          // call needs to know they are about to cut off the device they are
          // being told about, and not a second one nobody mentioned.
          (selected?.boundDevice
            ? `Releases the ${
                PLATFORM_LABEL[selected.boundDevice.platform] ?? selected.boundDevice.platform
              } handset${
                selected.boundDevice.lastSeenAt
                  ? ` last seen ${relativeTime(selected.boundDevice.lastSeenAt)}`
                  : ""
              }. `
            : "") +
          "It stops working immediately and they are signed out of it. The next sign-in binds whichever device they use — do this only when a handset is lost or replaced."
        }
        onConfirm={async (reason) => {
          if (!selected) return;
          await apply(
            () => attendantsApi.unbindDevices(selected.id, reason ?? "Handset lost or replaced"),
            (list) =>
              list.map((a) =>
                a.id === selected.id ? { ...a, deviceBound: false, boundDevice: undefined } : a,
              ),
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
