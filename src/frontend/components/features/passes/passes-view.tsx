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
import { Can } from "@/frontend/components/shared/can";
import { Money, Plate, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { PASSES, PASS_PLANS, NOW } from "@/frontend/lib/mock";
import { isLiveApi } from "@/config/env";
import {
  passesApi,
  passPlansApi,
  vehicleTypesApi,
  zonesApi,
  listAll,
  messagingApi,
  channelLabel,
  type MessageChannel,
} from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { useMessaging } from "@/frontend/hooks/use-messaging";
import { toPass, toPassPlan } from "@/frontend/lib/adapters";
import { formatDate, formatMoney } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import type { Pass, PassPlan } from "@/shared/types/domain.types";

/** One list, shared by the row menu and the QR dialog. */
const PASS_CHANNELS: { channel: MessageChannel; label: string }[] = [
  { channel: "SMS", label: "By SMS" },
  { channel: "WHATSAPP", label: "By WhatsApp" },
  { channel: "EMAIL", label: "By email" },
];

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
    isRefreshing,
    emptyReason,
    apply,
    refresh,
  } = useResource<Pass>(
    ["passes", "list"],
    () => listAll((page, pageSize) => passesApi.list({ page, pageSize })).then((r) => r.map(toPass)),
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
    listAll((page, pageSize) => zonesApi.list({ page, pageSize })),
  );

  const { send, isSending } = useMessaging();

  /**
   * Sends a pass to its holder, or prompts them to renew it.
   *
   * One helper for both because they are the same act with a different message:
   * the API renders them from one catalogue, so what a holder reads about their
   * pass says the same thing whichever button an officer pressed.
   */
  const sendPass = React.useCallback(
    (passIds: string[], kind: "issued" | "renewal", channels: MessageChannel[], subject: string) =>
      void send(() => messagingApi.sendPasses({ passIds, kind, channels }), {
        success:
          kind === "renewal"
            ? passIds.length === 1
              ? "Renewal link sent"
              : `Renewal reminders sent to ${passIds.length} holders`
            : passIds.length === 1
              ? "Pass sent to holder"
              : `Pass sent to ${passIds.length} holders`,
        description: `${subject} · by ${channels.map(channelLabel).join(" and ")}`,
      }),
    [send],
  );

  const [selected, setSelected] = React.useState<Pass | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);
  /** Null while creating; the plan being changed while editing. */
  const [editingPlan, setEditingPlan] = React.useState<PassPlan | null>(null);
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

  /**
   * Editing asks for less than creating does.
   *
   * `PATCH /pass-plans/:id` takes a partial, so an edit sends only the three
   * fields this dialog offers when a plan is open for change — what it costs,
   * how long it runs and what it is called. What a plan *covers* is not edited
   * here: a plan for a different vehicle or a different set of zones is a
   * different plan, and re-scoping one in place would silently move every
   * renewal onto terms nobody chose.
   */
  const canSavePlan =
    planForm.name.trim().length >= 3 &&
    Number(planForm.durationDays) >= 1 &&
    Number(planForm.price) >= 0 &&
    (editingPlan !== null ||
      (Boolean(planForm.vehicleTypeId) && (planForm.scope === "all" || planZoneIds.length > 0)));

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
                    /**
                     * POST /messaging/passes with `kind: issued` —
                     * messaging.controller.ts, on pass.write, the grant every
                     * other write on this screen carries. It sends the pass
                     * code rather than the QR image: an SMS cannot carry one
                     * and an emailed image is routinely stripped, and the code
                     * is the credential the app renders as a QR at the kerb.
                     */
                    label: "Re-send to holder",
                    icon: Send,
                    permission: "pass.write",
                    separatorBefore: true,
                    children: PASS_CHANNELS.map(({ channel, label }) => ({
                      label,
                      permission: "pass.write" as const,
                      onSelect: () => sendPass([pass.id], "issued", [channel], pass.code),
                    })),
                  },
                  {
                    label: "Send renewal link",
                    icon: RefreshCw,
                    // POST /messaging/passes with `kind: renewal`. Renewing is
                    // a purchase, not a status change: the holder buys a fresh
                    // pass in the app, so this prompts them and links there —
                    // it does not renew anything.
                    permission: "pass.write",
                    hidden: pass.status === "CANCELLED",
                    onSelect: () => sendPass([pass.id], "renewal", ["SMS", "EMAIL"], pass.code),
                  },
                  {
                    label: "Cancel pass",
                    icon: Ban,
                    permission: "pass.write",
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
    [sendPass],
  );

  const active = passes.filter((p) => p.status === "ACTIVE").length;

  /**
   * "Expiring within seven days" is measured from the actual clock, not from
   * the demo dataset's frozen `NOW`.
   *
   * That constant is fixed at the instant the bundled city was generated, so on
   * a live deployment this count was being measured from a date that recedes
   * further into the past every day the build is not rebuilt — a month stale by
   * the time it was noticed, and silently wrong rather than visibly broken.
   * Demo mode keeps the frozen clock, because the whole dataset is arranged
   * around it and a real `Date.now()` there would report every pass as expired.
   *
   * Read once when the screen mounts, through a state initialiser, rather than
   * on each render: `Date.now()` is impure and the React Compiler rejects it
   * during render — correctly, since a value that changes every render is not
   * something a render may depend on. Once per visit is the right granularity
   * for a seven-day window anyway.
   */
  const [asOf] = React.useState(() => (isLiveApi ? Date.now() : NOW.getTime()));
  const expiring = passes.filter(
    (p) => p.status === "ACTIVE" && new Date(p.validTo).getTime() - asOf < 7 * 86400000,
  ).length;
  const revenue = passes.filter((p) => p.status === "ACTIVE").reduce((s, p) => s + p.price, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passes and subscriptions"
        description="Monthly and season passes. A valid pass waives the session charge inside its zone scope, verified by QR at the kerb."
        actions={
          <Can permission="pass.write">
            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                setEditingPlan(null);
                setPlanForm(EMPTY_PLAN);
                setPlanOpen(true);
              }}
            >
              <Plus className="size-4" /> New plan
            </Button>
          </Can>
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
            onExport={(rows) => toast.success("Export queued", { description: `${rows.length} passes` })}
            bulkActions={(rows, clear) => (
              /**
               * Reminders go to passes that can still be renewed. A cancelled
               * pass is not lapsing — it was ended deliberately — and prompting
               * its former holder to renew would be the portal nagging someone
               * about a decision they already made.
               */
              <Can permission="pass.write">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => {
                    const renewable = rows.filter((p) => p.status !== "CANCELLED");
                    if (renewable.length === 0) {
                      toast.error("Nothing to send", {
                        description: "Every selected pass has been cancelled.",
                      });
                      return;
                    }
                    sendPass(
                      renewable.map((p) => p.id),
                      "renewal",
                      ["SMS", "EMAIL"],
                      `${renewable.length} passes`,
                    );
                    clear();
                  }}
                >
                  <Send className="size-3.5" /> Send renewal reminders
                </Button>
              </Can>
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
                      {
                        label: "Edit plan",
                        icon: Pencil,
                        permission: "pass.write",
                        onSelect: () => {
                          setEditingPlan(plan);
                          setPlanForm({
                            ...EMPTY_PLAN,
                            name: plan.name,
                            durationDays: String(plan.durationDays),
                            // Paise on the wire, rupees in the form.
                            price: String(plan.price / 100),
                          });
                          setPlanOpen(true);
                        },
                      },
                      {
                        label: plan.isActive ? "Stop selling" : "Resume selling",
                        icon: Ban,
                        permission: "pass.write",
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

      {/* -------------------------------------------------- new / edit plan */}
      <Dialog
        open={planOpen}
        onOpenChange={(open) => {
          setPlanOpen(open);
          if (!open) {
            setEditingPlan(null);
            setPlanForm(EMPTY_PLAN);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? `Edit ${editingPlan.name}` : "Create a pass plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Applies to what is sold next. Passes already issued keep the price and duration they were bought on."
                : "A plan defines what citizens can buy. Passes issued against it inherit its scope and duration."}
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

            {editingPlan ? (
              <div className="rounded-lg border bg-muted/25 p-3 text-xs text-muted-foreground text-pretty sm:col-span-2">
                Covers {VEHICLE_TYPE_LABELS[editingPlan.vehicleType].toLowerCase()} ·{" "}
                {editingPlan.zoneScope.toLowerCase()}. What a plan covers is not changed here — a
                plan for a different vehicle or a different set of zones is a different plan, and
                re-scoping this one would move every renewal onto terms nobody chose.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-vehicle">Vehicle type</Label>
                  <Select
                    value={planForm.vehicleTypeId}
                    onValueChange={(v) => setPlanForm({ ...planForm, vehicleTypeId: v })}
                  >
                    <SelectTrigger id="plan-vehicle" className="w-full">
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
                      setPlanForm({
                        ...planForm,
                        scope: v as typeof planForm.scope,
                        wardId: "",
                        zoneId: "",
                      })
                    }
                  >
                    <SelectTrigger id="plan-scope" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zone">Single zone</SelectItem>
                      <SelectItem value="ward">All zones in ward</SelectItem>
                      <SelectItem value="all">All zones (city-wide)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {!editingPlan && planForm.scope === "zone" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="plan-zone">Zone</Label>
                <Select
                  value={planForm.zoneId}
                  onValueChange={(v) => setPlanForm({ ...planForm, zoneId: v })}
                >
                  <SelectTrigger id="plan-zone" className="w-full">
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

            {!editingPlan && planForm.scope === "ward" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="plan-ward">Ward</Label>
                <Select
                  value={planForm.wardId}
                  onValueChange={(v) => setPlanForm({ ...planForm, wardId: v })}
                >
                  <SelectTrigger id="plan-ward" className="w-full">
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
                {/* Renewal reminders can be sent — select the passes and use
                    the bulk action. What does not exist is a scheduler that
                    sweeps for lapsing passes and sends them unprompted, so
                    this stays off rather than promising an automation nothing
                    runs. */}
                <p className="text-xs text-muted-foreground">
                  Nothing sends these on a schedule yet. Send reminders from the passes list.
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
              disabled={!canSavePlan}
              onClick={() => {
                const name = planForm.name.trim();
                const durationDays = Number(planForm.durationDays);
                // The form is in rupees because that is what a price card is
                // written in; everything past this line is paise.
                const price = Math.round(Number(planForm.price) * 100);
                const target = editingPlan;

                void applyPlan(
                  () =>
                    target
                      ? passPlansApi.update(target.id, { name, durationDays, price })
                      : passPlansApi.create({
                          name,
                          vehicleTypeId: planForm.vehicleTypeId,
                          zoneIds: planZoneIds,
                          durationDays,
                          price,
                        }),
                  (list) =>
                    target
                      ? list.map((p) =>
                          p.id === target.id ? { ...p, name, durationDays, price } : p,
                        )
                      : [
                          ...list,
                          {
                            id: `plan_${name}`,
                            name,
                            vehicleType: "CAR" as const,
                            zoneScope:
                              planForm.scope === "all" ? "All zones" : `${planZoneIds.length} zones`,
                            durationDays,
                            price,
                            isActive: true,
                            activePasses: 0,
                          },
                        ],
                  target
                    ? { success: "Plan updated", description: "It applies to the next pass sold." }
                    : { success: "Plan created", description: "It is now on sale in the citizen app." },
                )
                  .then(() => {
                    setPlanOpen(false);
                    setEditingPlan(null);
                    setPlanForm(EMPTY_PLAN);
                  })
                  .catch(() => {});
              }}
            >
              {editingPlan ? "Save plan" : "Create plan"}
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
            {/* The same send as the ⋯ menu's "Re-send to holder", on the two
                channels a citizen is most likely to still have when they reach
                the kerb without their phone unlocked. */}
            <Can permission="pass.write">
              <Button
                disabled={isSending || !selected}
                onClick={() => {
                  if (!selected) return;
                  sendPass([selected.id], "issued", ["SMS", "EMAIL"], selected.code);
                }}
              >
                <Send className="size-4" /> Send to holder
              </Button>
            </Can>
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
