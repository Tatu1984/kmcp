"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeCheck,
  Ban,
  Building2,
  Coins,
  Eye,
  FileCheck2,
  LandPlot,
  Pause,
  Pencil,
  Percent,
  Plus,
  Star,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Label } from "@/frontend/components/ui/label";
import { Slider } from "@/frontend/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, PersonCell } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { VendorFormSheet } from "./vendor-form-sheet";
import { VENDORS, DASHBOARD } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";
import type { Vendor, VendorStatus } from "@/shared/types/domain.types";

export function VendorsView() {
  const router = useRouter();
  const [vendors, setVendors] = React.useState<Vendor[]>(VENDORS);
  const [selected, setSelected] = React.useState<Vendor | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [commissionOpen, setCommissionOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [commission, setCommission] = React.useState(18);

  const setStatus = (vendor: Vendor, status: VendorStatus, message: string) => {
    setVendors((list) => list.map((v) => (v.id === vendor.id ? { ...v, status } : v)));
    toast.success(message, {
      description: vendor.orgName,
      action: {
        label: "Undo",
        onClick: () =>
          setVendors((list) => list.map((v) => (v.id === vendor.id ? { ...v, status: vendor.status } : v))),
      },
    });
  };

  const columns = React.useMemo<ColumnDef<Vendor, unknown>[]>(
    () => [
      {
        accessorKey: "orgName",
        header: "Vendor",
        meta: "Vendor",
        cell: ({ row }) => (
          <PersonCell name={row.original.orgName} secondary={`${row.original.contactName} · ${row.original.contactPhone}`} />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge status={row.original.status} pulse={row.original.status === "APPROVED"} />
            {!row.original.kycComplete && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] text-amber-600 dark:text-amber-400">
                KYC pending
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "zoneCount",
        header: "Zones",
        meta: "Zones",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-sm tabular">{row.original.zoneCount} zones</p>
            <p className="text-[11px] text-muted-foreground tabular">
              {row.original.attendantCount} attendants
            </p>
          </div>
        ),
      },
      {
        accessorKey: "commissionPct",
        header: "Commission",
        meta: "Commission",
        cell: ({ row }) => (
          <Badge variant="secondary" className="tabular">
            {row.original.commissionPct}%
          </Badge>
        ),
      },
      {
        accessorKey: "revenueMonth",
        header: "Revenue (month)",
        meta: "Revenue this month",
        cell: ({ row }) => <Money value={row.original.revenueMonth} />,
      },
      {
        accessorKey: "pendingSettlement",
        header: "Pending payout",
        meta: "Pending payout",
        cell: ({ row }) => (
          <Money
            value={row.original.pendingSettlement}
            className={row.original.pendingSettlement > 300000_00 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
        ),
      },
      {
        accessorKey: "rating",
        header: "Rating",
        meta: "Rating",
        cell: ({ row }) =>
          row.original.rating ? (
            <span className="inline-flex items-center gap-1 text-sm tabular">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              {row.original.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={vendor.orgName}
                actions={[
                  { label: "View vendor", icon: Eye, shortcut: "↵", onSelect: () => router.push(ROUTES.vendor(vendor.id)) },
                  {
                    label: "Edit details",
                    icon: Pencil,
                    onSelect: () => {
                      setSelected(vendor);
                      setFormOpen(true);
                    },
                  },
                  {
                    label: "Review KYC",
                    icon: FileCheck2,
                    onSelect: () => router.push(`${ROUTES.vendor(vendor.id)}?tab=kyc`),
                  },
                  {
                    label: "Assign zones",
                    icon: LandPlot,
                    onSelect: () => router.push(`${ROUTES.vendor(vendor.id)}?tab=zones`),
                  },
                  {
                    label: "Set commission",
                    icon: Percent,
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(vendor);
                      setCommission(vendor.commissionPct);
                      setCommissionOpen(true);
                    },
                  },
                  {
                    label: "Add attendant",
                    icon: UserPlus,
                    onSelect: () => toast.info("Add attendant", { description: vendor.orgName }),
                  },
                  {
                    label: "View settlements",
                    icon: Coins,
                    onSelect: () => router.push(`${ROUTES.settlements}?vendor=${vendor.id}`),
                  },
                  {
                    label: "Approve vendor",
                    icon: BadgeCheck,
                    hidden: vendor.status !== "PENDING",
                    separatorBefore: true,
                    onSelect: () => setStatus(vendor, "APPROVED", "Vendor approved"),
                  },
                  {
                    label: "Reinstate vendor",
                    icon: BadgeCheck,
                    hidden: vendor.status !== "SUSPENDED" && vendor.status !== "BLOCKED",
                    separatorBefore: true,
                    onSelect: () => setStatus(vendor, "APPROVED", "Vendor reinstated"),
                  },
                  {
                    label: "Suspend vendor",
                    icon: Pause,
                    hidden: vendor.status !== "APPROVED",
                    onSelect: () => {
                      setSelected(vendor);
                      setSuspendOpen(true);
                    },
                  },
                  {
                    label: "Block vendor",
                    icon: Ban,
                    destructive: true,
                    hidden: vendor.status === "BLOCKED",
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(vendor);
                      setBlockOpen(true);
                    },
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

  const pending = vendors.filter((v) => v.status === "PENDING").length;
  const totalPayout = vendors.reduce((s, v) => s + v.pendingSettlement, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Parking operators contracted to run kerbside zones — KYC, zone assignment, commission and settlement."
        actions={
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Register vendor
          </Button>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Active vendors" numeric={DASHBOARD.activeVendors} icon={Building2} hint={`${vendors.length} on the register`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Awaiting approval"
            numeric={pending}
            icon={FileCheck2}
            accent={pending > 0 ? "warning" : "success"}
            hint="Applications with KYC submitted"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Pending payout"
            value={`₹${(totalPayout / 100 / 100000).toFixed(2)} L`}
            icon={Coins}
            accent="warning"
            hint="Across all vendors"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Attendants deployed"
            numeric={vendors.reduce((s, v) => s + v.attendantCount, 0)}
            icon={UserPlus}
            accent="info"
            hint="Field staff across all vendors"
          />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={vendors}
        columns={columns}
        enableSelection
        searchKeys={["orgName", "contactName", "contactPhone", "email"]}
        searchPlaceholder="Search vendor, contact or phone…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "APPROVED", label: "Approved" },
              { value: "PENDING", label: "Pending" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "BLOCKED", label: "Blocked" },
            ],
          },
        ]}
        onRowClick={(vendor) => router.push(ROUTES.vendor(vendor.id))}
        onExport={(rows) => toast.success("Export queued", { description: `${rows.length} vendors` })}
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success(`Statements emailed to ${rows.length} vendors`);
                clear();
              }}
            >
              Email statements
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.info(`Settlement run queued for ${rows.length} vendors`);
                clear();
              }}
            >
              Run settlement
            </Button>
          </>
        )}
        emptyTitle="No vendors registered"
        emptyDescription="Register a parking operator to assign them kerbside zones."
      />

      <VendorFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={selected}
        onSaved={(draft) => {
          if (selected) {
            setVendors((list) => list.map((v) => (v.id === selected.id ? ({ ...v, ...draft } as Vendor) : v)));
          } else {
            setVendors((list) => [
              {
                ...(draft as Vendor),
                id: `ven_new_${list.length}`,
                status: "PENDING",
                zoneCount: 0,
                attendantCount: 0,
                revenueMonth: 0,
                pendingSettlement: 0,
                kycComplete: false,
                documents: [],
                createdAt: new Date().toISOString(),
              },
              ...list,
            ]);
          }
        }}
      />

      {/* ------------------------------------------------------- commission */}
      <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set commission</DialogTitle>
            <DialogDescription>
              {selected?.orgName}. The commission is deducted from gross collections at settlement —
              the remainder is the vendor share, and the commission itself is the municipal share.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Label>Commission rate</Label>
                <span className="text-2xl font-semibold tabular">{commission}%</span>
              </div>
              <Slider
                value={[commission]}
                onValueChange={([v]) => setCommission(v)}
                min={5}
                max={40}
                step={0.5}
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular">
                <span>5%</span>
                <span>40%</span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/25 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                On last month&apos;s collection of{" "}
                <Money value={selected?.revenueMonth} compact className="font-semibold text-foreground" />
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Municipal share</dt>
                  <dd>
                    <Money value={Math.round(((selected?.revenueMonth ?? 0) * commission) / 100)} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Vendor share</dt>
                  <dd>
                    <Money value={Math.round(((selected?.revenueMonth ?? 0) * (100 - commission)) / 100)} />
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCommissionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setVendors((list) =>
                  list.map((v) => (v.id === selected?.id ? { ...v, commissionPct: commission } : v)),
                );
                setCommissionOpen(false);
                toast.success("Commission updated", {
                  description: `${selected?.orgName} → ${commission}%. Applies from the next settlement cycle.`,
                });
              }}
            >
              Save commission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend ${selected?.orgName}?`}
        confirmLabel="Suspend vendor"
        reason={{ label: "Reason for suspension", placeholder: "Repeated cash variance / KYC lapsed / contract dispute…", required: true }}
        description="Their attendants can no longer start new sessions. Running sessions finish normally and settlements already approved still pay out."
        onConfirm={() => {
          if (selected) setStatus(selected, "SUSPENDED", "Vendor suspended");
        }}
      />

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Block ${selected?.orgName}?`}
        destructive
        confirmLabel="Block vendor"
        typeToConfirm={selected?.orgName.split(" ")[0]}
        reason={{ label: "Reason for blocking", placeholder: "Contract terminated / fraud confirmed…", required: true }}
        description={
          <div className="space-y-2">
            <p>
              Blocking ends the contract relationship. All attendant logins are revoked immediately,
              every assigned zone is released, and no new sessions can be started.
            </p>
            {selected && selected.pendingSettlement > 0 && (
              <p className="font-medium text-destructive">
                This vendor has an outstanding payout. Settle or write it off before blocking.
              </p>
            )}
          </div>
        }
        onConfirm={() => {
          if (selected) setStatus(selected, "BLOCKED", "Vendor blocked");
        }}
      />
    </div>
  );
}
