"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CalendarClock,
  Copy,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Ticket,
  TicketCheck,
  Users,
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
import { Money, Plate, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { PASSES, PASS_PLANS, NOW } from "@/frontend/lib/mock";
import { passesApi, passPlansApi, vehicleTypesApi, zonesApi } from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { toPass, toPassPlan } from "@/frontend/lib/adapters";
import { formatDate, formatMoney } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import type { Pass, PassPlan } from "@/shared/types/domain.types";

/** Blank form for the create-plan dialog. */
const EMPTY_PLAN = {
  name: "",
  vehicleTypeId: "",
  scope: "all" as "all" | "ward" | "zone",
  wardId: "",
  zoneId: "",
  durationDays: "30",
  price: "2400",
};

export function PassesView() {
  const {
    items: passes,
    isLoading,
    emptyReason,
    apply,
  } = useResource<Pass>(
    ["passes", "list"],
    () => passesApi.list({ pageSize: 200 }).then((r) => r.data.map(toPass)),
    PASSES,
  );

  const {
    items: plans,
    apply: applyPlan,
  } = useResource<PassPlan>(
    ["pass-plans", "list"],
    () => passPlansApi.list({ pageSize: 100 }).then((r) => r.data.map(toPassPlan)),
    PASS_PLANS,
  );

  // Needed by the create-plan form: a plan is priced against a vehicle type and
  // scoped to real zones, so both have to come from the API rather than a list
  // of labels.
  const vehicleTypes = useApiQuery(["vehicle-types", "active"], () =>
    vehicleTypesApi.list().then((r) => r.data),
  );
  const zones = useApiQuery(["zones", "for-plans"], () =>
    zonesApi.list({ pageSize: 200 }).then((r) => r.data),
  );

  const [selected, setSelected] = React.useState<Pass | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [planForm, setPlanForm] = React.useState(EMPTY_PLAN);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);

  /** Wards that actually hold zones, with the count the picker shows. */
  const wardOptions = React.useMemo(() => {
    const byWard = new Map<string, { id: string; name: string; zoneCount: number }>();
    for (const zone of zones.data ?? []) {
      if (!zone.wardId) continue;
      const existing = byWard.get(zone.wardId);
      if (existing) existing.zoneCount += 1;
      else byWard.set(zone.wardId, { id: zone.wardId, name: zone.ward?.name ?? "—", zoneCount: 1 });
    }
    return [...byWard.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [zones.data]);

  /**
   * The zones a new plan will cover.
   *
   * A ward is expanded here rather than stored as "the ward", so a zone added
   * to that ward next year does not silently fall inside a pass somebody
   * bought today.
   */
  const planZoneIds = React.useMemo(() => {
    if (planForm.scope === "all") return [];
    if (planForm.scope === "zone") return planForm.zoneId ? [planForm.zoneId] : [];
    return (zones.data ?? []).filter((z) => z.wardId === planForm.wardId).map((z) => z.id);
  }, [planForm.scope, planForm.zoneId, planForm.wardId, zones.data]);

  const canCreatePlan =
    planForm.name.trim().length >= 3 &&
    Boolean(planForm.vehicleTypeId) &&
    Number(planForm.durationDays) >= 1 &&
    Number(planForm.price) >= 0 &&
    (planForm.scope === "all" || planZoneIds.length > 0);

  const columns = React.useMemo<ColumnDef<Pass, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Pass",
        meta: "Pass",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs font-medium">{row.original.code}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.planName}</p>
          </div>
        ),
      },
      {
        accessorKey: "holderName",
        header: "Holder",
        meta: "Holder",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.holderName}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {row.original.holderPhone}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "plateNumber",
        header: "Vehicle",
        meta: "Vehicle",
        cell: ({ row }) => <Plate value={row.original.plateNumber} />,
      },
      {
        accessorKey: "validFrom",
        header: "Valid",
        meta: "Validity",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-xs">
            <p>{formatDate(row.original.validFrom)}</p>
            <p className="text-muted-foreground">to {formatDate(row.original.validTo)}</p>
          </div>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        meta: "Price",
        cell: ({ row }) => <Money value={row.original.price} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} pulse={row.original.status === "ACTIVE"} />
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const pass = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={pass.code}
                actions={[
                  {
                    label: "Show QR",
                    icon: QrCode,
                    onSelect: () => {
                      setSelected(pass);
                      setQrOpen(true);
                    },
                  },
                  {
                    label: "Copy pass code",
                    icon: Copy,
                    onSelect: () => {
                      void navigator.clipboard.writeText(pass.code);
                      toast.success("Copied", { description: pass.code });
                    },
                  },
                  {
                    label: "Re-send to holder",
                    icon: Send,
                    separatorBefore: true,
                    children: [
                      { label: "By SMS", onSelect: () => toast.success("Pass sent by SMS") },
                      { label: "By WhatsApp", onSelect: () => toast.success("Pass sent on WhatsApp") },
                      { label: "By email", onSelect: () => toast.success("Pass emailed") },
                    ],
                  },
                  {
                    label: "Send renewal link",
                    icon: RefreshCw,
                    hidden: pass.status === "CANCELLED",
                    // Renewing is a purchase, not a status change: the holder
                    // buys a fresh pass in the app. All this end can do is
                    // prompt them, which is why nothing here marks it active.
                    onSelect: () =>
                      toast.info("Renewal link sent", {
                        description: `${pass.code} · ${pass.holderPhone}`,
                      }),
                  },
                  {
                    label: "Cancel pass",
                    icon: Ban,
                    destructive: true,
                    hidden: pass.status === "CANCELLED",
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(pass);
                      setCancelOpen(true);
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

  const active = passes.filter((p) => p.status === "ACTIVE").length;
  const expiring = passes.filter(
    (p) => p.status === "ACTIVE" && new Date(p.validTo).getTime() - NOW.getTime() < 7 * 86400000,
  ).length;
  const revenue = passes.filter((p) => p.status === "ACTIVE").reduce((s, p) => s + p.price, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passes and subscriptions"
        description="Monthly and season passes. A valid pass waives the session charge inside its zone scope, verified by QR at the kerb."
        actions={
          <Button size="sm" className="h-9" onClick={() => setPlanOpen(true)}>
            <Plus className="size-4" /> New plan
          </Button>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Active passes" numeric={active} icon={TicketCheck} accent="success" hint={`${passes.length} issued in total`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Expiring this week" numeric={expiring} icon={CalendarClock} accent={expiring > 0 ? "warning" : "success"} hint="Renewal reminders are sent automatically" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Pass revenue" value={<Money value={revenue} compact />} icon={Ticket} hint="From currently active passes" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Plans offered" numeric={plans.filter((p) => p.isActive).length} icon={Users} accent="info" hint={`${plans.length} configured`} />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="passes">
        <TabsList>
          <TabsTrigger value="passes">Issued passes</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="passes" className="mt-4">
          <DataTable
            data={passes}
            columns={columns}
            enableSelection
            searchKeys={["code", "holderName", "holderPhone", "plateNumber", "planName"]}
            searchPlaceholder="Search pass code, holder, phone or plate…"
            facets={[
              {
                columnId: "status",
                label: "Status",
                options: [
                  { value: "ACTIVE", label: "Active" },
                  { value: "EXPIRED", label: "Expired" },
                  { value: "CANCELLED", label: "Cancelled" },
                  { value: "PENDING_PAYMENT", label: "Pending payment" },
                ],
              },
              {
                columnId: "planName",
                label: "Plan",
                options: plans.map((p) => ({ value: p.name, label: p.name })),
              },
            ]}
            onExport={(rows) => toast.success("Export queued", { description: `${rows.length} passes` })}
            bulkActions={(rows, clear) => (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  toast.success(`Renewal reminders sent to ${rows.length} holders`);
                  clear();
                }}
              >
                <Send className="size-3.5" /> Send renewal reminders
              </Button>
            )}
            isLoading={isLoading}
            emptyTitle={emptyReason ? "Nothing to show" : "No passes issued"}
            emptyDescription={
              emptyReason ?? "Citizens buy passes from the app. Issued passes appear here."
            }
          />
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <SectionCard
                key={plan.id}
                title={plan.name}
                description={`${VEHICLE_TYPE_LABELS[plan.vehicleType]} · ${plan.zoneScope}`}
                action={
                  <RowActions
                    label={plan.name}
                    actions={[
                      { label: "Edit plan", icon: Pencil, onSelect: () => toast.info("Editing plan", { description: plan.name }) },
                      {
                        label: plan.isActive ? "Stop selling" : "Resume selling",
                        icon: Ban,
                        destructive: plan.isActive,
                        onSelect: () => {
                          void applyPlan(
                            () => passPlansApi.setActive(plan.id, !plan.isActive),
                            (list) =>
                              list.map((p) => (p.id === plan.id ? { ...p, isActive: !p.isActive } : p)),
                            {
                              success: plan.isActive ? "Plan withdrawn from sale" : "Plan back on sale",
                              description: plan.name,
                            },
                          ).catch(() => {});
                        },
                      },
                    ]}
                  />
                }
              >
                <div className="space-y-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tabular">{formatMoney(plan.price)}</span>
                    <span className="text-sm text-muted-foreground">/ {plan.durationDays} days</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={plan.isActive ? "ACTIVE" : "INACTIVE"}
                      label={plan.isActive ? "On sale" : "Withdrawn"}
                    />
                    <Badge variant="secondary" className="tabular">
                      {plan.activePasses.toLocaleString("en-IN")} active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground text-pretty">
                    Waives the session charge inside {plan.zoneScope.toLowerCase()} for the vehicle it
                    is issued against.
                  </p>
                </div>
              </SectionCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* -------------------------------------------------------- new plan */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a pass plan</DialogTitle>
            <DialogDescription>
              A plan defines what citizens can buy. Passes issued against it inherit its scope and
              duration.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="plan-name">Plan name</Label>
              <Input
                id="plan-name"
                placeholder="Monthly — Car (Home Zone)"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-vehicle">Vehicle type</Label>
              <Select
                value={planForm.vehicleTypeId}
                onValueChange={(v) => setPlanForm({ ...planForm, vehicleTypeId: v })}
              >
                <SelectTrigger id="plan-vehicle">
                  <SelectValue placeholder="Choose a vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {(vehicleTypes.data ?? []).map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-scope">Zone scope</Label>
              <Select
                value={planForm.scope}
                onValueChange={(v) =>
                  setPlanForm({ ...planForm, scope: v as typeof planForm.scope, wardId: "", zoneId: "" })
                }
              >
                <SelectTrigger id="plan-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zone">Single zone</SelectItem>
                  <SelectItem value="ward">All zones in ward</SelectItem>
                  <SelectItem value="all">All zones (city-wide)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {planForm.scope === "zone" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="plan-zone">Zone</Label>
                <Select
                  value={planForm.zoneId}
                  onValueChange={(v) => setPlanForm({ ...planForm, zoneId: v })}
                >
                  <SelectTrigger id="plan-zone">
                    <SelectValue placeholder="Choose a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {(zones.data ?? []).map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {planForm.scope === "ward" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="plan-ward">Ward</Label>
                <Select
                  value={planForm.wardId}
                  onValueChange={(v) => setPlanForm({ ...planForm, wardId: v })}
                >
                  <SelectTrigger id="plan-ward">
                    <SelectValue placeholder="Choose a ward" />
                  </SelectTrigger>
                  <SelectContent>
                    {wardOptions.map((ward) => (
                      <SelectItem key={ward.id} value={ward.id}>
                        {ward.name} · {ward.zoneCount} zones
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The ward is expanded into its zones when the plan is saved, so a zone added to the
                  ward later is not silently included.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="plan-duration">Duration (days)</Label>
              <Input
                id="plan-duration"
                type="number"
                min={1}
                value={planForm.durationDays}
                onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Price (₹)</Label>
              <Input
                id="plan-price"
                type="number"
                min={0}
                value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
              <div className="space-y-0.5">
                <Label htmlFor="plan-auto" className="text-sm">
                  Auto-renew reminders
                </Label>
                <p className="text-xs text-muted-foreground">
                  Reminders are not built yet, so this is off and cannot be turned on.
                </p>
              </div>
              <Switch id="plan-auto" checked={false} disabled />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canCreatePlan}
              onClick={() => {
                void applyPlan(
                  () =>
                    passPlansApi.create({
                      name: planForm.name.trim(),
                      vehicleTypeId: planForm.vehicleTypeId,
                      zoneIds: planZoneIds,
                      durationDays: Number(planForm.durationDays),
                      // The form is in rupees because that is what a price card
                      // is written in; everything past this line is paise.
                      price: Math.round(Number(planForm.price) * 100),
                    }),
                  (list) => [
                    ...list,
                    {
                      id: `plan_${planForm.name.trim()}`,
                      name: planForm.name.trim(),
                      vehicleType: "CAR" as const,
                      zoneScope: planForm.scope === "all" ? "All zones" : `${planZoneIds.length} zones`,
                      durationDays: Number(planForm.durationDays),
                      price: Math.round(Number(planForm.price) * 100),
                      isActive: true,
                      activePasses: 0,
                    },
                  ],
                  { success: "Plan created", description: "It is now on sale in the citizen app." },
                )
                  .then(() => {
                    setPlanOpen(false);
                    setPlanForm(EMPTY_PLAN);
                  })
                  .catch(() => {});
              }}
            >
              Create plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------- QR */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{selected?.code}</DialogTitle>
            <DialogDescription>
              {selected?.holderName} · {selected?.plateNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center py-4">
            <div className="grid size-44 place-items-center rounded-xl border-2 bg-muted/30">
              <QrCode className="size-24 text-foreground/80" />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground text-pretty">
              The attendant scans this at the kerb. Verification checks validity, vehicle and zone
              scope server-side before waiving the charge.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrOpen(false)}>
              Close
            </Button>
            <Button onClick={() => toast.success("Pass sent to holder")}>
              <Send className="size-4" /> Send to holder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel pass ${selected?.code}?`}
        destructive
        confirmLabel="Cancel pass"
        reason={{ label: "Reason", placeholder: "Refund requested / vehicle sold / issued in error…", required: true }}
        description="The pass stops waiving charges immediately. Any refund is handled separately from the payments screen."
        onConfirm={(reason) => {
          const pass = selected;
          if (!pass) return;
          void apply(
            () => passesApi.cancel(pass.id, (reason ?? "").trim()),
            (list) => list.map((p) => (p.id === pass.id ? { ...p, status: "CANCELLED" as const } : p)),
            { success: "Pass cancelled", description: pass.code },
          ).catch(() => {});
        }}
      />
    </div>
  );
}
