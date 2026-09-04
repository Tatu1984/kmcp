"use client";

import * as React from "react";
import { Calculator, Clock, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Label } from "@/frontend/components/ui/label";
import { Slider } from "@/frontend/components/ui/slider";
import { Input } from "@/frontend/components/ui/input";
import { Separator } from "@/frontend/components/ui/separator";
import { Badge } from "@/frontend/components/ui/badge";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { SectionCard, Money } from "@/frontend/components/shared/bits";
import { tariffsApi, zonesApi, listAll, ApiError, type Quote } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { formatDuration, formatMoney } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import type { SlotType } from "@/shared/types/domain.types";

/**
 * The fare, computed by the server that will actually charge it.
 *
 * The demo-mode calculator alongside this one reimplements the tariff rules in
 * the browser, which is fine for a laptop with no backend and wrong for
 * anything else: a second copy of the pricing rules is a second thing to keep
 * in step, and the moment it drifts the portal is quoting a fare the kerb will
 * not charge. This calls `POST /tariffs/preview` — the same `QuoteService` a
 * session runs through at exit — so what an officer sees here is what a citizen
 * will pay, by construction rather than by diligence.
 *
 * It follows from that that the peak, weekend and holiday switches are gone.
 * The server derives those from the arrival time against the published rules
 * and the holiday calendar; offering a switch would be inviting an officer to
 * assert a condition the engine is entitled to disagree about. Give it a time
 * instead, and let it apply the rules it will apply on the day.
 */

/** How long after the preview stops changing before we ask the server. */
const DEBOUNCE_MS = 350;

const START_PRESETS = [
  { key: "now", label: "Right now", at: () => new Date() },
  { key: "peak-am", label: "Weekday 10:00", at: () => atHour(1, 10) },
  { key: "peak-pm", label: "Weekday 18:30", at: () => atHour(1, 18, 30) },
  { key: "night", label: "Weekday 23:00", at: () => atHour(1, 23) },
  { key: "sat", label: "Saturday 12:00", at: () => atHour(6, 12) },
  { key: "sun", label: "Sunday 12:00", at: () => atHour(0, 12) },
] as const;

