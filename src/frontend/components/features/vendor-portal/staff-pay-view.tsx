"use client";

import * as React from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  attendantPaymentsApi,
  PAY_MODE_LABELS,
  type ApiAttendantPaySummary,
  type AttendantPayMode,
} from "@/frontend/api";
import { useApiQuery, describeApiError } from "@/frontend/hooks/use-api";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { Badge } from "@/frontend/components/ui/badge";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { RequiresApi } from "./requires-api";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/frontend/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/frontend/components/ui/table";
import { formatMoney } from "@/shared/utils/common.util";

const MODES: AttendantPayMode[] = ["CASH", "UPI", "BANK_TRANSFER"];

/**
 * What this vendor has paid their own staff.
 *
 * The second leg of the money: KMC settles with the vendor, and the vendor pays
 * the attendant. Until now only the first leg was recorded anywhere, so the
 * only evidence an attendant had been paid belonged to the person who owed
 * them the money.
 *
 * Everything here is readable by this vendor alone. That is not enforced by the
 * permission on the route — a superuser passes every permission check by
 * definition — but by the API refusing any caller who has no vendor of their
 * own. There is consequently no vendor selector on this screen, because there
 * is no other vendor to select.
 */
function StaffPayViewInner() {
  const [open, setOpen] = React.useState(false);

  const summary = useApiQuery(["vendor", "staff-pay", "summary"], () =>
    attendantPaymentsApi.summary().then((r) => r.data),
  );
  const recent = useApiQuery(["vendor", "staff-pay", "recent"], () =>
    attendantPaymentsApi.list({ pageSize: 25 }).then((r) => r.data),
  );

  if (summary.isLoading) {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }

  if (summary.isError || !summary.data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load staff payments"
        description={describeApiError(summary.error)}
        action={
          <Button variant="outline" size="sm" onClick={() => void summary.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const data: ApiAttendantPaySummary = summary.data;

  function refresh() {
    void summary.refetch();
    void recent.refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-6">
          <Figure label="Paid out" value={formatMoney(data.totalPaid)} />
          <Figure label="Payments" value={String(data.payments)} />
          {data.byMode.map((m) => (
            <Figure
              key={m.mode}
              label={PAY_MODE_LABELS[m.mode]}
              value={formatMoney(m.amount)}
              sub={`${m.count} payment${m.count === 1 ? "" : "s"}`}
            />
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" aria-hidden />
              Record a payment
            </Button>
          </DialogTrigger>
          <RecordPaymentDialog
            staff={data.byAttendant}
            onDone={() => {
              setOpen(false);
              refresh();
            }}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your attendants</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byAttendant.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no attendants on the books yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendant</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byAttendant.map((s) => (
                  <TableRow key={s.attendantId}>
                    <TableCell className="font-medium">
                      {s.name}
                      {!s.isActive ? (
                        <Badge variant="outline" className="ml-2">
                          Inactive
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.employeeCode}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.payments}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {/* Zero here means "never paid", not "nothing owed" — the
                          list deliberately includes staff paid nothing, and a
                          blank cell would read as the opposite. */}
                      {s.payments === 0 ? (
                        <span className="text-muted-foreground">Not yet paid</span>
                      ) : (
                        formatMoney(s.amount)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !recent.data || recent.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid</TableHead>
                  <TableHead>Attendant</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(p.paidAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.attendant?.user.name ?? "—"}
                    </TableCell>
                    <TableCell>{PAY_MODE_LABELS[p.mode]}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground tabular-nums">{sub}</div> : null}
    </div>
  );
}

function RecordPaymentDialog({
  staff,
  onDone,
}: {
  staff: ApiAttendantPaySummary["byAttendant"];
  onDone: () => void;
}) {
  const [attendantId, setAttendantId] = React.useState("");
  const [rupees, setRupees] = React.useState("");
  const [mode, setMode] = React.useState<AttendantPayMode>("CASH");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const amount = Number(rupees);
  // The API demands a reference for anything that is not cash, because a
  // transfer with nothing to quote cannot be reconciled against a statement
  // later. Saying so here beats letting the server say it after a round trip.
  const needsReference = mode !== "CASH";
  const canSubmit =
    Boolean(attendantId) &&
    Number.isFinite(amount) &&
    amount > 0 &&
    (!needsReference || reference.trim().length > 0) &&
    !busy;

  async function submit() {
    setBusy(true);
    try {
      await attendantPaymentsApi.create({
        attendantId,
        // Rupees on screen, paise on the wire.
        amount: Math.round(amount * 100),
        mode,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success("Payment recorded");
      onDone();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Record a payment</DialogTitle>
        <DialogDescription>
          This records money you have already paid. It does not move anything — it is the
          evidence that you paid, kept where only you can read it.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="attendant">Attendant</Label>
          <Select value={attendantId} onValueChange={setAttendantId}>
            <SelectTrigger id="attendant">
              <SelectValue placeholder="Who was paid?" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.attendantId} value={s.attendantId}>
                  {s.name} · {s.employeeCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={rupees}
            onChange={(e) => setRupees(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mode">How you paid</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as AttendantPayMode)}>
            <SelectTrigger id="mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAY_MODE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reference">
            Reference {needsReference ? "" : <span className="text-muted-foreground">(optional)</span>}
          </Label>
          <Input
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={
              mode === "CASH" ? "Voucher number, if you use one" : "UPI transaction id or bank UTR"
            }
          />
          {needsReference ? (
            <p className="text-xs text-muted-foreground">
              Required for {PAY_MODE_LABELS[mode]} — without it this cannot be matched to your
              bank statement later.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What this covers"
            rows={2}
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={() => void submit()} disabled={!canSubmit}>
          {busy ? "Recording…" : "Record payment"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Nothing here renders without a backend. See `RequiresApi` for why this screen
 * does not fall back to the demo dataset the rest of the portal uses.
 */
export function StaffPayView() {
  return (
    <RequiresApi>
      <StaffPayViewInner />
    </RequiresApi>
  );
}
