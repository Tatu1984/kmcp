"use client";

import * as React from "react";
import { Calculator, Clock, Sparkles } from "lucide-react";
import { Label } from "@/frontend/components/ui/label";
import { Slider } from "@/frontend/components/ui/slider";
import { Switch } from "@/frontend/components/ui/switch";
import { Separator } from "@/frontend/components/ui/separator";
import { Badge } from "@/frontend/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { SectionCard, Money } from "@/frontend/components/shared/bits";
import { TARIFFS } from "@/frontend/lib/mock";
import { formatDuration, formatMoney } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";

/**
 * The quote preview. This mirrors what `tariff.service.ts` does server-side —
 * it exists so an officer can see the effect of a rule change before publishing,
 * never so a client computes a real fare.
 */
const PUBLISHED = TARIFFS.filter((t) => t.isPublished);

/** Pure fare computation — mirrors tariff.service.ts. Memoised by the compiler. */
function computeQuote(
  tariff: (typeof PUBLISHED)[number],
  minutes: number,
  peak: boolean,
  weekend: boolean,
  holiday: boolean,
  hasPass: boolean,
) {
  const chargeable = Math.max(0, minutes - tariff.gracePeriodMin);
  if (chargeable === 0) {
    return { lines: [{ label: "Within grace period", amount: 0 }], gross: 0, tax: 0, total: 0 };
  }

  const baseCharge = tariff.baseAmount;
  const extra = Math.max(0, chargeable - tariff.baseMinutes);
  const blocks = Math.ceil(extra / tariff.incrementMinutes);
  const increment = blocks * tariff.incrementAmount;

  const lines: { label: string; amount: number }[] = [
    { label: `Base — first ${formatDuration(tariff.baseMinutes)}`, amount: baseCharge },
  ];
  if (blocks > 0) {
    lines.push({
      label: `${blocks} × ${formatDuration(tariff.incrementMinutes)} block`,
      amount: increment,
    });
  }

  let subtotal = baseCharge + increment;

  if (peak) {
    const uplift = Math.round(subtotal * 0.5);
    lines.push({ label: "Peak hour uplift (×1.5)", amount: uplift });
    subtotal += uplift;
  }
  if (weekend) {
    const uplift = Math.round(subtotal * 0.25);
    lines.push({ label: "Weekend uplift (×1.25)", amount: uplift });
    subtotal += uplift;
  }
  if (holiday) {
    const uplift = Math.round(subtotal * 0.4);
    lines.push({ label: "Public holiday uplift (×1.4)", amount: uplift });
    subtotal += uplift;
  }

  if (tariff.dailyCapAmount && subtotal > tariff.dailyCapAmount) {
    lines.push({ label: "Daily cap applied", amount: tariff.dailyCapAmount - subtotal });
    subtotal = tariff.dailyCapAmount;
  }

  if (hasPass) {
    lines.push({ label: "Monthly pass — charge waived", amount: -subtotal });
    subtotal = 0;
  }

  const tax = Math.round((subtotal * tariff.taxPercent) / 100);
  return { lines, gross: subtotal, tax, total: subtotal + tax };
}

export function QuoteCalculator() {
  const published = PUBLISHED;
  const [tariffId, setTariffId] = React.useState(published[0].id);
  const [minutes, setMinutes] = React.useState(150);
  const [peak, setPeak] = React.useState(true);
  const [weekend, setWeekend] = React.useState(false);
  const [holiday, setHoliday] = React.useState(false);
  const [hasPass, setHasPass] = React.useState(false);

  const tariff = published.find((t) => t.id === tariffId)!;

  const quote = computeQuote(tariff, minutes, peak, weekend, holiday, hasPass);

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Calculator className="size-4" /> Quote preview
        </span>
      }
      description="Simulate a fare before publishing a tariff — same logic the server runs at exit"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------------- controls */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="quote-tariff">Tariff</Label>
            <Select value={tariffId} onValueChange={setTariffId}>
              <SelectTrigger id="quote-tariff">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {published.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {VEHICLE_TYPE_LABELS[tariff.vehicleType]} · {tariff.zoneName} · v{tariff.version}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label>Parking duration</Label>
              <span className="text-lg font-semibold tabular">{formatDuration(minutes)}</span>
            </div>
            <Slider value={[minutes]} onValueChange={([v]) => setMinutes(v)} min={5} max={1440} step={5} />
            <div className="flex justify-between text-xs text-muted-foreground tabular">
              <span>5m</span>
              <span>24h</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {[
              { id: "peak", label: "Peak hour", hint: "09:00–12:00 and 17:00–21:00 on weekdays", value: peak, set: setPeak },
              { id: "weekend", label: "Weekend", hint: "Saturday and Sunday", value: weekend, set: setWeekend },
              { id: "holiday", label: "Public holiday", hint: "From the holiday calendar", value: holiday, set: setHoliday },
              { id: "pass", label: "Monthly pass holder", hint: "Charge waived within pass scope", value: hasPass, set: setHasPass },
            ].map((toggle) => (
              <div key={toggle.id} className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor={`quote-${toggle.id}`} className="text-sm">
                    {toggle.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{toggle.hint}</p>
                </div>
                <Switch
                  id={`quote-${toggle.id}`}
                  checked={toggle.value}
                  onCheckedChange={toggle.set}
                />
              </div>
            ))}
          </div>
        </div>

        {/* -------------------------------------------------------- receipt */}
        <div className="space-y-3 rounded-xl border bg-muted/25 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fare breakdown
            </p>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Clock className="size-3" /> {formatDuration(minutes)}
            </Badge>
          </div>

          <dl className="space-y-1.5">
            {quote.lines.map((line, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className={line.amount < 0 ? "tabular text-emerald-600 dark:text-emerald-400" : "tabular"}>
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
                <Money value={quote.gross} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <dt className="text-muted-foreground">GST ({tariff.taxPercent}%)</dt>
              <dd>
                <Money value={quote.tax} />
              </dd>
            </div>
          </dl>

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Payable</span>
            <span className="text-2xl font-semibold tabular">{formatMoney(quote.total)}</span>
          </div>

          {tariff.gracePeriodMin > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 size-3 shrink-0" />
              First {tariff.gracePeriodMin} minutes are free under the grace period.
            </p>
          )}
          {tariff.dailyCapAmount && (
            <p className="text-xs text-muted-foreground">
              Daily cap: {formatMoney(tariff.dailyCapAmount)} before tax.
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
