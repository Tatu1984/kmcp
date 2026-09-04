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
import { Can } from "@/frontend/components/shared/can";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, PersonCell } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { VendorFormSheet } from "./vendor-form-sheet";
import { VENDORS, DASHBOARD } from "@/frontend/lib/mock";
import { vendorsApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { toVendor } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { ROUTES } from "@/shared/constants/routes";
import type { Vendor, VendorStatus } from "@/shared/types/domain.types";

/** The form edits the rendered shape; the API takes its own. Only send what changed. */
function toVendorPayload(draft: Partial<Vendor>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== "") payload[key] = value;
  };
  put("orgName", draft.orgName);
  put("contactName", draft.contactName);
  put("contactPhone", draft.contactPhone);
  put("email", draft.email);
  put("gstin", draft.gstin);
  put("pan", draft.pan);
  put("bankAccountNo", draft.bankAccountNo);
  put("bankIfsc", draft.bankIfsc);
  put("commissionPct", draft.commissionPct);
  return payload;
}

export function VendorsView() {
  const router = useRouter();
  const {
    items: vendors,
    isLoading,
    emptyReason,
    apply,
    refresh,
  } = useResource<Vendor>(
    ["vendors", "list"],
    () => listAll((page, pageSize) => vendorsApi.list({ page, pageSize })).then((r) => r.map(toVendor)),
    VENDORS,
  );
  const [selected, setSelected] = React.useState<Vendor | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [commissionOpen, setCommissionOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [commission, setCommission] = React.useState(18);

  const setStatus = React.useCallback(
    (vendor: Vendor, status: VendorStatus, message: string, reason?: string) => {
    // No undo action here. Against the API this has already been written to the
    // audit trail under someone's name; reversing it is a second decision, not
    // a retraction, and it should be made deliberately.
    void apply(
      () => vendorsApi.changeStatus(vendor.id, status, reason),
      (list) => list.map((v) => (v.id === vendor.id ? { ...v, status } : v)),
      { success: message, description: vendor.orgName },
    ).catch(() => undefined);
    },
    [apply],
  );

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
            value={(row.original.pendingSettlement ?? 0)}
            className={(row.original.pendingSettlement ?? 0) > 300000_00 ? "text-amber-600 dark:text-amber-400" : undefined}
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
                  {
                    label: "View vendor",
                    icon: Eye,
                    shortcut: "↵",
                    // GET /vendors/:id — vendors.controller.ts:56.
                    permission: "vendor.read",
                    onSelect: () => router.push(ROUTES.vendor(vendor.id)),
                  },
                  {
                    label: "Edit details",
                    icon: Pencil,
                    // PATCH /vendors/:id — vendors.controller.ts:85.
                    permission: "vendor.write",
                    onSelect: () => {
                      setSelected(vendor);
                      setFormOpen(true);
                    },
                  },
                  {
                    label: "Review KYC",
                    icon: FileCheck2,
                    // Only navigates. Verifying a document on the page it opens
                    // needs vendor.approve, and that action carries it there.
                    permission: "vendor.read",
                    onSelect: () => router.push(`${ROUTES.vendor(vendor.id)}?tab=kyc`),
                  },
                  {
                    label: "Assign zones",
                    icon: LandPlot,
                    // POST /vendors/:id/zones — vendors.controller.ts:142.
                    permission: "vendor.write",
                    onSelect: () => router.push(`${ROUTES.vendor(vendor.id)}?tab=zones`),
                  },
                  {
                    label: "Set commission",
                    icon: Percent,
                    separatorBefore: true,
                    // PATCH /vendors/:id/commission — vendors.controller.ts:158.
                    permission: "vendor.write",
                    onSelect: () => {
                      setSelected(vendor);
                      setCommission(vendor.commissionPct);
                      setCommissionOpen(true);
                    },
                  },
                  {
                    label: "Add attendant",
                    icon: UserPlus,
                    // POST /attendants — attendants.controller.ts:54.
                    permission: "attendant.write",
                    /**
                     * Takes the officer to the attendants screen with this
                     * vendor already chosen, rather than growing a second copy
                     * of the attendant form here.
                     *
                     * That form knows things this screen does not — the zone
                     * roster, the employee-code rules, what an edit sends — and
                     * two of it would drift apart within a release. Navigating
                     * with the vendor in the query string is also the pattern
                     * the rest of this menu already uses for KYC, zones and
                     * settlements.
                     */
                    onSelect: () => router.push(`${ROUTES.attendants}?vendor=${vendor.id}&new=1`),
                  },
                  {
                    label: "View settlements",
                    icon: Coins,
                    // GET /settlements — settlements.controller.ts:32.
                    permission: "settlement.read",
                    onSelect: () => router.push(`${ROUTES.settlements}?vendor=${vendor.id}`),
                  },
                  {
                    label: "Approve vendor",
                    icon: BadgeCheck,
                    hidden: vendor.status !== "PENDING",
                    separatorBefore: true,
                    // POST /vendors/:id/status — vendors.controller.ts:98. Every
                    // status change is vendor.approve, not vendor.write: who may
                    // edit a vendor's bank details and who may let them onto the
                    // kerb are deliberately different people.
                    permission: "vendor.approve",
                    onSelect: () => setStatus(vendor, "APPROVED", "Vendor approved"),
                  },
                  {
                    label: "Reinstate vendor",
                    icon: BadgeCheck,
                    hidden: vendor.status !== "SUSPENDED" && vendor.status !== "BLOCKED",
                    separatorBefore: true,
                    // POST /vendors/:id/status — vendors.controller.ts:98.
                    permission: "vendor.approve",
                    onSelect: () => setStatus(vendor, "APPROVED", "Vendor reinstated"),
                  },
                  {
                    label: "Suspend vendor",
                    icon: Pause,
                    hidden: vendor.status !== "APPROVED",
                    // POST /vendors/:id/status — vendors.controller.ts:98.
                    permission: "vendor.approve",
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
                    // POST /vendors/:id/status — vendors.controller.ts:98.
                    permission: "vendor.approve",
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
    [router, setStatus],
  );

  const pending = vendors.filter((v) => v.status === "PENDING").length;
  const totalPayout = vendors.reduce((s, v) => s + (v.pendingSettlement ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Parking operators contracted to run kerbside zones — KYC, zone assignment, commission and settlement."
        actions={
          // POST /vendors — vendors.controller.ts:70.
          <Can permission="vendor.write">
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
          </Can>
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
        onExport={(rows, columns) => {
          const file = downloadCsv("vendors", rows, columns);
          toast.success("Export ready", { description: `${rows.length} vendors · ${file}` });
        }}
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              // Waits on the PDF module for the statement itself and the
              // messaging module to deliver it. Neither exists yet.
              onClick={() => {
                toast.success(`Statements emailed to ${rows.length} vendors`);
                clear();
              }}
            >
              Email statements
            </Button>
            <Can permission="settlement.read">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                /**
                 * POST /settlements/generate — settlements.controller.ts:56 —
                 * needs a period as well as a vendor, and the settlements
                 * screen already asks for one properly. Rather than invent a
                 * period here, this stays a prompt to run it there; wiring it
                 * blind would raise drafts over a window nobody chose.
                 */
                onClick={() => {
                  toast.info(`Settlement run queued for ${rows.length} vendors`);
                  clear();
                }}
              >
                Run settlement
              </Button>
            </Can>
          </>
        )}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No vendors registered"}
        emptyDescription={
          emptyReason ?? "Register a parking operator to assign them kerbside zones."
        }
      />

      <VendorFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={selected}
        // A KYC document lands against the vendor, not against this form, so
        // the list has to be re-read for the "KYC pending" badge to clear.
        onDocumentUploaded={() => void refresh()}
        onSaved={(draft) =>
          apply(
            () =>
              selected
                ? vendorsApi.update(selected.id, toVendorPayload(draft))
                : vendorsApi.create(toVendorPayload(draft)),
            (list) =>
              selected
                ? list.map((v) => (v.id === selected.id ? ({ ...v, ...draft } as Vendor) : v))
                : [
                    {
                      ...(draft as Vendor),
                      id: `ven_new_${list.length}`,
                      status: "PENDING",
                      zoneCount: 0,
                      attendantCount: 0,
                      kycComplete: false,
                      documents: [],
                      createdAt: new Date().toISOString(),
                    },
                    ...list,
                  ],
            { success: selected ? "Vendor updated" : "Vendor registered", description: draft.orgName },
          )
        }
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
                if (!selected) return;
                void apply(
                  () =>
                    vendorsApi.setCommission(
                      selected.id,
                      commission,
                      "Changed from the vendor screen",
                    ),
                  (list) =>
                    list.map((v) => (v.id === selected.id ? { ...v, commissionPct: commission } : v)),
                  {
                    success: "Commission updated",
                    description: `${selected.orgName} → ${commission}%. Applies from the next settlement cycle.`,
                  },
                )
                  .then(() => setCommissionOpen(false))
                  .catch(() => undefined);
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
            {selected && (selected.pendingSettlement ?? 0) > 0 && (
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
