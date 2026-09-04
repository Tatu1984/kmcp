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
import { Separator } from "@/frontend/components/ui/separator";
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
import { Field, Money, Plate, CopyButton } from "@/frontend/components/shared/bits";
import { ClickSpark } from "@/frontend/components/reactbits";
import { sessionsApi, paymentsApi, messagingApi, documentsApi, ApiError } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { useDocument } from "@/frontend/hooks/use-document";
import { useMessaging } from "@/frontend/hooks/use-messaging";
import { isLiveApi } from "@/config/env";
import { ROUTES } from "@/shared/constants/routes";
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  relativeTime,
} from "@/shared/utils/common.util";
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

  if (!session) return null;

  const live = session.status === "ACTIVE" || session.status === "OVERSTAY";
  const netGross = session.grossAmount ?? 0;

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

  return (
    <>
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
              {live && ` · running for ${relativeTime(session.startAt).replace(" ago", "")}`}
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
                <p className="text-2xl leading-none font-semibold tabular">
                  {live ? "—" : formatMoney(session.payableAmount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {live ? "Charge computed at exit" : session.paid ? "Paid" : "Unpaid"}
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
                  <Field label="Vendor">{session.vendorName}</Field>
                  <Field label="Attendant">{session.attendantName}</Field>
                  <Field label="Source">{session.source.replace("_", " ").toLowerCase()}</Field>
                  <Field label="Started">{formatDateTime(session.startAt)}</Field>
                  <Field label="Ended">
                    {session.endAt ? formatDateTime(session.endAt) : "Still running"}
                  </Field>
                  <Field label="Duration">
                    {session.durationMinutes
                      ? formatDuration(session.durationMinutes)
                      : `${relativeTime(session.startAt).replace(" ago", "")} so far`}
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
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <Clock className="mx-auto size-5 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Fare is computed at exit</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground text-pretty">
                      The attendant&apos;s app calls the quote endpoint when the vehicle leaves. Nothing
                      is priced on the device — the server resolves the tariff version, applies every
                      rule and returns the breakdown.
                    </p>
                  </div>
                ) : (
                  <>
                    <dl className="divide-y divide-border/60">
                      <Field label="Gross charge">
                        <Money value={netGross} />
                      </Field>
                      {session.discountAmount > 0 && (
                        <Field label="Discount">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            −{formatMoney(session.discountAmount)}
                          </span>
                        </Field>
                      )}
                      {session.penaltyAmount > 0 && (
                        <Field label="Overstay penalty">
                          <span className="text-amber-600 dark:text-amber-400">
                            +{formatMoney(session.penaltyAmount)}
                          </span>
                        </Field>
                      )}
                      <Field label="GST (18%)">
                        <Money value={session.taxAmount} />
                      </Field>
                    </dl>
                    <Separator />
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">Total payable</span>
                      <Money value={session.payableAmount} className="text-lg font-semibold" />
                    </div>
                    {session.paid && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          Collected via {PAYMENT_MODE_LABELS[session.paymentMode ?? "CASH"]}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Receipt issued and delivered to the citizen.
                        </p>
                      </div>
                    )}
                  </>
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
              <TabsContent value="timeline" className="mt-4">
                <ol className="relative space-y-4 border-l pl-5">
                  {[
                    { label: "Session started", at: session.startAt, detail: `${session.attendantName} · GPS inside ${session.zoneName}` },
                    { label: "Evidence stored", at: session.startAt, detail: "Entry photograph hashed and geotagged" },
                    ...(session.endAt
                      ? [
                          { label: "Fare computed", at: session.endAt, detail: `${formatDuration(session.durationMinutes)} · ${formatMoney(session.payableAmount)}` },
                          { label: "Payment captured", at: session.endAt, detail: PAYMENT_MODE_LABELS[session.paymentMode ?? "CASH"] },
                          { label: "Receipt issued", at: session.endAt, detail: "Delivered by SMS and push" },
                        ]
                      : [{ label: "Awaiting exit", at: session.startAt, detail: "Timer running" }]),
                  ].map((event, i) => (
                    <li key={i} className="relative">
                      <span className="absolute top-1 -left-[1.6rem] size-2.5 rounded-full border-2 border-background bg-primary" />
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.detail}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDateTime(event.at)}
                      </p>
                    </li>
                  ))}
                </ol>
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
    </>
  );
}
