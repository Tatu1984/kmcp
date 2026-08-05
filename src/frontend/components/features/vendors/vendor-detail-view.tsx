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
import { Separator } from "@/frontend/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { Progress } from "@/frontend/components/ui/progress";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Field, Money, OccupancyBar, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { RevenueChart } from "@/frontend/components/features/dashboard/charts";
import { VendorFormSheet } from "./vendor-form-sheet";
import { VENDORS, ZONES, ATTENDANTS, SETTLEMENTS, SHIFTS } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";
import { formatDate, formatDateTime, relativeTime } from "@/shared/utils/common.util";
import type { Vendor } from "@/shared/types/domain.types";

export function VendorDetailView({ vendorId }: { vendorId: string }) {
  const params = useSearchParams();
  const base = VENDORS.find((v) => v.id === vendorId)!;
  const [vendor, setVendor] = React.useState<Vendor>(base);
  const [editOpen, setEditOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);

  const zones = ZONES.filter((z) => z.vendorId === vendor.id);
  const attendants = ATTENDANTS.filter((a) => a.vendorId === vendor.id);
  const settlements = SETTLEMENTS.filter((s) => s.vendorId === vendor.id);
  const shifts = SHIFTS.filter((s) => s.vendorName === vendor.orgName);

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
            <Button variant="outline" size="sm" className="h-9" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            {vendor.status === "PENDING" ? (
              <Button
                size="sm"
                className="h-9"
                onClick={() => {
                  setVendor({ ...vendor, status: "APPROVED", approvedAt: new Date().toISOString() });
                  toast.success("Vendor approved", {
                    description: `${vendor.orgName} can now be assigned kerb.`,
                  });
                }}
              >
                <BadgeCheck className="size-4" /> Approve
              </Button>
            ) : (
              <Button size="sm" className="h-9" asChild>
                <Link href={`${ROUTES.settlements}?vendor=${vendor.id}`}>
                  <Coins className="size-4" /> Settlements
                </Link>
              </Button>
            )}
            <RowActions
              label="More"
              actions={[
                { label: "Call contact", icon: Phone, onSelect: () => toast.info("Calling", { description: vendor.contactPhone }) },
                { label: "Email vendor", icon: Mail, onSelect: () => toast.info("Composing email", { description: vendor.email }) },
                { label: "Download statement", icon: Download, onSelect: () => toast.success("Statement downloaded") },
                {
                  label: "Suspend vendor",
                  icon: Pause,
                  destructive: true,
                  separatorBefore: true,
                  hidden: vendor.status !== "APPROVED",
                  onSelect: () => setSuspendOpen(true),
                },
                {
                  label: "Block vendor",
                  icon: Ban,
                  destructive: true,
                  hidden: vendor.status === "BLOCKED",
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
                      { label: "View document", icon: Download, onSelect: () => toast.info("Opening signed URL", { description: doc.fileName }) },
                      {
                        label: "Mark verified",
                        icon: BadgeCheck,
                        hidden: doc.verified,
                        onSelect: () => {
                          setVendor({
                            ...vendor,
                            documents: vendor.documents.map((d) =>
                              d.id === doc.id ? { ...d, verified: true } : d,
                            ),
                          });
                          toast.success("Document verified", { description: doc.fileName });
                        },
                      },
                      {
                        label: "Reject document",
                        icon: Ban,
                        destructive: true,
                        separatorBefore: true,
                        onSelect: () => toast.error("Document rejected", { description: "The vendor is asked to re-upload." }),
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
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info("Assign zones", { description: vendor.orgName })}>
                Assign more
              </Button>
            }
          >
            {zones.length === 0 ? (
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
                  {!a.deviceBound && (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                      No device
                    </Badge>
                  )}
                  <div className="text-right">
                    <Money value={a.collectionToday} className="text-sm" />
                    <p className="text-xs text-muted-foreground">{a.sessionsToday} sessions</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* --------------------------------------------------------- shifts */}
        <TabsContent value="shifts" className="mt-4">
          <SectionCard title="Recent shifts" description="Cash reconciliation at close" contentClassName="p-0">
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
          </SectionCard>
        </TabsContent>

        {/* ---------------------------------------------------- settlements */}
        <TabsContent value="settlements" className="mt-4">
          <SectionCard title="Settlement history" contentClassName="p-0">
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
          </SectionCard>
        </TabsContent>
      </Tabs>

      <VendorFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        vendor={vendor}
        onSaved={(draft) => setVendor((v) => ({ ...v, ...draft }) as Vendor)}
      />

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend ${vendor.orgName}?`}
        destructive
        confirmLabel="Suspend vendor"
        reason={{ label: "Reason", placeholder: "Repeated cash variance / KYC lapsed…", required: true }}
        description="Attendant logins are revoked and no new sessions can be started. Running sessions and approved settlements are unaffected."
        onConfirm={() => {
          setVendor({ ...vendor, status: "SUSPENDED" });
          toast.success("Vendor suspended", { description: vendor.orgName });
        }}
      />

      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground">
        <Building2 className="size-4 shrink-0" />
        Every change on this page is written to the audit trail with your name, IP and device.
      </div>
    </div>
  );
}
