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
import { formatDate, formatMoney } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import type { Pass, PassPlan } from "@/shared/types/domain.types";

export function PassesView() {
  const [passes, setPasses] = React.useState<Pass[]>(PASSES);
  const [plans, setPlans] = React.useState<PassPlan[]>(PASS_PLANS);
  const [selected, setSelected] = React.useState<Pass | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);

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
                    label: "Renew pass",
                    icon: RefreshCw,
                    hidden: pass.status === "CANCELLED",
                    onSelect: () => {
                      setPasses((list) =>
                        list.map((p) => (p.id === pass.id ? { ...p, status: "ACTIVE" } : p)),
                      );
                      toast.success("Pass renewed", {
                        description: `${pass.code} · payment link sent to ${pass.holderPhone}`,
                      });
                    },
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
            emptyTitle="No passes issued"
            emptyDescription="Citizens buy passes from the app. Issued passes appear here."
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
                          setPlans((list) =>
                            list.map((p) => (p.id === plan.id ? { ...p, isActive: !p.isActive } : p)),
                          );
                          toast.success(
                            plan.isActive ? "Plan withdrawn from sale" : "Plan back on sale",
                            { description: plan.name },
                          );
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
              <Input id="plan-name" placeholder="Monthly — Car (Home Zone)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-vehicle">Vehicle type</Label>
              <Select defaultValue="CAR">
                <SelectTrigger id="plan-vehicle">
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
              <Label htmlFor="plan-scope">Zone scope</Label>
              <Select defaultValue="single">
                <SelectTrigger id="plan-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single zone</SelectItem>
                  <SelectItem value="ward">All zones in ward</SelectItem>
                  <SelectItem value="all">All zones (city-wide)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-duration">Duration (days)</Label>
              <Input id="plan-duration" type="number" defaultValue={30} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Price (₹)</Label>
              <Input id="plan-price" type="number" defaultValue={2400} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
              <div className="space-y-0.5">
                <Label htmlFor="plan-auto" className="text-sm">
                  Auto-renew reminders
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send a renewal prompt 5 days before expiry.
                </p>
              </div>
              <Switch id="plan-auto" defaultChecked />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPlanOpen(false);
                toast.success("Plan created", { description: "It is now on sale in the citizen app." });
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
        onConfirm={() => {
          setPasses((list) =>
            list.map((p) => (p.id === selected?.id ? { ...p, status: "CANCELLED" } : p)),
          );
          toast.success("Pass cancelled", { description: selected?.code });
        }}
      />
    </div>
  );
}
