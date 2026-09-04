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
import { DataTable, facetOptionsFrom } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { Can } from "@/frontend/components/shared/can";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, Plate } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SessionDetailSheet } from "./session-detail-sheet";
import {
  IncidentFormSheet,
  type IncidentDraft,
  type IncidentSubject,
} from "@/frontend/components/features/incidents/incident-form-sheet";
import { SESSIONS, ZONES } from "@/frontend/lib/mock";
import {
  sessionsApi,
  incidentsApi,
  documentsApi,
  listAll,
  messagingApi,
  channelLabel,
  type MessageChannel,
} from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { useMessaging } from "@/frontend/hooks/use-messaging";
import { useDocument } from "@/frontend/hooks/use-document";
import { isLiveApi } from "@/config/env";
import { toSession } from "@/frontend/lib/adapters";
import { downloadCsv } from "@/frontend/lib/csv";
import { ROUTES } from "@/shared/constants/routes";
import { formatDuration, formatTime, relativeTime } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS, PAYMENT_MODE_LABELS } from "@/config/app.config";
import type { ParkingSession } from "@/shared/types/domain.types";

/**
 * The three channels a receipt can go out on, in the order an officer reaches
 * for them. Declared once here and reused by the row menu and the bulk bar, so
 * the two cannot come to offer different channels.
 */
const CHANNELS: { channel: MessageChannel; label: string }[] = [
  { channel: "SMS", label: "By SMS" },
  { channel: "WHATSAPP", label: "By WhatsApp" },
  { channel: "EMAIL", label: "By email" },
];

