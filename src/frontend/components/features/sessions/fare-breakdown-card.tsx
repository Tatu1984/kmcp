"use client";

import * as React from "react";
import { Clock, Info, Ticket, TrendingDown } from "lucide-react";
import { Badge } from "@/frontend/components/ui/badge";
import { Separator } from "@/frontend/components/ui/separator";
import { Field, Money } from "@/frontend/components/shared/bits";
import { formatDuration, formatMoney } from "@/shared/utils/common.util";
import type { Quote } from "@/shared/types/domain.types";

/**
 * A fare shown as the calculation it is, rather than as four flat totals.
 *
 * This screen used to render Gross, Discount, Penalty and Total, under a label
 * that read "GST (18%)" — hardcoded, beside a tax figure the server had
 * computed from whatever percentage the rate card actually carried. Two things
 * were wrong with that. The label was a guess that would be silently wrong the
 * day the authority changed the rate, and four totals do not answer the only
 * question anybody opens this tab to ask: *why* is it that much.
 *
 * The answer was in the response all along. Every session the API has ever
 * ended carries a `fareBreakdown` — the whole quote, line by line, with the
 * chargeable minutes and the grace period that produced them — and the portal
 * was discarding it at the adapter.
 *
 * The order and the labelling follow the attendant application's own fare card
 * (`kmcp-vendor/apps/vendor/app/session/[code].tsx`), so a citizen disputing a
 * charge at the kerb and an officer looking it up at a desk are reading the
 * same document in the same order. Nothing here computes anything: every figure
 * below is the server's, and the only arithmetic is the subtraction that says
 * how much of the stay was free.
 */
