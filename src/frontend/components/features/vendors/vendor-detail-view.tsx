"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Ban,
  Building2,
  Coins,
  Download,
  FileCheck2,
  LandPlot,
  Mail,
  Pause,
  Pencil,
  Percent,
  Phone,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { Input } from "@/frontend/components/ui/input";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { Progress } from "@/frontend/components/ui/progress";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { Can } from "@/frontend/components/shared/can";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Field, Money, OccupancyBar, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { RevenueChart } from "@/frontend/components/features/dashboard/charts";
import { VendorFormSheet } from "./vendor-form-sheet";
import { VENDORS, ZONES, ATTENDANTS, SETTLEMENTS, SHIFTS } from "@/frontend/lib/mock";
import { KycUpload } from "./kyc-upload";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import {
  vendorsApi,
  mediaApi,
  zonesApi,
  attendantsApi,
  settlementsApi,
  shiftsApi,
  documentsApi,
  listAll,
} from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import {
  toVendor,
  toZone,
  toAttendant,
  toSettlement,
  toShift,
} from "@/frontend/lib/adapters";
import { isLiveApi } from "@/config/env";
import { ROUTES } from "@/shared/constants/routes";
import { formatDate, formatDateTime, relativeTime } from "@/shared/utils/common.util";
import type { Vendor } from "@/shared/types/domain.types";