export function SessionsView() {
  const params = useSearchParams();
  const {
    items: sessions,
    isLoading,
    emptyReason,
    apply,
  } = useResource<ParkingSession>(
    ["sessions", "list"],
    () =>
      listAll((page, pageSize) => sessionsApi.list({ page, pageSize })).then((r) =>
        r.map(toSession),
      ),
    SESSIONS,
  );
  const [selected, setSelected] = React.useState<ParkingSession | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // The subject outlives the open flag on purpose: clearing it on close would
  // swap the sheet to its zone-picker form mid-close animation.
  const [incidentOpen, setIncidentOpen] = React.useState(false);
  const [incidentSubject, setIncidentSubject] = React.useState<IncidentSubject | null>(null);
  const { send } = useMessaging();
  // Only `run` is taken: it is referentially stable, so the column memo below
  // can keep its empty dependency list honest.
  const { run: runDocument } = useDocument();

  const zoneFilter = params.get("zone");
  const statusFilter = params.get("status");

  const data = React.useMemo(() => {
    let list = sessions;
    if (zoneFilter) list = list.filter((s) => s.zoneId === zoneFilter);
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    return list;
  }, [sessions, zoneFilter, statusFilter]);

  /**
   * The name of the zone the URL narrowed the list to.
   *
   * Every session carries its zone's name, so the list already in hand answers
   * this against a live backend — where the demo roster, which knows only the
   * demo city's zones, would leave the badge blank. The roster is still the
   * answer with no backend configured, and is consulted only then.
   */
  const zoneFilterName = React.useMemo(() => {
    if (!zoneFilter) return undefined;
    if (!isLiveApi) return ZONES.find((z) => z.id === zoneFilter)?.name;
    return sessions.find((s) => s.zoneId === zoneFilter)?.zoneName;
  }, [sessions, zoneFilter]);

  const openSession = (session: ParkingSession) => {
    setSelected(session);
    setSheetOpen(true);
  };

  /**
   * Re-sends the receipt for one or many sessions.
   *
   * The ids handed over are session ids, not payment ids — the API resolves the
   * captured payment behind each one. It also refuses any session whose payment
   * never produced a receipt, and says so, rather than issuing a second receipt
   * number for a document that already exists.
   */
  const resendReceipt = React.useCallback(
    (sessionIds: string[], channels: MessageChannel[], subject: string) =>
      void send(() => messagingApi.sendReceipts({ sessionIds, channels }), {
        success:
          sessionIds.length === 1
            ? "Receipt re-sent"
            : `Receipts re-sent for ${sessionIds.length} sessions`,
        description: `${subject} · by ${channels.map(channelLabel).join(" and ")}`,
      }),
    [send],
  );

  /**
   * Downloads the parking receipt for a session.
   *
   * A list row does not carry a payment id — `ApiSessionDetail` says why: fifty
   * sessions dragging every payment with them is not a page anybody wants — so
   * the session is fetched first and its captured payment found. A refunded
   * payment still has a receipt and still needs one, which is why
   * PARTIALLY_REFUNDED counts here as much as CAPTURED does.
   */
  const downloadReceipt = React.useCallback(async (session: ParkingSession): Promise<void> => {
    if (!isLiveApi) {
      toast.success("Receipt downloaded", { description: `${session.code}.pdf` });
      return;
    }

    let paymentId: string | undefined;
    try {
      const detail = await sessionsApi.get(session.id);
      paymentId = detail.data.payments.find(
        (payment) => payment.status === "CAPTURED" || payment.status === "PARTIALLY_REFUNDED",
      )?.id;
    } catch {
      toast.error("The session could not be read, so its receipt cannot be fetched.");
      return;
    }

    if (!paymentId) {
      toast.info("No receipt for this session", {
        description: `${session.code} has no captured payment behind it.`,
      });
      return;
    }

    const captured = paymentId;
    await runDocument(session.id, () => documentsApi.receipt(captured), {
      demo: () => undefined,
      success: "Receipt downloaded",
      description: session.code,
    });
  }, [runDocument]);

  const reportIncident = (session: ParkingSession) => {
    setIncidentSubject({
      id: session.id,
      code: session.code,
      plateNumber: session.plateNumber,
      zoneId: session.zoneId,
      zoneName: session.zoneName,
    });
    setIncidentOpen(true);
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
                  // Opening the sheet and copying a code touch no endpoint —
                  // both work entirely off the row already on screen, which
                  // `session.read` gated when the list was fetched.
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
                    // Still a toast: there is no extend endpoint. The sessions
                    // module has start, end and cancel only — extending has to
                    // re-quote the fare against the tariff version in force,
                    // so it waits on a session-extend endpoint in the sessions
                    // module. Ungated until then; the permission it will need
                    // is whatever that route is guarded on.
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
                    label: "Copy citizen's number",
                    icon: Phone,
                    // Not a messaging-module gap: a browser cannot place a call
                    // and dialling one needs a telephony bridge the API does not
                    // have. It hands the number over rather than claiming a
                    // connection it never made.
                    hidden: !session.citizenPhone,
                    onSelect: () => {
                      if (!session.citizenPhone) return;
                      void navigator.clipboard.writeText(session.citizenPhone);
                      toast.success("Number copied", { description: session.citizenPhone });
                    },
                  },
                  {
                    label: "Re-send receipt",
                    icon: Send,
                    // POST /messaging/receipts — messaging.controller.ts, on
                    // payment.read, the same grant POST /payments/:id/receipt
                    // carries. The route takes session ids as well as payment
                    // ids precisely because this list holds the former and not
                    // the latter; the server resolves the captured payment.
                    permission: "payment.read",
                    hidden: live || !session.paid,
                    children: CHANNELS.map(({ channel, label }) => ({
                      label,
                      permission: "payment.read" as const,
                      onSelect: () => resendReceipt([session.id], [channel], session.code),
                    })),
                  },
                  {
                    label: "Download receipt",
                    icon: Receipt,
                    // GET /documents/receipts/:paymentId — documents.controller.ts,
                    // on payment.read like every other receipt route. The list
                    // row has no payment id, so `downloadReceipt` fetches the
                    // session first; that is the same reason the re-send route
                    // takes session ids and resolves the payment server-side.
                    permission: "payment.read",
                    hidden: live || !session.paid,
                    onSelect: () => void downloadReceipt(session),
                  },
                  {
                    label: "Open zone",
                    icon: MapPin,
                    // GET /zones/:id — zones.controller.ts:79
                    permission: "zone.read",
                    separatorBefore: true,
                    onSelect: () => window.location.assign(ROUTES.zone(session.zoneId)),
                  },
                  {
                    label: "Report an incident",
                    icon: ShieldAlert,
                    // POST /incidents — incidents.controller.ts:55, guarded on
                    // session.read rather than incident.manage.
                    permission: "session.read",
                    onSelect: () => reportIncident(session),
                  },
                  {
                    label: "Cancel session",
                    icon: Ban,
                    // POST /sessions/:id/cancel — sessions.controller.ts:111
                    permission: "session.cancel",
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
    [resendReceipt, downloadReceipt],
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
              {/* A zone with no sessions yet names itself nowhere, so the badge
                  says what it is doing rather than trailing off mid-sentence. */}
              Filtered to {zoneFilterName ?? "one zone"}
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
            /**
             * The zones these sessions actually happened in. Against a live
             * backend the demo roster names zones no row has ever heard of,
             * so every option it offers filters the table to nothing. With no
             * backend the roster stays — it is the demo's own data, and it
             * lets the walkthrough filter to a zone that is simply quiet.
             */
            options: isLiveApi
              ? facetOptionsFrom(data, (s) => s.zoneName)
              : ZONES.map((z) => ({ value: z.name, label: z.name })),
          },
        ]}
        onRowClick={openSession}
        onExport={(rows, columns) => {
          const file = downloadCsv("sessions", rows, columns);
          toast.success("Export ready", { description: `${rows.length} sessions · ${file}` });
        }}
        bulkActions={(rows, clear) => (
          <>
            {/**
              * One request for the whole selection rather than one per row: the
              * API caps a bulk send at two hundred and answers with a count of
              * what actually went out, which is the number this bar should be
              * reporting. Paid sessions only — a receipt for money that was
              * never taken is not a document that exists.
              */}
            <Can permission="payment.read">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  const payable = rows.filter((s) => s.paid);
                  if (payable.length === 0) {
                    toast.error("Nothing to send", {
                      description: "None of the selected sessions has been paid.",
                    });
                    return;
                  }
                  resendReceipt(
                    payable.map((s) => s.id),
                    ["SMS", "EMAIL"],
                    `${payable.length} sessions`,
                  );
                  clear();
                }}
              >
                <Send className="size-3.5" /> Re-send receipts
              </Button>
            </Can>
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

      {/**
       * The same form the incidents screen raises reports from, opened with the
       * session attached. The write goes through this screen's `apply` with a
       * no-op list update: it is not a session that changed, but `apply` is
       * what owns the live call, the error toast and the demo-mode branch, and
       * a report raised in demo mode should still say so.
       */}
      <IncidentFormSheet
        open={incidentOpen}
        onOpenChange={setIncidentOpen}
        session={incidentSubject}
        onSubmit={(draft: IncidentDraft) =>
          apply(() => incidentsApi.create(draft), (list) => list, {
            success: "Incident reported",
            description: `${incidentSubject?.code} · now in the open queue`,
          })
        }
      />
    </div>
  );
}
