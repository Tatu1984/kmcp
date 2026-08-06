"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  Ban,
  CircleDollarSign,
  Clock,
  Copy,
  Eye,
  MapPin,
  Phone,
  Receipt,
  Send,
  ShieldAlert,
  TimerReset,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, Plate } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SessionDetailSheet } from "./session-detail-sheet";
import { SESSIONS, ZONES } from "@/frontend/lib/mock";
import { sessionsApi } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { toSession } from "@/frontend/lib/adapters";
import { ROUTES } from "@/shared/constants/routes";
import { formatDuration, formatTime, relativeTime } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS, PAYMENT_MODE_LABELS } from "@/config/app.config";
import type { ParkingSession } from "@/shared/types/domain.types";

export function SessionsView() {
  const params = useSearchParams();
  const {
    items: sessions,
    isLoading,
    emptyReason,
    apply,
  } = useResource<ParkingSession>(
    ["sessions", "list"],
    () => sessionsApi.list({ pageSize: 200 }).then((r) => r.data.map(toSession)),
    SESSIONS,
  );
  const [selected, setSelected] = React.useState<ParkingSession | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const zoneFilter = params.get("zone");
  const statusFilter = params.get("status");

  const data = React.useMemo(() => {
    let list = sessions;
    if (zoneFilter) list = list.filter((s) => s.zoneId === zoneFilter);
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    return list;
  }, [sessions, zoneFilter, statusFilter]);

  const openSession = (session: ParkingSession) => {
    setSelected(session);
    setSheetOpen(true);
  };

  const columns = React.useMemo<ColumnDef<ParkingSession, unknown>[]>(
    () => [
      {
        accessorKey: "plateNumber",
        header: "Vehicle",
        meta: "Vehicle",
        cell: ({ row }) => (
          <div className="space-y-1">
            <Plate value={row.original.plateNumber} />
            <p className="text-[11px] text-muted-foreground">
              {VEHICLE_TYPE_LABELS[row.original.vehicleType]}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "code",
        header: "Session",
        meta: "Session code",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-mono text-xs">{row.original.code}</p>
            {row.original.source === "OFFLINE_SYNC" && (
              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                offline sync
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            pulse={row.original.status === "ACTIVE" || row.original.status === "OVERSTAY"}
          />
        ),
      },
      {
        accessorKey: "zoneName",
        header: "Zone",
        meta: "Zone",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.zoneName}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.slotCode ? `Bay ${row.original.slotCode}` : "No bay"} ·{" "}
              {row.original.attendantName}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "startAt",
        header: "Started",
        meta: "Started",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-sm tabular">{formatTime(row.original.startAt)}</p>
            <p className="text-[11px] text-muted-foreground">{relativeTime(row.original.startAt)}</p>
          </div>
        ),
      },
      {
        id: "duration",
        accessorFn: (s) => s.durationMinutes ?? 0,
        header: "Duration",
        meta: "Duration",
        cell: ({ row }) =>
          row.original.durationMinutes ? (
            <span className="text-sm whitespace-nowrap tabular">
              {formatDuration(row.original.durationMinutes)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm whitespace-nowrap text-sky-600 dark:text-sky-400">
              <Clock className="size-3.5" /> running
            </span>
          ),
      },
      {
        accessorKey: "payableAmount",
        header: "Amount",
        meta: "Amount",
        cell: ({ row }) => (
          <div className="text-right">
            <Money value={row.original.payableAmount} className="text-sm" />
            {row.original.paymentMode && (
              <p className="text-[11px] text-muted-foreground">
                {PAYMENT_MODE_LABELS[row.original.paymentMode]}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const session = row.original;
          const live = session.status === "ACTIVE" || session.status === "OVERSTAY";
          return (
            <div className="flex justify-end">
              <RowActions
                label={session.code}
                actions={[
                  { label: "View session", icon: Eye, shortcut: "↵", onSelect: () => openSession(session) },
                  {
                    label: "Copy session code",
                    icon: Copy,
                    onSelect: () => {
                      void navigator.clipboard.writeText(session.code);
                      toast.success("Copied", { description: session.code });
                    },
                  },
                  {
                    label: "Extend by",
                    icon: TimerReset,
                    hidden: !live,
                    separatorBefore: true,
                    children: [30, 60, 120].map((mins) => ({
                      label: `${mins} minutes`,
                      onSelect: () =>
                        toast.success(`Extended by ${mins} minutes`, {
                          description: `${session.plateNumber} · citizen notified`,
                        }),
                    })),
                  },
                  {
                    label: "Call citizen",
                    icon: Phone,
                    hidden: !session.citizenPhone,
                    onSelect: () =>
                      toast.info("Connecting call", { description: session.citizenPhone }),
                  },
                  {
                    label: "Re-send receipt",
                    icon: Send,
                    hidden: live || !session.paid,
                    children: [
                      { label: "By SMS", onSelect: () => toast.success("Receipt sent by SMS") },
                      { label: "By WhatsApp", onSelect: () => toast.success("Receipt sent on WhatsApp") },
                      { label: "By email", onSelect: () => toast.success("Receipt emailed") },
                    ],
                  },
                  {
                    label: "Download receipt",
                    icon: Receipt,
                    hidden: live || !session.paid,
                    onSelect: () => toast.success("Receipt downloaded", { description: `${session.code}.pdf` }),
                  },
                  {
                    label: "Open zone",
                    icon: MapPin,
                    separatorBefore: true,
                    onSelect: () => window.location.assign(ROUTES.zone(session.zoneId)),
                  },
                  {
                    label: "Report an incident",
                    icon: ShieldAlert,
                    onSelect: () => toast.info("Opening incident form", { description: session.code }),
                  },
                  {
                    label: "Cancel session",
                    icon: Ban,
                    destructive: true,
                    hidden: !live,
                    separatorBefore: true,
                    onSelect: () => openSession(session),
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

  const activeCount = data.filter((s) => s.status === "ACTIVE").length;
  const overstayCount = data.filter((s) => s.isOverstay).length;
  const unpaid = data.filter((s) => s.status === "COMPLETED" && !s.paid).length;
  const offlineSynced = data.filter((s) => s.source === "OFFLINE_SYNC").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking sessions"
        description="Every parking event on the network — live, completed, cancelled and disputed."
        meta={
          zoneFilter ? (
            <Badge variant="secondary" className="gap-1">
              Filtered to {ZONES.find((z) => z.id === zoneFilter)?.name}
              <Link href={ROUTES.sessions} className="ml-1 underline-offset-2 hover:underline">
                clear
              </Link>
            </Badge>
          ) : undefined
        }
        actions={
          <Button variant="outline" size="sm" className="h-9" asChild>
            <Link href={`${ROUTES.sessions}?status=OVERSTAY`}>
              <TriangleAlert className="size-4" /> Overstays
            </Link>
          </Button>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Running now" numeric={activeCount} icon={Activity} accent="info" hint="Vehicles currently parked" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Past expected duration"
            numeric={overstayCount}
            icon={TriangleAlert}
            accent={overstayCount > 6 ? "danger" : "warning"}
            hint="Overstay penalty applies at exit"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Completed unpaid"
            numeric={unpaid}
            icon={CircleDollarSign}
            accent={unpaid > 0 ? "warning" : "success"}
            hint="Sessions ended without a captured payment"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Synced from offline"
            numeric={offlineSynced}
            icon={Clock}
            hint={`of ${data.length} sessions in view`}
          />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={data}
        columns={columns}
        enableSelection
        initialPageSize={25}
        searchKeys={["plateNumber", "code", "zoneName", "attendantName", "vendorName"]}
        searchPlaceholder="Search plate, session code, zone or attendant…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "OVERSTAY", label: "Overstay" },
              { value: "COMPLETED", label: "Completed" },
              { value: "CANCELLED", label: "Cancelled" },
              { value: "DISPUTED", label: "Disputed" },
            ],
          },
          {
            columnId: "zoneName",
            label: "Zone",
            options: ZONES.map((z) => ({ value: z.name, label: z.name })),
          },
        ]}
        onRowClick={openSession}
        onExport={(rows) =>
          toast.success("Export queued", {
            description: `${rows.length} sessions · CSV will be emailed to you.`,
          })
        }
        bulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.success(`Receipts re-sent for ${rows.length} sessions`);
                clear();
              }}
            >
              <Send className="size-3.5" /> Re-send receipts
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                toast.info(`Flagged ${rows.length} sessions for review`);
                clear();
              }}
            >
              Flag for review
            </Button>
          </>
        )}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No sessions in this view"}
        emptyDescription={
          emptyReason ?? "Sessions appear here the moment an attendant starts one at the kerb."
        }
      />

      <SessionDetailSheet
        session={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCancelled={(id, reason) =>
          apply(
            () => sessionsApi.cancel(id, reason ?? "Cancelled from the portal"),
            (list) => list.map((s) => (s.id === id ? { ...s, status: "CANCELLED" as const } : s)),
            { success: "Session cancelled" },
          )
        }
        onExtended={(id) => apply(async () => undefined, (list) => list.map((s) => (s.id === id ? { ...s } : s)))}
      />
    </div>
  );
}