/** The next occurrence of a weekday at a given local time. */
function atHour(weekday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

export function LiveQuoteCalculator() {
  const zones = useApiQuery(["zones", "quote-picker"], () =>
    listAll((page, pageSize) => zonesApi.list({ page, pageSize })),
  );

  const [zoneId, setZoneId] = React.useState<string>("");
  const [vehicleType, setVehicleType] = React.useState<SlotType>("CAR");
  const [minutes, setMinutes] = React.useState(150);
  const [preset, setPreset] = React.useState<string>("now");
  const [discountCode, setDiscountCode] = React.useState("");

  const zoneList = zones.data ?? [];
  const zone = zoneList.find((z) => z.id === zoneId) ?? zoneList[0];

  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  /**
   * Every input change is a round trip, so they are debounced — dragging the
   * duration slider would otherwise fire a request per pixel.
   */
  React.useEffect(() => {
    if (!zone) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setPending(true);
      const startAt = (START_PRESETS.find((p) => p.key === preset) ?? START_PRESETS[0]).at();
      tariffsApi
        .preview({
          zoneId: zone.id,
          vehicleType,
          durationMinutes: minutes,
          startAt: startAt.toISOString(),
          discountCode: discountCode.trim() || undefined,
        })
        .then(({ data }) => {
          if (cancelled) return;
          setQuote(data);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setQuote(null);
          // A zone with no published rate card for this vehicle is a real
          // answer, not a failure — say which, rather than "something failed".
          setError(
            cause instanceof ApiError
              ? cause.message
              : "The fare could not be calculated. Please try again.",
          );
        })
        .finally(() => {
          if (!cancelled) setPending(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [zone, vehicleType, minutes, preset, discountCode]);

  // A zone declares which vehicles its kerb takes; fall back to the full
  // catalogue only while the list is still loading.
  const vehicleTypes = (
    zone?.allowedVehicleTypeIds?.length
      ? zone.allowedVehicleTypeIds
      : Object.keys(VEHICLE_TYPE_LABELS)
  ) as SlotType[];

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Calculator className="size-4" /> Fare calculator
        </span>
      }
      description="Computed by the API, using the same engine that prices a real session at exit"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------------- controls */}
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quote-zone">Zone</Label>
              {zones.isLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={zone?.id ?? ""} onValueChange={setZoneId}>
                  <SelectTrigger id="quote-zone" className="w-full">
                    <SelectValue placeholder="Choose a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneList.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.code} · {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quote-vehicle">Vehicle</Label>
              <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as SlotType)}>
                <SelectTrigger id="quote-vehicle" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {VEHICLE_TYPE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label>Time parked</Label>
              <span className="text-lg font-semibold tabular">{formatDuration(minutes)}</span>
            </div>
            <Slider
              value={[minutes]}
              onValueChange={([v]) => setMinutes(v)}
              min={5}
              max={1440}
              step={5}
            />
            <div className="flex justify-between text-xs text-muted-foreground tabular">
              <span>5m</span>
              <span>24h</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="quote-start">Arrival</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger id="quote-start" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {START_PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground text-pretty">
              Peak, weekend and holiday rules are applied by the server from this time and the
              published calendar — they are not something the portal asserts.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote-discount">Discount code</Label>
            <Input
              id="quote-discount"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder="Optional — e.g. RESIDENT20"
              className="font-mono"
            />
          </div>
        </div>

        {/* -------------------------------------------------------- receipt */}
        <div className="space-y-3 rounded-xl border bg-muted/25 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fare breakdown
            </p>
            <div className="flex items-center gap-1.5">
              {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Clock className="size-3" /> {formatDuration(minutes)}
              </Badge>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 py-6 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-pretty">{error}</span>
            </div>
          ) : !quote ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {quote.tariffName} · charging {formatDuration(quote.chargeableMinutes)} of{" "}
                {formatDuration(quote.durationMinutes)}
              </p>

              <dl className="space-y-1.5">
                {quote.lines.map((line, i) => (
                  <div key={`${line.code}-${i}`} className="flex items-baseline justify-between gap-4 text-sm">
                    <dt className="text-muted-foreground text-pretty">{line.label}</dt>
                    <dd
                      className={
                        line.amount < 0
                          ? "tabular text-emerald-600 dark:text-emerald-400"
                          : "tabular"
                      }
                    >
                      {line.amount < 0 ? "−" : ""}
                      {formatMoney(Math.abs(line.amount))}
                    </dd>
                  </div>
                ))}
              </dl>

              <Separator />

              <dl className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>
                    <Money value={quote.grossAmount} />
                  </dd>
                </div>
                {quote.discountAmount > 0 && (
                  <div className="flex items-baseline justify-between text-sm">
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className="tabular text-emerald-600 dark:text-emerald-400">
                      −{formatMoney(quote.discountAmount)}
                    </dd>
                  </div>
                )}
                {quote.penaltyAmount > 0 && (
                  <div className="flex items-baseline justify-between text-sm">
                    <dt className="text-muted-foreground">Overstay penalty</dt>
                    <dd className="tabular">{formatMoney(quote.penaltyAmount)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between text-sm">
                  <dt className="text-muted-foreground">GST ({quote.taxPercent}%)</dt>
                  <dd>
                    <Money value={quote.taxAmount} />
                  </dd>
                </div>
              </dl>

              <Separator />

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Payable</span>
                <span className="text-2xl font-semibold tabular">
                  {formatMoney(quote.payableAmount)}
                </span>
              </div>

              {quote.gracePeriodMin > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 size-3 shrink-0" />
                  The first {quote.gracePeriodMin} minutes are free under the grace period.
                </p>
              )}
              {quote.cappedByDailyLimit && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Daily cap reached — a longer stay costs no more than this.
                </p>
              )}
              {quote.waivedByPass && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Covered by an active pass — nothing to pay.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
