"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Car,
  Eye,
  IdCard,
  Mail,
  Phone,
  Receipt,
  ShieldCheck,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Field, Money, PersonCell, Plate } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { CITIZENS, SESSIONS } from "@/frontend/lib/mock";
import { citizensApi, listAll } from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { toCitizen } from "@/frontend/lib/adapters";
import { isLiveApi } from "@/config/env";
import { formatDate, formatMoney, relativeTime } from "@/shared/utils/common.util";
import type { Citizen } from "@/shared/types/domain.types";

export function CitizensView() {
  const {
    items: citizens,
    isLoading,
    emptyReason,
    apply,
  } = useResource<Citizen>(
    ["citizens", "list"],
    () =>
      listAll((page, pageSize) => citizensApi.list({ page, pageSize })).then((r) =>
        r.map(toCitizen),
      ),
    CITIZENS,
  );
  const [selected, setSelected] = React.useState<Citizen | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);

  // The detail sheet needs the vehicles and parking history, which the list
  // does not carry — fetched only once a citizen is actually opened.
  const detail = useApiQuery(
    ["citizens", "detail", selected?.id ?? ""],
    () => citizensApi.get(selected!.id).then((r) => r.data),
    { enabled: Boolean(selected?.id) && sheetOpen },
  );

  /** Blacklist, suspend or restore. */
  const changeStatus = React.useCallback(
    (citizen: Citizen, status: Citizen["status"], reason: string) =>
      apply(
        () => citizensApi.setStatus(citizen.id, status, reason),
        (list) => list.map((c) => (c.id === citizen.id ? { ...c, status } : c)),
        {
          success: status === "BLACKLISTED" ? "Citizen blacklisted" : "Citizen restored",
          description: citizen.name,
        },
      ),
    [apply],
  );

  const open = (citizen: Citizen) => {
    setSelected(citizen);
    setSheetOpen(true);
  };

  const columns = React.useMemo<ColumnDef<Citizen, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Citizen",
        meta: "Citizen",
        cell: ({ row }) => (
          <PersonCell name={row.original.name} secondary={row.original.phone} />
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        meta: "Email",
        cell: ({ row }) => (
          <span className="truncate text-xs text-muted-foreground">
            {row.original.email ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "vehicleCount",
        header: "Vehicles",
        meta: "Vehicles",
        cell: ({ row }) => (
          <Badge variant="secondary" className="gap-1 tabular">
            <Car className="size-3" />
            {row.original.vehicleCount}
          </Badge>
        ),
      },
      {
        accessorKey: "sessionsCount",
        header: "Sessions",
        meta: "Sessions",
        cell: ({ row }) => <span className="text-sm tabular">{row.original.sessionsCount}</span>,
      },
      {
        accessorKey: "totalSpent",
        header: "Spent",
        meta: "Total spent",
        cell: ({ row }) => <Money value={row.original.totalSpent} />,
      },
      {
        id: "pass",
        accessorFn: (c) => (c.hasActivePass ? "Pass holder" : "No pass"),
        header: "Pass",
        meta: "Pass",
        cell: ({ row }) =>
          row.original.hasActivePass ? (
            <Badge className="gap-1 bg-violet-500/15 text-violet-700 hover:bg-violet-500/15 dark:text-violet-300">
              <Ticket className="size-3" /> Active
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const citizen = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={citizen.name}
                actions={[
                  { label: "View profile", icon: Eye, shortcut: "↵", onSelect: () => open(citizen) },
                  { label: "Call", icon: Phone, onSelect: () => toast.info("Calling", { description: citizen.phone }) },
                  {
                    label: "Email",
                    icon: Mail,
                    disabled: !citizen.email,
                    onSelect: () => toast.info("Composing email", { description: citizen.email }),
                  },
                  {
                    label: "Parking history",
                    icon: Receipt,
                    separatorBefore: true,
                    onSelect: () => open(citizen),
                  },
                  {
                    label: citizen.status === "BLACKLISTED" ? "Remove from blacklist" : "Blacklist",
                    icon: citizen.status === "BLACKLISTED" ? UserCheck : Ban,
                    destructive: citizen.status !== "BLACKLISTED",
                    separatorBefore: true,
                    onSelect: () => {
                      if (citizen.status === "BLACKLISTED") {
                        void changeStatus(
                          citizen,
                          "ACTIVE",
                          "Removed from blacklist from the portal",
                        ).catch(() => {});
                      } else {
                        setSelected(citizen);
                        setBlockOpen(true);
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
    [changeStatus],
  );

  const active = citizens.filter((c) => c.status === "ACTIVE").length;
  const blacklisted = citizens.filter((c) => c.status === "BLACKLISTED").length;
  const passHolders = citizens.filter((c) => c.hasActivePass).length;
  const totalSpent = citizens.reduce((s, c) => s + c.totalSpent, 0);

  /** Recent parking for the open citizen — from the API, or the demo set. */
  const citizenSessions = React.useMemo(() => {
    if (!selected) return [];
    if (isLiveApi) {
      return (detail.data?.sessions ?? []).slice(0, 10).map((session) => ({
        id: session.id,
        plateNumber: session.plateNumber,
        zoneName: session.zone?.name ?? "—",
        status: session.status,
        payableAmount: session.payableAmount ?? undefined,
      }));
    }
    return SESSIONS.filter((s) => s.citizenName === selected.name)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        plateNumber: s.plateNumber,
        zoneName: s.zoneName,
        status: s.status,
        payableAmount: s.payableAmount,
      }));
  }, [selected, detail.data]);

  /** Their claimed vehicles, and whether each is blocked at the kerb. */
  const citizenVehicles = isLiveApi ? (detail.data?.vehicles ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Citizens"
        description="Registered vehicle owners using the citizen app. Only the authority sees this register — vendors never do."
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Registered" numeric={active} icon={Users} accent="success" hint="Active citizen accounts" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Pass holders" numeric={passHolders} icon={Ticket} accent="info" hint="With an active monthly or season pass" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Lifetime spend" value={<Money value={totalSpent} compact />} icon={IdCard} hint="Across every registered citizen" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Blacklisted" numeric={blacklisted} icon={Ban} accent={blacklisted > 0 ? "warning" : "success"} hint="Cannot start new sessions" />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={citizens}
        columns={columns}
        enableSelection
        searchKeys={["name", "phone", "email"]}
        searchPlaceholder="Search name, mobile or email…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "BLACKLISTED", label: "Blacklisted" },
            ],
          },
          {
            columnId: "pass",
            label: "Pass",
            options: [
              { value: "Pass holder", label: "Pass holder" },
              { value: "No pass", label: "No pass" },
            ],
          },
        ]}
        onRowClick={open}
        onExport={(rows) =>
          toast.success("Export queued", {
            description: `${rows.length} citizens · personal data is redacted per DPDP rules.`,
          })
        }
        bulkActions={(rows, clear) => (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              toast.success(`Announcement queued for ${rows.length} citizens`);
              clear();
            }}
          >
            Send announcement
          </Button>
        )}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No citizens registered"}
        emptyDescription={
          emptyReason ?? "Citizens appear here after they sign up in the app with a mobile OTP."
        }
      />

      {/* ------------------------------------------------------ detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{selected.name}</SheetTitle>
                  <StatusBadge status={selected.status} />
                  {selected.hasActivePass && (
                    <Badge className="gap-1 bg-violet-500/15 text-violet-700 hover:bg-violet-500/15 dark:text-violet-300">
                      <Ticket className="size-3" /> Pass holder
                    </Badge>
                  )}
                </div>
                <SheetDescription>
                  Joined {formatDate(selected.joinedAt)} · last seen {relativeTime(selected.lastSeenAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Vehicles", value: selected.vehicleCount },
                    { label: "Sessions", value: selected.sessionsCount },
                    { label: "Spent", value: formatMoney(selected.totalSpent, { compact: true }) },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border bg-muted/25 p-3 text-center">
                      <p className="text-lg font-semibold tabular">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <dl className="divide-y divide-border/60">
                  <Field label="Mobile">
                    <span className="font-mono text-xs">{selected.phone}</span>
                  </Field>
                  <Field label="Email">
                    <span className="text-xs break-all">{selected.email ?? "Not provided"}</span>
                  </Field>
                  <Field label="Registered">{formatDate(selected.joinedAt)}</Field>
                  <Field label="Last active">{relativeTime(selected.lastSeenAt)}</Field>
                </dl>

                <Separator />

                {citizenVehicles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Vehicles</p>
                    <ul className="divide-y divide-border/60 rounded-lg border">
                      {citizenVehicles.map((vehicle) => (
                        <li key={vehicle.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <Plate value={vehicle.plateNumber} />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {vehicle.vehicleType?.label ?? "—"}
                            {vehicle.makeModel ? ` · ${vehicle.makeModel}` : ""}
                          </span>
                          <Button
                            size="sm"
                            variant={vehicle.isBlacklisted ? "outline" : "ghost"}
                            className="h-7 text-xs"
                            onClick={() => {
                              const citizen = selected;
                              void apply(
                                () =>
                                  citizensApi.setVehicleBlacklist(
                                    citizen.id,
                                    vehicle.id,
                                    !vehicle.isBlacklisted,
                                    vehicle.isBlacklisted
                                      ? "Cleared from the portal"
                                      : "Blacklisted from the portal",
                                  ),
                                (list) => list,
                                {
                                  success: vehicle.isBlacklisted
                                    ? "Plate cleared"
                                    : "Plate blacklisted",
                                  description: vehicle.plateNumber,
                                },
                              )
                                .then(() => detail.refetch())
                                .catch(() => {});
                            }}
                          >
                            {vehicle.isBlacklisted ? "Clear plate" : "Blacklist plate"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground text-pretty">
                      Blacklisting the account stops them using the app. It does not stop the car:
                      an attendant types a plate and never sees an owner, so the plate has to be
                      blocked here too.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Recent parking</p>
                  {citizenSessions.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      No sessions on record against this account.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border">
                      {citizenSessions.map((session) => (
                        <li key={session.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <Plate value={session.plateNumber} />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {session.zoneName}
                          </span>
                          <StatusBadge status={session.status} />
                          <Money value={session.payableAmount} className="text-xs" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground text-pretty">
                    Under the DPDP Act this citizen can request an export of their data or its
                    erasure. Both are handled from the settings screen and recorded in the audit
                    trail.
                  </p>
                </div>
              </div>

              <SheetFooter className="sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => toast.success("Data export queued", { description: "The citizen will receive a download link." })}>
                  Export data
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  disabled={selected.status === "BLACKLISTED"}
                  onClick={() => {
                    setSheetOpen(false);
                    setBlockOpen(true);
                  }}
                >
                  <Ban className="size-4" /> Blacklist
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Blacklist ${selected?.name}?`}
        destructive
        confirmLabel="Blacklist citizen"
        reason={{ label: "Reason", placeholder: "Repeated non-payment / abuse of an attendant / fraudulent disputes…", required: true }}
        description="They can no longer start sessions from the citizen app or buy passes. Attendants can still park their vehicle manually and charge it."
        onConfirm={(reason) => {
          if (selected) {
            void changeStatus(selected, "BLACKLISTED", (reason ?? "").trim()).catch(() => {});
          }
        }}
      />
    </div>
  );
}
