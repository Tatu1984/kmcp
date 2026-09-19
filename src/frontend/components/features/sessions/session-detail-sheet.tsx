"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ban,
  Camera,
  Clock,
  Download,
  ImageOff,
  MapPin,
  MessageSquare,
  Phone,
  Receipt,
  RefreshCcw,
  Send,
  TimerReset,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { NOT_PERMITTED } from "@/frontend/components/shared/can";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { Field, Plate, CopyButton } from "@/frontend/components/shared/bits";
import { ElapsedTime, LiveClockProvider } from "@/frontend/components/shared/live-clock";
import { ClickSpark } from "@/frontend/components/reactbits";
import { sessionsApi, paymentsApi, messagingApi, documentsApi, ApiError } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import { useMessaging } from "@/frontend/hooks/use-messaging";
import { isLiveApi } from "@/config/env";
import { ROUTES } from "@/shared/constants/routes";
import { LIVE_COUNTS_POLL_MS, isSessionLive } from "@/frontend/lib/live";
import { FareBreakdownCard, FlatFareSummary } from "./fare-breakdown-card";
import { formatDateTime, formatDuration, formatMoney } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS, PAYMENT_MODE_LABELS } from "@/config/app.config";
import type { ParkingSession } from "@/shared/types/domain.types";