export function FareBreakdownCard({
  quote,
  provisional = false,
  paidVia,
}: {
  quote: Quote;
  /**
   * Marks this as an as-if-it-ended-now figure for a session still running,
   * rather than a charge that was made. The distinction matters: the meter is
   * still going, and the rate card in force can change before the vehicle
   * actually leaves.
   */
  provisional?: boolean;
  /** How the money came in, when it has. Rendered as a footnote, not a line. */
  paidVia?: string;
}) {
  /**
   * How much of the stay was not charged for.
   *
   * Derived rather than read because the API reports the two durations and not
   * the difference — and it is the difference that gets argued about. A citizen
   * disputing a parking charge is, more often than not, disputing the grace
   * period: they were back within ten minutes, or they believe they were.
   */
  const freeMinutes = Math.max(0, quote.durationMinutes - quote.chargeableMinutes);

  return (
    <div className="space-y-3">
      {provisional && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/[0.06] p-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div>
            <p className="text-sm font-medium text-sky-700 dark:text-sky-300">
              If the vehicle left now
            </p>
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
              Priced by the server against the rate card in force, for this moment only. The meter is
              still running and this is not what has been charged — the fare is settled when the
              attendant marks the vehicle unparked.
            </p>
          </div>
        </div>
      )}

      <dl className="divide-y divide-border/60">
        {/* Every line the server itemised, in the order it itemised them. */}
        {quote.lines.map((line, i) => (
          <Field key={`${line.code}-${i}`} label={line.label}>
            <Money value={line.amount} />
          </Field>
        ))}

        {quote.lines.length === 0 && (
          <Field label="Parking charge">
            {/* A stay entirely inside the grace period is priced at nothing and
                has nothing to itemise. Saying so is the honest rendering; an
                empty list would read as a breakdown that failed to load. */}
            <span className="text-muted-foreground">Nothing chargeable</span>
          </Field>
        )}

        {quote.discountAmount > 0 && (
          <Field label="Discount">
            <span className="text-emerald-600 dark:text-emerald-400">
              −{formatMoney(quote.discountAmount)}
            </span>
          </Field>
        )}

        {quote.penaltyAmount > 0 && (
          <Field label="Overstay penalty">
            <span className="text-amber-600 dark:text-amber-400">
              +{formatMoney(quote.penaltyAmount)}
            </span>
          </Field>
        )}

        {quote.taxAmount > 0 && (
          /* The percentage the server actually applied. Never a literal. */
          <Field label={`Tax (${quote.taxPercent}%)`}>
            <Money value={quote.taxAmount} />
          </Field>
        )}
      </dl>

      <Separator />

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{provisional ? "Would be payable" : "Total payable"}</span>
        <Money value={quote.payableAmount} className="text-lg font-semibold" />
      </div>

      {(quote.waivedByPass || quote.cappedByDailyLimit) && (
        <div className="flex flex-wrap gap-2">
          {/* Both of these change what a citizen owes, and neither is visible
              anywhere in the four totals this card replaced. A fare that came
              out lower than the rate card suggests looks like an error until
              one of these says why. */}
          {quote.waivedByPass && (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            >
              <Ticket className="size-3" /> Covered by a pass
            </Badge>
          )}
          {quote.cappedByDailyLimit && (
            <Badge
              variant="outline"
              className="gap-1.5 border-sky-500/40 text-sky-700 dark:text-sky-300"
            >
              <TrendingDown className="size-3" /> Daily cap applied
            </Badge>
          )}
        </div>
      )}

      {/* ------------------------------------------- how the time was counted */}
      <div className="space-y-1 rounded-lg border border-dashed bg-muted/25 p-3">
        <p className="text-xs font-medium">{quote.tariffName}</p>
        <p className="text-xs text-muted-foreground">
          <span className="tabular">{formatDuration(quote.chargeableMinutes)}</span> chargeable of{" "}
          <span className="tabular">{formatDuration(quote.durationMinutes)}</span> parked
        </p>
        <p className="text-[11px] text-pretty text-muted-foreground">
          {freeMinutes > 0
            ? `The first ${quote.gracePeriodMin} minutes are free on this rate card, so ${freeMinutes} ` +
              `${freeMinutes === 1 ? "minute was" : "minutes were"} not charged.`
            : quote.gracePeriodMin > 0
              ? `This rate card has a ${quote.gracePeriodMin} minute grace period. The whole stay was past it.`
              : "This rate card has no grace period — charging starts on arrival."}
        </p>
      </div>

      {paidVia && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Collected via {paidVia}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Receipt issued and delivered to the citizen.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * What to show when a session has totals but no stored breakdown.
 *
 * Reachable two ways, and both are real: a session ended by a deployment older
 * than the `fareBreakdown` column, and a row whose stored JSON did not survive
 * the adapter's check. Neither is a reason to show nothing — the four totals on
 * the session row are still the server's own figures — but it is every reason
 * not to caption the tax with a percentage nobody recorded.
 */
export function FlatFareSummary({
  grossAmount,
  discountAmount,
  penaltyAmount,
  taxAmount,
  payableAmount,
  paidVia,
}: {
  grossAmount?: number;
  discountAmount: number;
  penaltyAmount: number;
  taxAmount: number;
  payableAmount?: number;
  paidVia?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-pretty text-muted-foreground">
          No itemised breakdown was stored for this session, so these are the totals only. Sessions
          ended by the current API carry the full calculation — every line, the chargeable minutes
          and the tax rate applied.
        </p>
      </div>

      <dl className="divide-y divide-border/60">
        <Field label="Gross charge">
          <Money value={grossAmount} />
        </Field>
        {discountAmount > 0 && (
          <Field label="Discount">
            <span className="text-emerald-600 dark:text-emerald-400">
              −{formatMoney(discountAmount)}
            </span>
          </Field>
        )}
        {penaltyAmount > 0 && (
          <Field label="Overstay penalty">
            <span className="text-amber-600 dark:text-amber-400">
              +{formatMoney(penaltyAmount)}
            </span>
          </Field>
        )}
        {/* Unlabelled by rate on purpose: the percentage is not recorded on this
            row, and the figure it was computed from is the one thing this card
            cannot reconstruct. */}
        <Field label="Tax">
          <Money value={taxAmount} />
        </Field>
      </dl>

      <Separator />

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Total payable</span>
        <Money value={payableAmount} className="text-lg font-semibold" />
      </div>

      {paidVia && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Collected via {paidVia}
          </p>
        </div>
      )}
    </div>
  );
}