export function VendorDetailView({ vendorId }: { vendorId: string }) {
  const params = useSearchParams();
  const demoVendor = VENDORS.find((v) => v.id === vendorId);

  // A single record, carried through the same list machinery so the write path
  // and the demo fallback behave exactly as they do everywhere else.
  const {
    items,
    isLoading,
    emptyReason,
    apply,
    refresh,
  } = useResource<Vendor>(
    ["vendors", vendorId],
    () => vendorsApi.get(vendorId).then((r) => [toVendor(r.data)]),
    demoVendor ? [demoVendor] : [],
  );
  const vendor = items[0];
  const documents = useDocument();
  const [editOpen, setEditOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [zonePicks, setZonePicks] = React.useState<string[]>([]);
  const [zoneSearch, setZoneSearch] = React.useState("");

  /**
   * Each tab asks the API for its own slice of the vendor.
   *
   * These four lists used to be the bundled demo dataset filtered by the live
   * vendor's id. That quietly worked on a laptop and quietly failed in the
   * field: a real vendor's id is a cuid and the demo ids read `ven_metro`, so
   * nothing ever matched and every tab reported an empty vendor — no zones, no
   * attendants, no settlements — for one that plainly had them.
   *
   * They are keyed off the route parameter rather than `vendor.id` so that they
   * sit above the not-found return below, where hooks still run on every render.
   */
  const zonesQuery = useApiQuery(["zones", "vendor", vendorId], () =>
    listAll((page, pageSize) => zonesApi.list({ vendorId, page, pageSize })).then((r) =>
      r.map(toZone),
    ),
  );
  const attendantsQuery = useApiQuery(["attendants", "vendor", vendorId], () =>
    listAll((page, pageSize) => attendantsApi.list({ vendorId, page, pageSize })).then((r) =>
      r.map(toAttendant),
    ),
  );
  const settlementsQuery = useApiQuery(["settlements", "vendor", vendorId], () =>
    listAll((page, pageSize) => settlementsApi.list({ vendorId, page, pageSize })).then((r) =>
      r.map(toSettlement),
    ),
  );
  /**
   * Shifts come back newest first and this card shows a dozen of them, so the
   * walk stops well short of every shift the vendor has ever run.
   */
  const shiftsQuery = useApiQuery(["shifts", "vendor", vendorId], () =>
    listAll((page, pageSize) => shiftsApi.list({ vendorId, page, pageSize }), 100).then((r) =>
      r.map(toShift),
    ),
  );

  /**
   * Every zone on the network, for the assignment dialog.
   *
   * Fetched only while that dialog is open — the roster is long, this page is
   * opened far more often than kerb is reassigned, and the tabs above already
   * make four requests of their own.
   */
  const assignableQuery = useApiQuery(
    ["zones", "assignable"],
    () =>
      listAll((page, pageSize) => zonesApi.list({ page, pageSize })).then((r) =>
        r.map((z) => ({
          id: z.id,
          code: z.code,
          name: z.name,
          vendorId: z.vendor?.id ?? null,
          vendorName: z.vendor?.orgName ?? null,
        })),
      ),
    { enabled: assignOpen },
  );

  // items[0] is genuinely absent while the first fetch runs, and stays absent
  // if the id does not exist — neither may be allowed to reach the render below.
  if (!vendor) {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : (
          <EmptyState
            icon={Building2}
            title="Vendor not found"
            description={emptyReason ?? "No vendor exists with this reference."}
          />
        )}
      </div>
    );
  }

  // Live rows arrive already scoped by the API. Demo mode keeps filtering the
  // bundled dataset, where a shift records the vendor by name and not by id.
  const zones = isLiveApi ? (zonesQuery.data ?? []) : ZONES.filter((z) => z.vendorId === vendor.id);
  const attendants = isLiveApi
    ? (attendantsQuery.data ?? [])
    : ATTENDANTS.filter((a) => a.vendorId === vendor.id);
  const settlements = isLiveApi
    ? (settlementsQuery.data ?? [])
    : SETTLEMENTS.filter((s) => s.vendorId === vendor.id);
  const shifts = isLiveApi
    ? (shiftsQuery.data ?? [])
    : SHIFTS.filter((s) => s.vendorName === vendor.orgName);

  // The most recent period, which is what "the statement" means to somebody
  // looking at a vendor. Ordered here rather than trusted from either source:
  // the API sorts by period and the demo dataset by nothing in particular.
  const latestSettlement =
    [...settlements].sort(
      (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
    )[0] ?? null;

  /**
   * Zones this vendor could be given, narrowed by whatever has been typed.
   *
   * Kerb already operated by somebody else is listed rather than hidden, and
   * says whose it is: reassigning a zone between operators is a real thing the
   * authority does at contract renewal, and an officer looking for a zone that
   * silently is not there will conclude the roster is broken.
   */
  const assignable = (
    isLiveApi
      ? (assignableQuery.data ?? [])
      : ZONES.map((z) => ({
          id: z.id,
          code: z.code,
          name: z.name,
          vendorId: z.vendorId ?? null,
          vendorName: z.vendorName ?? null,
        }))
  ).filter((z) => {
    if (z.vendorId === vendor.id) return false;
    const q = zoneSearch.trim().toLowerCase();
    return !q || z.code.toLowerCase().includes(q) || z.name.toLowerCase().includes(q);
  });

  /**
   * A tab is only genuinely empty once its own request has come back. Saying
   * "no zones assigned" over a fetch still in flight states something untrue
   * about the vendor, so each list waits behind these rows instead.
   */
  const loadingRows = (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );

  const kycProgress = Math.round(
    (vendor.documents.filter((d) => d.verified).length / Math.max(1, 4)) * 100,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: ROUTES.vendors, label: "All vendors" }}
        title={vendor.orgName}
        description={`${vendor.contactName} · ${vendor.contactPhone} · ${vendor.email}`}
        meta={
          <>
            <StatusBadge status={vendor.status} pulse={vendor.status === "APPROVED"} />
            {vendor.rating && (
              <Badge variant="outline" className="gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {vendor.rating.toFixed(1)}
              </Badge>
            )}
            <Badge variant="secondary" className="tabular">
              {vendor.commissionPct}% commission
            </Badge>
          </>
        }
        actions={
          <>
            {/* PATCH /vendors/:id — vendors.controller.ts:85. */}
            <Can permission="vendor.write">
              <Button variant="outline" size="sm" className="h-9" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
            </Can>
            {vendor.status === "PENDING" ? (
              // POST /vendors/:id/status — vendors.controller.ts:98.
              <Can permission="vendor.approve">
              <Button
                size="sm"
                className="h-9"
                onClick={() =>
                  void apply(
                    () => vendorsApi.changeStatus(vendor.id, "APPROVED"),
                    (list) =>
                      list.map((v) => ({
                        ...v,
                        status: "APPROVED" as const,
                        approvedAt: new Date().toISOString(),
                      })),
                    {
                      success: "Vendor approved",
                      description: `${vendor.orgName} can now be assigned kerb.`,
                    },
                  ).catch(() => undefined)
                }
              >
                <BadgeCheck className="size-4" /> Approve
              </Button>
              </Can>
            ) : (
              // GET /settlements — settlements.controller.ts:32.
              <Can permission="settlement.read">
                <Button size="sm" className="h-9" asChild>
                  <Link href={`${ROUTES.settlements}?vendor=${vendor.id}`}>
                    <Coins className="size-4" /> Settlements
                  </Link>
                </Button>
              </Can>
            )}
            <RowActions
              label="More"
              actions={[
                // Neither of these calls the API — they hand the number and the
                // address to whatever the operator's machine uses for them.
                { label: "Call contact", icon: Phone, onSelect: () => toast.info("Calling", { description: vendor.contactPhone }) },
                { label: "Email vendor", icon: Mail, onSelect: () => toast.info("Composing email", { description: vendor.email }) },
                {
                  // There is no such thing as a vendor-wide statement: a
                  // statement covers one settlement period, and that is the
                  // record the vendor is actually paid against. So this offers
                  // the newest one by name rather than inventing a document
                  // that would reconcile to nothing.
                  label: latestSettlement
                    ? `Statement — ${latestSettlement.reference}`
                    : "Download statement",
                  icon: Download,
                  hidden: !latestSettlement,
                  // GET /documents/settlements/:id — documents.controller.ts.
                  permission: "settlement.read",
                  onSelect: () => {
                    if (!latestSettlement) return;
                    void documents.run(
                      latestSettlement.id,
                      () => documentsApi.settlement(latestSettlement.id),
                      {
                        demo: () => toast.success("Statement downloaded"),
                        success: "Statement downloaded",
                        description: `${latestSettlement.reference}.pdf`,
                      },
                    );
                  },
                },
                {
                  label: "Suspend vendor",
                  icon: Pause,
                  destructive: true,
                  separatorBefore: true,
                  hidden: vendor.status !== "APPROVED",
                  // POST /vendors/:id/status — vendors.controller.ts:98.
                  permission: "vendor.approve",
                  onSelect: () => setSuspendOpen(true),
                },
                {
                  label: "Block vendor",
                  icon: Ban,
                  destructive: true,
                  hidden: vendor.status === "BLOCKED",
                  // POST /vendors/:id/status — vendors.controller.ts:98.
                  permission: "vendor.approve",
                  onSelect: () => setSuspendOpen(true),
                },
              ]}
            />
          </>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Revenue this month" value={<Money value={vendor.revenueMonth} compact />} icon={Coins} trend="up" trendValue="6%" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Pending payout" value={<Money value={vendor.pendingSettlement} compact />} icon={Percent} accent="warning" hint={`${settlements.filter((s) => s.status === "PENDING_APPROVAL").length} settlements awaiting approval`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Zones operated" numeric={zones.length} icon={LandPlot} accent="info" hint={`${zones.reduce((s, z) => s + z.capacity, 0)} bays under management`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Attendants" numeric={attendants.length} icon={Users} hint={`${attendants.filter((a) => a.onShift).length} on shift now`} />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue={params.get("tab") ?? "overview"}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kyc">KYC ({vendor.documents.length})</TabsTrigger>
          <TabsTrigger value="zones">Zones ({zones.length})</TabsTrigger>
          <TabsTrigger value="team">Attendants ({attendants.length})</TabsTrigger>
          <TabsTrigger value="shifts">Shifts ({shifts.length})</TabsTrigger>
          <TabsTrigger value="settlements">Settlements ({settlements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Vendor details">
              <dl className="divide-y divide-border/60">
                <Field label="Organisation">{vendor.orgName}</Field>
                <Field label="Contact">{vendor.contactName}</Field>
                <Field label="Mobile">
                  <span className="font-mono text-xs">{vendor.contactPhone}</span>
                </Field>
                <Field label="Email">
                  <span className="text-xs break-all">{vendor.email}</span>
                </Field>
                <Field label="GSTIN">
                  <span className="font-mono text-xs">{vendor.gstin ?? "—"}</span>
                </Field>
                <Field label="PAN">
                  <span className="font-mono text-xs">{vendor.pan ?? "—"}</span>
                </Field>
                <Field label="Registered">{formatDate(vendor.createdAt)}</Field>
                <Field label="Approved">{vendor.approvedAt ? formatDate(vendor.approvedAt) : "—"}</Field>
              </dl>
            </SectionCard>

            <SectionCard title="Settlement account">
              <dl className="divide-y divide-border/60">
                <Field label="Bank account">
                  <span className="font-mono text-xs">{vendor.bankAccountNo ?? "Not on file"}</span>
                </Field>
                <Field label="IFSC">
                  <span className="font-mono text-xs">{vendor.bankIfsc ?? "—"}</span>
                </Field>
                <Field label="Commission">{vendor.commissionPct}%</Field>
                <Field label="Settlement cycle">Weekly</Field>
                <Field label="Payout method">RazorpayX</Field>
              </dl>
              <Separator className="my-3" />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">KYC completeness</span>
                  <span className="font-medium tabular">{kycProgress}%</span>
                </div>
                <Progress value={kycProgress} className="h-1.5" />
                {kycProgress < 100 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Payouts are held until every required document is verified.
                  </p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Performance">
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-semibold tabular">{vendor.rating?.toFixed(1) ?? "—"}</p>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={
                          i < Math.round(vendor.rating ?? 0)
                            ? "size-4 fill-amber-400 text-amber-400"
                            : "size-4 text-muted-foreground/30"
                        }
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Citizen rating this quarter</p>
                </div>
                <Separator />
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cash variance incidents</dt>
                    <dd className="font-medium tabular">
                      {shifts.filter((s) => s.status === "VARIANCE_FLAGGED").length}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Sessions this month</dt>
                    <dd className="font-medium tabular">
                      {settlements.reduce((s, x) => s + x.sessionsCount, 0).toLocaleString("en-IN")}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Avg. bay utilisation</dt>
                    <dd className="font-medium tabular">
                      {zones.length
                        ? Math.round(
                            (zones.reduce((s, z) => s + z.occupied / z.capacity, 0) / zones.length) * 100,
                          )
                        : 0}
                      %
                    </dd>
                  </div>
                </dl>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Collections" description="Cash and digital over 30 days">
            <RevenueChart height={230} />
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------------ kyc */}
        <TabsContent value="kyc" className="mt-4">
          <SectionCard
            title="KYC and agreement"
            description="Every document is stored immutably and served through signed URLs"
            contentClassName="p-0"
            action={
              // POST /vendors/:id/documents — vendors.controller.ts:116.
              <Can permission="vendor.write">
                <KycUpload vendorId={vendor.id} onUploaded={() => void refresh()} />
              </Can>
            }
          >
            <ul className="divide-y divide-border/60">
              {vendor.documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <FileCheck2 className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.type.replace("_", " ")}</p>
                    <p className="truncate text-xs text-muted-foreground">{doc.fileName}</p>
                  </div>
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    {relativeTime(doc.uploadedAt)}
                  </span>
                  <StatusBadge
                    status={doc.verified ? "APPROVED" : "PENDING"}
                    label={doc.verified ? "Verified" : "Awaiting verification"}
                  />
                  <RowActions
                    label={doc.type}
                    actions={[
                      {
                        label: "View document",
                        icon: Download,
                        // GET /media/:id/url. The document itself is only
                        // reachable through a short-lived signed URL, and
                        // seeing a vendor's file is part of reading the vendor.
                        permission: "vendor.read",
                        onSelect: async () => {
                          if (!isLiveApi || !doc.mediaId) {
                            toast.info("Opening signed URL", { description: doc.fileName });
                            return;
                          }
                          try {
                            const { data } = await mediaApi.url(doc.mediaId);
                            window.open(data.url, "_blank", "noopener,noreferrer");
                          } catch {
                            toast.error("That document could not be opened.");
                          }
                        },
                      },
                      {
                        label: "Mark verified",
                        icon: BadgeCheck,
                        hidden: doc.verified,
                        // PATCH /vendors/documents/:documentId —
                        // vendors.controller.ts:129. Uploading a document is
                        // vendor.write; deciding it is genuine is not.
                        permission: "vendor.approve",
                        onSelect: () =>
                          void apply(
                            () => vendorsApi.verifyDocument(doc.id, true),
                            (list) =>
                              list.map((v) => ({
                                ...v,
                                documents: v.documents.map((d) =>
                                  d.id === doc.id ? { ...d, verified: true } : d,
                                ),
                              })),
                            { success: "Document verified", description: doc.type.replace("_", " ") },
                          ).catch(() => undefined),
                      },
                      {
                        label: "Reject document",
                        icon: Ban,
                        destructive: true,
                        separatorBefore: true,
                        // PATCH /vendors/documents/:documentId —
                        // vendors.controller.ts:129.
                        permission: "vendor.approve",
                        onSelect: () =>
                          void apply(
                            () => vendorsApi.verifyDocument(doc.id, false),
                            (list) =>
                              list.map((v) => ({
                                ...v,
                                documents: v.documents.map((d) =>
                                  d.id === doc.id ? { ...d, verified: false } : d,
                                ),
                              })),
                            {
                              success: "Document rejected",
                              description: "The vendor is asked to re-upload.",
                            },
                          ).catch(() => undefined),
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* ---------------------------------------------------------- zones */}
        <TabsContent value="zones" className="mt-4">
          <SectionCard
            title="Zones assigned"
            description="Kerb this vendor is contracted to operate"
            contentClassName="p-0"
            action={
              // POST /vendors/:id/zones — vendors.controller.ts:142.
              <Can permission="vendor.write">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setZonePicks([]);
                    setZoneSearch("");
                    setAssignOpen(true);
                  }}
                >
                  Assign more
                </Button>
              </Can>
            }
          >
            {zonesQuery.isLoading ? (
              loadingRows
            ) : zones.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No zones assigned yet. Assign kerb before their attendants can start sessions.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {zones.map((zone) => (
                  <li key={zone.id}>
                    <Link
                      href={ROUTES.zone(zone.id)}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{zone.code}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{zone.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{zone.wardName}</p>
                      </div>
                      <StatusBadge status={zone.status} />
                      <div className="w-32">
                        <OccupancyBar occupied={zone.occupied} capacity={zone.capacity} />
                      </div>
                      <Money value={zone.revenueToday} className="w-20 text-right text-sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* ----------------------------------------------------------- team */}
        <TabsContent value="team" className="mt-4">
          <SectionCard title="Attendants" description={`${attendants.filter((a) => a.onShift).length} on shift right now`} contentClassName="p-0">
            {attendantsQuery.isLoading ? (
              loadingRows
            ) : attendants.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No attendants registered against this vendor yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {attendants.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.employeeCode} · {a.zoneName ?? "No zone"}
                      </p>
                    </div>
                    <StatusBadge status={a.onShift ? "ACTIVE" : "INACTIVE"} label={a.onShift ? "On shift" : "Off shift"} pulse={a.onShift} />
                    {/* The attendants list does not report device binding, so it
                        arrives undefined — which is "not known here", not "no
                        device". Only a definite false earns the badge. */}
                    {a.deviceBound === false && (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                        No device
                      </Badge>
                    )}
                    <div className="text-right">
                      <Money value={a.collectionToday} className="text-sm" />
                      <p className="text-xs text-muted-foreground">
                        {a.sessionsToday ?? "—"} sessions
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* --------------------------------------------------------- shifts */}
        <TabsContent value="shifts" className="mt-4">
          <SectionCard title="Recent shifts" description="Cash reconciliation at close" contentClassName="p-0">
            {shiftsQuery.isLoading ? (
              loadingRows
            ) : shifts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No shifts on record. One appears here as soon as an attendant opens and closes one.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {shifts.slice(0, 12).map((shift) => (
                  <li key={shift.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{shift.attendantName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {shift.zoneName} · {formatDateTime(shift.startAt)}
                      </p>
                    </div>
                    <StatusBadge status={shift.status} />
                    <div className="text-right">
                      <Money value={shift.cashExpected + shift.digitalTotal} className="text-sm" />
                      <p className="text-xs text-muted-foreground">{shift.sessionsCount} sessions</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* ---------------------------------------------------- settlements */}
        <TabsContent value="settlements" className="mt-4">
          <SectionCard title="Settlement history" contentClassName="p-0">
            {settlementsQuery.isLoading ? (
              loadingRows
            ) : settlements.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No settlements yet. One is drawn up per payout period, once payments have been
                captured against this vendor.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {settlements.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={ROUTES.settlement(s.id)}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{s.reference}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.sessionsCount.toLocaleString("en-IN")} sessions
                        </p>
                      </div>
                      <StatusBadge status={s.status} />
                      <div className="text-right">
                        <Money value={s.vendorShare} className="text-sm font-medium" />
                        <p className="text-xs text-muted-foreground">
                          of <Money value={s.grossCollected} compact muted /> gross
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <VendorFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        vendor={vendor}
        onDocumentUploaded={() => void refresh()}
        onSaved={(draft) =>
          apply(
            () => vendorsApi.update(vendor.id, draft as Record<string, unknown>),
            (list) => list.map((v) => ({ ...v, ...draft }) as Vendor),
            { success: "Vendor updated", description: vendor.orgName },
          )
        }
      />

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend ${vendor.orgName}?`}
        destructive
        confirmLabel="Suspend vendor"
        reason={{ label: "Reason", placeholder: "Repeated cash variance / KYC lapsed…", required: true }}
        description="Attendant logins are revoked and no new sessions can be started. Running sessions and approved settlements are unaffected."
        onConfirm={async (reason) => {
          await apply(
            () => vendorsApi.changeStatus(vendor.id, "SUSPENDED", reason),
            (list) => list.map((v) => ({ ...v, status: "SUSPENDED" as const })),
            { success: "Vendor suspended", description: vendor.orgName },
          );
        }}
      />

      {/* ------------------------------------------------------ assign zones */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign zones to {vendor.orgName}</DialogTitle>
            <DialogDescription>
              Kerb assigned here is where this vendor&apos;s attendants may start sessions. Existing
              assignments are kept — this adds to them rather than replacing them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={zoneSearch}
              onChange={(e) => setZoneSearch(e.target.value)}
              placeholder="Search zone code or name…"
            />

            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
              {assignableQuery.isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : assignable.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {zoneSearch
                    ? "No zone matches that."
                    : "Every zone on the network is already assigned to this vendor."}
                </p>
              ) : (
                assignable.map((zone) => {
                  const picked = zonePicks.includes(zone.id);
                  return (
                    <label
                      key={zone.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={picked}
                        onCheckedChange={(checked) =>
                          setZonePicks((current) =>
                            checked
                              ? [...current, zone.id]
                              : current.filter((id) => id !== zone.id),
                          )
                        }
                      />
                      <span className="font-mono text-xs text-muted-foreground">{zone.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{zone.name}</span>
                      {zone.vendorId && (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                          {zone.vendorName ?? "Another vendor"}
                        </Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <p className="text-xs text-muted-foreground text-pretty">
              A zone already operated by someone else moves to this vendor. Sessions their
              attendants have running are unaffected — only who may start the next one changes.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={zonePicks.length === 0}
              onClick={() => {
                if (zonePicks.length === 0) return;
                void apply(
                  // `replace` stays false: the dialog only ever offers zones the
                  // vendor does not already hold, so sending a replacement list
                  // would drop every existing assignment on the floor.
                  () => vendorsApi.assignZones(vendor.id, zonePicks),
                  (list) =>
                    list.map((v) => ({ ...v, zoneCount: v.zoneCount + zonePicks.length })),
                  {
                    success: `${zonePicks.length} zone${zonePicks.length === 1 ? "" : "s"} assigned`,
                    description: vendor.orgName,
                  },
                )
                  .then(() => {
                    setAssignOpen(false);
                    // The zones tab is its own query; the vendor refetch above
                    // does not touch it.
                    void zonesQuery.refetch();
                  })
                  .catch(() => undefined);
              }}
            >
              <LandPlot className="size-4" /> Assign{" "}
              {zonePicks.length > 0 ? `${zonePicks.length} zone${zonePicks.length === 1 ? "" : "s"}` : "zones"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground">
        <Building2 className="size-4 shrink-0" />
        Every change on this page is written to the audit trail with your name, IP and device.
      </div>
    </div>
  );
}