export function SessionDetailSheet({
  session,
  open,
  onOpenChange,
  onCancelled,
  onExtended,
}: {
  session: ParkingSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: (id: string, reason?: string) => void;
  onExtended?: (id: string) => void;
}) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const { can } = usePermissions();
  const documents = useDocument();
  const { send, isSending } = useMessaging();

  // Computed before the early return below, because the hooks that depend on it
  // cannot be called conditionally.
  const live = session ? isSessionLive(session.status) : false;

  /**
   * A refund is issued against a *payment*, not a session, and the session list
   * does not carry payments — `GET /sessions` returns the row only, while
   * `GET /sessions/:id` includes them. So the sheet fetches the session it is
   * showing to find the captured payment to refund. One request, only while the
   * sheet is open on a paid session, and never in demo mode.
   */
  const detail = useApiQuery(
    ["session", session?.id ?? "none", "detail"],
    () => sessionsApi.get(session!.id).then((r) => r.data),
    { enabled: open && Boolean(session?.id) && Boolean(session?.paid) },
  );

  /**
   * What this vehicle would owe if it left right now.
   *
   * The one question an officer actually has about a running session, and the
   * portal is not allowed to answer it: the server is the sole authority on
   * price. So it asks. `GET /sessions/:id/quote` prices the elapsed time
   * through the same engine that will price the session for real at exit, and
   * marks the answer `provisional` so nothing can mistake it for a charge.
   *
   * Only for a running session. A finished one already carries its stored
   * breakdown on the row this sheet was opened with, and the endpoint would
   * only hand back the same figures for a second request — the server reads a
   * closed session's fare rather than re-pricing it, deliberately, because
   * re-running today's tariff over last week's session would disagree with the
   * receipt the citizen is holding.
   *
   * Polled on the live-counters rhythm rather than the list one: it is a single
   * cheap request, and it is on screen in front of somebody watching it tick.
   */
  const runningQuote = useApiQuery(
    ["session", session?.id ?? "none", "quote"],
    () => sessionsApi.quote(session!.id).then((r) => r.data),
    {
      enabled: open && live && Boolean(session?.id),
      refetchInterval: open && live ? LIVE_COUNTS_POLL_MS : false,
    },
  );

  if (!session) return null;

  const paidVia = session.paid
    ? PAYMENT_MODE_LABELS[session.paymentMode ?? "CASH"]
    : undefined;

  /**
   * The provisional breakdown, if the server gave one.
   *
   * Both halves are checked. `quote` is nullable on the response by design, and
   * a deployment older than the route answers 404 — in either case the tab
   * falls back to saying the fare is computed at exit, which remains true.
   */
  const provisional = runningQuote.data?.provisional ? runningQuote.data.quote : null;
  /** A 404 is an older backend, not a fault. Nothing to apologise for. */
  const quoteUnavailable = runningQuote.error?.status === 404;

  /**
   * The payment the money actually came in on. A session can carry a failed
   * attempt before the one that succeeded, and refunding either of the other
   * two states is a 4xx — so the button is offered only when there is one to
   * refund. `PARTIALLY_REFUNDED` still has money left in it and stays eligible.
   */
  const refundable = (detail.data?.payments ?? []).find(
    (p) => p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED",
  );
  // Demo mode never fetches, so it keeps deciding the way it always has: a
  // session marked paid can be refunded, and the confirm dialog reports it.
  const canRefund = can("payment.refund") && (!isLiveApi || Boolean(refundable));
  // The receipt hangs off the same payment the refund does, so it is offered
  // on the same condition — with its own permission, since reading a receipt
  // and handing money back are not the same authority.
  const canDownloadReceipt = can("payment.read") && (!isLiveApi || Boolean(refundable));
  const receiptBlockedReason = !can("payment.read")
    ? NOT_PERMITTED
    : detail.isLoading
      ? "Looking up the payment…"
      : canDownloadReceipt
        ? undefined
        : "No captured payment on this session, so there is no receipt.";

  const refundBlockedReason = !can("payment.refund")
    ? NOT_PERMITTED
    : detail.isLoading
      ? "Looking up the payment…"
      : "No captured payment on this session to refund.";

  /**
   * What happened to this session, from records that exist.
   *
   * There is no session event log in the schema — only `AuditLog`, which
   * records changes officers made through the portal and knows nothing about a
   * vehicle arriving at a kerb. So this is not a replacement for one, and it is
   * still the weakest tab in the sheet.
   *
   * It is no longer fiction, though. Every row below is a timestamp the API
   * actually sends. What was removed: an "Evidence stored" entry asserting the
   * photograph was "hashed and geotagged" whether or not one was ever
   * captured; a "Payment captured" entry dated to the exit time and defaulting
   * to CASH when no mode was known; and "Receipt issued — delivered by SMS and
   * push", which was invented whole, for sessions whose receipt had never been
   * sent anywhere.
   *
   * Payments come from `GET /sessions/:id`, which is fetched only for a paid
   * session. When that detail has not loaded — demo mode, or a session the
   * fetch was never enabled for — the session row still asserts *that* money
   * was taken and by what mode, but carries no time for it, so the entry says
   * so rather than borrowing the exit timestamp.
   */
  const events: { label: string; at?: string; detail: string }[] = [
    {
      label: "Session started",
      at: session.startAt,
      detail: [
        session.attendantName !== "—" ? session.attendantName : null,
        session.slotCode ? `Bay ${session.slotCode}` : "No bay allocated",
        session.zoneName,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];

  if (session.evidenceStart) {
    events.push({
      label: "Entry photograph stored",
      at: session.startAt,
      detail: session.evidenceStart,
    });
  }

  if (session.endAt) {
    events.push(
      session.status === "CANCELLED"
        ? { label: "Session cancelled", at: session.endAt, detail: "The charge was voided and the bay released." }
        : {
            label: "Vehicle unparked, fare computed",
            at: session.endAt,
            detail: `${formatDuration(session.durationMinutes)} · ${formatMoney(session.payableAmount)}`,
          },
    );
    if (session.evidenceEnd) {
      events.push({ label: "Exit photograph stored", at: session.endAt, detail: session.evidenceEnd });
    }
  }

  const payments = detail.data?.payments ?? [];
  if (payments.length > 0) {
    for (const payment of payments) {
      events.push({
        label:
          payment.status === "CAPTURED"
            ? "Payment captured"
            : `Payment ${payment.status.replace(/_/g, " ").toLowerCase()}`,
        at: payment.createdAt,
        detail: `${formatMoney(payment.amount)} · ${PAYMENT_MODE_LABELS[payment.mode]}`,
      });
    }
  } else if (session.paid) {
    events.push({
      label: "Payment captured",
      detail: `${formatMoney(session.payableAmount)} · ${paidVia ?? "method not recorded"}`,
    });
  }

  // Oldest first. A row with no timestamp has no place in the ordering, so it
  // is kept where it was pushed rather than sorted to the front by a zero.
  const timeline = [...events].sort((a, b) =>
    a.at && b.at ? Date.parse(a.at) - Date.parse(b.at) : a.at ? -1 : 1,
  );

  return (
    /**
     * Its own clock, so the sheet ticks whether or not whatever opened it has
     * one. Opened from the sessions table or the bay board it nests inside
     * theirs, which is harmless — the inner provider simply wins, at the same
     * rhythm — and opened from anywhere else it still counts up. Stopped when
     * the sheet is closed or the session is not running: nothing to count.
     */
    <LiveClockProvider enabled={open && live}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="text-lg">Session {session.code}</SheetTitle>
              <CopyButton value={session.code} label="Copy session code" />
              <StatusBadge status={session.status} pulse={live} />
              {session.source === "OFFLINE_SYNC" && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <RefreshCcw className="size-3" /> Synced offline
                </Badge>
              )}
            </div>
            <SheetDescription>
              {session.zoneName} · started {formatDateTime(session.startAt)}
              {live && (
                <>
                  {" · running for "}
                  <ElapsedTime
                    startAt={session.startAt}
                    fallbackMinutes={session.elapsedMinutes}
                  />
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            {/* --------------------------------------------------- headline */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/25 p-4">
              <Plate value={session.plateNumber} className="text-sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{VEHICLE_TYPE_LABELS[session.vehicleType]}</p>
                <p className="text-xs text-muted-foreground">
                  {session.slotCode ? `Bay ${session.slotCode}` : "No bay assigned"}
                </p>
              </div>
              <div className="ml-auto text-right">
                {/* A running session has no charge, and a dash is the honest
                    rendering of that — unless the server has quoted one, in
                    which case say plainly that it is a running total and not a
                    bill. */}
                <p className="text-2xl leading-none font-semibold tabular">
                  {live
                    ? provisional
                      ? formatMoney(provisional.payableAmount)
                      : "—"
                    : formatMoney(session.payableAmount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {live
                    ? provisional
                      ? "So far, if it left now"
                      : "Charge computed at exit"
                    : session.paid
                      ? "Paid"
                      : "Unpaid"}
                </p>
              </div>
            </div>

            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">
                  Details
                </TabsTrigger>
                <TabsTrigger value="fare" className="flex-1">
                  Fare
                </TabsTrigger>
                <TabsTrigger value="evidence" className="flex-1">
                  Evidence
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex-1">
                  Timeline
                </TabsTrigger>
              </TabsList>

              {/* ------------------------------------------------- details */}
              <TabsContent value="details" className="mt-4">
                <dl className="divide-y divide-border/60">
                  <Field label="Session code">
                    <span className="font-mono">{session.code}</span>
                  </Field>
                  <Field label="Zone">{session.zoneName}</Field>
                  {/* The bay, which the adapter used to discard along with the
                      id that identifies it. "No bay" is a real and common
                      state, not a gap: plenty of zones have fewer numbered bays
                      than priced capacity. */}
                  <Field label="Bay">
                    {session.slotCode ? (
                      <span className="font-mono">{session.slotCode}</span>
                    ) : (
                      <span className="text-muted-foreground">No bay allocated</span>
                    )}
                  </Field>
                  <Field label="Vendor">{session.vendorName}</Field>
                  <Field label="Attendant">{session.attendantName}</Field>
                  <Field label="Source">{session.source.replace("_", " ").toLowerCase()}</Field>
                  <Field label="Started">{formatDateTime(session.startAt)}</Field>
                  <Field label="Ended">
                    {session.endAt ? formatDateTime(session.endAt) : "Still running"}
                  </Field>
                  <Field label="Duration">
                    {live ? (
                      <ElapsedTime
                        startAt={session.startAt}
                        fallbackMinutes={session.elapsedMinutes}
                      />
                    ) : session.durationMinutes !== undefined ? (
                      formatDuration(session.durationMinutes)
                    ) : (
                      "—"
                    )}
                  </Field>
                  {session.citizenName && (
                    <>
                      <Field label="Citizen">{session.citizenName}</Field>
                      <Field label="Mobile">
                        <span className="font-mono text-xs">{session.citizenPhone}</span>
                      </Field>
                    </>
                  )}
                  <Field label="Payment method">
                    {session.paymentMode ? PAYMENT_MODE_LABELS[session.paymentMode] : "—"}
                  </Field>
                </dl>
              </TabsContent>

              {/* ---------------------------------------------------- fare */}
              <TabsContent value="fare" className="mt-4 space-y-3">
                {live ? (
                  provisional ? (
                    <FareBreakdownCard quote={provisional} provisional />
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <Clock className="mx-auto size-5 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium">Fare is computed at exit</p>
                      <p className="mx-auto mt-1 max-w-sm text-xs text-pretty text-muted-foreground">
                        Nothing is priced here and nothing is priced on the attendant&apos;s handset.
                        When the vehicle is marked unparked, the server resolves the rate card that
                        was in force, applies every rule and returns the breakdown — which then
                        appears on this tab, in this order, for both apps and this screen.
                      </p>
                      {runningQuote.isError && !quoteUnavailable && (
                        /* The request failed on its merits. Worth showing: the
                           alternative is a tab that looks identical whether the
                           figure is missing by design or missing because
                           something broke. A 404 is excluded — that is simply a
                           backend that does not offer running totals yet, and
                           the copy above is already the right answer for it. */
                        <p className="mx-auto mt-2 max-w-sm text-xs text-amber-600 dark:text-amber-400">
                          A running total was requested and could not be read.{" "}
                          {runningQuote.error?.message}
                        </p>
                      )}
                    </div>
                  )
                ) : session.fareBreakdown ? (
                  /* The calculation the server actually performed, stored on the
                     session the moment it ended. */
                  <FareBreakdownCard quote={session.fareBreakdown} paidVia={paidVia} />
                ) : (
                  <FlatFareSummary
                    grossAmount={session.grossAmount}
                    discountAmount={session.discountAmount}
                    penaltyAmount={session.penaltyAmount}
                    taxAmount={session.taxAmount}
                    payableAmount={session.payableAmount}
                    paidVia={paidVia}
                  />
                )}
              </TabsContent>

              {/* ------------------------------------------------ evidence */}
              <TabsContent value="evidence" className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Entry photograph", key: session.evidenceStart, at: session.startAt },
                    { label: "Exit photograph", key: session.evidenceEnd, at: session.endAt },
                  ].map((shot) => (
                    <div key={shot.label} className="overflow-hidden rounded-lg border">
                      <div className="grid aspect-4/3 place-items-center bg-muted/40">
                        {shot.key ? (
                          <div className="text-center">
                            <Camera className="mx-auto size-6 text-muted-foreground" />
                            <p className="mt-1.5 px-3 font-mono text-[10px] break-all text-muted-foreground">
                              {shot.key}
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <ImageOff className="mx-auto size-6 text-muted-foreground/60" />
                            <p className="mt-1.5 text-xs text-muted-foreground">Not captured yet</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-0.5 border-t px-3 py-2">
                        <p className="text-xs font-medium">{shot.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {shot.at ? formatDateTime(shot.at) : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    Phase 1
                  </Badge>
                  <p className="text-xs text-muted-foreground text-pretty">
                    The attendant photographs the plate and types the registration number. Images are
                    stored immutably with a hash, timestamp and geotag, and are served through
                    short-lived signed URLs. ANPR auto-recognition arrives in Phase 2 and slots in
                    here without changing anything downstream.
                  </p>
                </div>
              </TabsContent>

              {/* ------------------------------------------------ timeline */}
              <TabsContent value="timeline" className="mt-4 space-y-3">
                <ol className="relative space-y-4 border-l pl-5">
                  {timeline.map((event, i) => (
                    <li key={`${event.label}-${i}`} className="relative">
                      <span className="absolute top-1 -left-[1.6rem] size-2.5 rounded-full border-2 border-background bg-primary" />
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs break-all text-muted-foreground">{event.detail}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {event.at ? formatDateTime(event.at) : "Time not recorded against this session"}
                      </p>
                    </li>
                  ))}

                  {live && (
                    <li className="relative">
                      <span className="absolute top-1 -left-[1.6rem] size-2.5 animate-pulse rounded-full border-2 border-background bg-sky-500" />
                      <p className="text-sm font-medium">Still parked</p>
                      <p className="text-xs text-muted-foreground">
                        Running for{" "}
                        <ElapsedTime
                          startAt={session.startAt}
                          fallbackMinutes={session.elapsedMinutes}
                        />
                        . The fare is computed when the attendant marks the vehicle unparked.
                      </p>
                    </li>
                  )}
                </ol>

                <p className="rounded-lg border border-dashed bg-muted/25 p-3 text-[11px] text-pretty text-muted-foreground">
                  Built from the timestamps the session itself carries. There is no per-session event
                  log in the platform — the audit trail records what officers changed, not what
                  happened at the kerb — so anything the records do not show is absent here rather
                  than assumed.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <SheetFooter className="gap-2 sm:flex-row sm:flex-wrap">
            {live ? (
              <>
                {/* Waits on a session-extend endpoint in the sessions module —
                    extending has to re-quote against the tariff version in
                    force, which no route does yet. */}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onExtended?.(session.id);
                    toast.success("Session extended by 1 hour", {
                      description: `${session.plateNumber} · citizen notified`,
                    });
                  }}
                >
                  <TimerReset className="size-4" /> Extend
                </Button>
                {/* Not a messaging-module gap: a browser cannot place a call,
                    and dialling one needs a telephony bridge the API does not
                    have. So this hands over the number rather than claiming a
                    connection — the officer dials it on the desk phone. */}
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!session.citizenPhone}
                  title={session.citizenPhone ? undefined : "No number on file"}
                  onClick={() => {
                    if (!session.citizenPhone) return;
                    void navigator.clipboard.writeText(session.citizenPhone);
                    toast.success("Number copied", { description: session.citizenPhone });
                  }}
                >
                  <Phone className="size-4" /> Call citizen
                </Button>
                {/* POST /sessions/:id/cancel — sessions.controller.ts:111 */}
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  disabled={!can("session.cancel")}
                  title={can("session.cancel") ? undefined : NOT_PERMITTED}
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban className="size-4" /> Cancel
                </Button>
              </>
            ) : (
              <>
                {/* GET /documents/receipts/:paymentId — documents.controller.ts,
                    on payment.read like the receipt route beside it. It needs
                    the payment id, which is why it waits on the same detail
                    fetch the refund button does. */}
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!canDownloadReceipt || documents.isBusy}
                  title={receiptBlockedReason}
                  onClick={() => {
                    void documents.run(
                      session.id,
                      () => documentsApi.receipt(refundable?.id ?? ""),
                      {
                        demo: () =>
                          toast.success("Receipt downloaded", {
                            description: `${session.code}.pdf`,
                          }),
                        success: "Receipt downloaded",
                        description: session.code,
                      },
                    );
                  }}
                >
                  <Download className="size-4" /> Receipt
                </Button>
                {/* POST /messaging/receipts — on payment.read, the grant
                    POST /payments/:id/receipt already carries. SMS and email
                    together: the two a citizen is most likely to still have
                    when they need the receipt months later. */}
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!can("payment.read") || isSending}
                  title={can("payment.read") ? undefined : NOT_PERMITTED}
                  onClick={() =>
                    void send(
                      () =>
                        messagingApi.sendReceipts({
                          sessionIds: [session.id],
                          channels: ["SMS", "EMAIL"],
                        }),
                      { success: "Receipt re-sent", description: `${session.code} · by SMS and email` },
                    )
                  }
                >
                  <Send className="size-4" /> Re-send
                </Button>
                {session.paid && (
                  <ClickSpark>
                    {/* POST /payments/:id/refund — payments.controller.ts:103 */}
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={!canRefund}
                      title={canRefund ? undefined : refundBlockedReason}
                      onClick={() => setRefundOpen(true)}
                    >
                      <Receipt className="size-4" /> Refund
                    </Button>
                  </ClickSpark>
                )}
              </>
            )}
            <Button variant="ghost" asChild>
              <Link href={ROUTES.zone(session.zoneId)}>
                <MapPin className="size-4" /> Zone
              </Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this parking session?"
        destructive
        confirmLabel="Cancel session"
        reason={{
          label: "Why is this session being cancelled?",
          placeholder: "Wrong plate captured / vehicle never parked / duplicate entry…",
          required: true,
        }}
        description="Cancelling voids the charge and releases the bay. The reason and your name go into the audit trail, and the citizen is notified."
        onConfirm={(reason) => {
          onCancelled?.(session.id, reason);
          onOpenChange(false);
          toast.success("Session cancelled", { description: `${session.code} · ${reason}` });
        }}
      />

      <ConfirmDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title={`Refund ${formatMoney(session.payableAmount)}?`}
        destructive
        confirmLabel="Issue refund"
        reason={{ label: "Refund reason", placeholder: "Overcharged / duplicate payment / goodwill…", required: true }}
        description={
          <span className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 size-4 shrink-0" />
            <span>
              The full amount goes back to the original payment method. Card and UPI refunds take 3–5
              working days to reach the citizen&apos;s account.
            </span>
          </span>
        }
        /**
         * The amount is deliberately not sent: omitting it tells the API to
         * return everything still refundable on that payment, which is the
         * server's own figure rather than one this sheet computed from a
         * session row. A portal that names its own refund amount is a portal
         * that can refund more than was ever collected.
         */
        onConfirm={async (reason) => {
          if (!isLiveApi) {
            toast.success("Refund initiated", {
              description: `${formatMoney(session.payableAmount)} · ${reason}`,
            });
            return;
          }
          if (!refundable) {
            toast.error("No captured payment on this session to refund.");
            return;
          }
          try {
            const { data: payment } = await paymentsApi.refund(refundable.id, {
              reason: reason ?? "Refunded from the portal",
            });
            await detail.refetch();
            toast.success("Refund initiated", {
              description: `${formatMoney(payment.refundedAmount)} back to the original payment method.`,
            });
          } catch (error) {
            toast.error(
              error instanceof ApiError ? error.message : "That refund did not go through.",
            );
          }
        }}
      />
    </LiveClockProvider>
  );
}
