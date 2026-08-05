"use client";

import * as React from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { ZONES } from "@/frontend/lib/mock";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import { formatMoney, titleCase } from "@/shared/utils/common.util";
import type { Tariff, TariffRule, TariffRuleType, DayType } from "@/shared/types/domain.types";

const RULE_TYPES: TariffRuleType[] = [
  "PEAK_HOUR",
  "WEEKEND",
  "HOLIDAY",
  "EVENT",
  "NIGHT",
  "VIP",
  "COMMERCIAL",
  "SUBSCRIBER",
];

const DAY_TYPES: DayType[] = ["ALL", "WEEKDAY", "WEEKEND", "HOLIDAY"];

export function TariffFormSheet({
  open,
  onOpenChange,
  tariff,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tariff?: Tariff | null;
  onSaved?: (draft: Partial<Tariff>) => void;
}) {
  const editing = Boolean(tariff);
  const locked = Boolean(tariff?.isPublished);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(() => defaults(tariff));
  const [rules, setRules] = React.useState<TariffRule[]>(tariff?.rules ?? []);

  const openKey = open ? (tariff?.id ?? "new") : "closed";
  const [lastKey, setLastKey] = React.useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    setForm(defaults(tariff));
    setRules(tariff?.rules ?? []);
  }

  const addRule = () =>
    setRules((list) => [
      ...list,
      {
        id: `rul_new_${list.length}`,
        type: "PEAK_HOUR",
        dayType: "WEEKDAY",
        timeFrom: "09:00",
        timeTo: "12:00",
        multiplier: 1.5,
        isActive: true,
      },
    ]);

  const updateRule = (id: string, patch: Partial<TariffRule>) =>
    setRules((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function save() {
    if (!form.name.trim()) {
      toast.error("Give the tariff a name officers will recognise");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onOpenChange(false);
    onSaved?.({ ...form, rules } as Partial<Tariff>);
    toast.success(editing ? "Tariff saved as a new draft" : "Tariff drafted", {
      description: "Publish it when the approval is on file — a published version is never edited.",
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${tariff?.name}` : "Draft a tariff"}</SheetTitle>
          <SheetDescription>
            {locked
              ? "This version is published, so editing creates a new draft version. The published one stays untouched for audit."
              : "Rates are stored in paise and applied server-side. Nothing here ever reaches the attendant's device."}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="rates" className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="rates" className="flex-1">
              Rates
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex-1">
              Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="scope" className="flex-1">
              Scope
            </TabsTrigger>
          </TabsList>

          {/* --------------------------------------------------------- rates */}
          <TabsContent value="rates" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tariff-name">Tariff name</Label>
              <Input
                id="tariff-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="City Standard — Car"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="base-amount">Base rate (₹)</Label>
                <Input
                  id="base-amount"
                  type="number"
                  value={form.baseAmount / 100}
                  onChange={(e) => setForm({ ...form, baseAmount: Number(e.target.value) * 100 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="base-minutes">covers first (minutes)</Label>
                <Input
                  id="base-minutes"
                  type="number"
                  value={form.baseMinutes}
                  onChange={(e) => setForm({ ...form, baseMinutes: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inc-amount">Then (₹) per block</Label>
                <Input
                  id="inc-amount"
                  type="number"
                  value={form.incrementAmount / 100}
                  onChange={(e) => setForm({ ...form, incrementAmount: Number(e.target.value) * 100 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inc-minutes">Block size (minutes)</Label>
                <Input
                  id="inc-minutes"
                  type="number"
                  value={form.incrementMinutes}
                  onChange={(e) => setForm({ ...form, incrementMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/25 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">A 3-hour stay costs</p>
              <p className="mt-1 text-lg font-semibold tabular">
                {formatMoney(
                  form.baseAmount +
                    Math.ceil(Math.max(0, 180 - form.baseMinutes) / form.incrementMinutes) *
                      form.incrementAmount,
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Before rules, cap and tax.</p>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="daily-cap">Daily cap (₹)</Label>
                <Input
                  id="daily-cap"
                  type="number"
                  value={(form.dailyCapAmount ?? 0) / 100}
                  onChange={(e) => setForm({ ...form, dailyCapAmount: Number(e.target.value) * 100 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grace">Grace period (minutes)</Label>
                <Input
                  id="grace"
                  type="number"
                  value={form.gracePeriodMin}
                  onChange={(e) => setForm({ ...form, gracePeriodMin: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="penalty">Overstay penalty (₹)</Label>
                <Input
                  id="penalty"
                  type="number"
                  value={(form.overstayPenalty ?? 0) / 100}
                  onChange={(e) => setForm({ ...form, overstayPenalty: Number(e.target.value) * 100 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax">GST (%)</Label>
                <Input
                  id="tax"
                  type="number"
                  value={form.taxPercent}
                  onChange={(e) => setForm({ ...form, taxPercent: Number(e.target.value) })}
                />
              </div>
            </div>
          </TabsContent>

          {/* --------------------------------------------------------- rules */}
          <TabsContent value="rules" className="mt-4 space-y-3">
            {rules.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No modifiers yet. Add a rule for peak hours, weekends, holidays or events.
              </p>
            )}

            {rules.map((rule) => (
              <div key={rule.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{titleCase(rule.type)}</Badge>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(v) => updateRule(rule.id, { isActive: v })}
                      aria-label="Rule active"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => setRules((list) => list.filter((r) => r.id !== rule.id))}
                      aria-label="Remove rule"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rule type</Label>
                    <Select
                      value={rule.type}
                      onValueChange={(v) => updateRule(rule.id, { type: v as TariffRuleType })}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {titleCase(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Applies on</Label>
                    <Select
                      value={rule.dayType}
                      onValueChange={(v) => updateRule(rule.id, { dayType: v as DayType })}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_TYPES.map((d) => (
                          <SelectItem key={d} value={d}>
                            {titleCase(d)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="time"
                      value={rule.timeFrom ?? ""}
                      onChange={(e) => updateRule(rule.id, { timeFrom: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="time"
                      value={rule.timeTo ?? ""}
                      onChange={(e) => updateRule(rule.id, { timeTo: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Multiplier</Label>
                    <Input
                      type="number"
                      step={0.05}
                      value={rule.multiplier ?? 1}
                      onChange={(e) => updateRule(rule.id, { multiplier: Number(e.target.value) })}
                      className="h-8"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      1.5 charges 150% of the computed fare. Use a value below 1 for a concession.
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={addRule}>
              <Plus className="size-4" /> Add rule
            </Button>

            <p className="text-xs text-muted-foreground text-pretty">
              Rules are applied in priority order and compound. A weekday peak plus a public holiday
              stacks — check the quote preview before publishing.
            </p>
          </TabsContent>

          {/* --------------------------------------------------------- scope */}
          <TabsContent value="scope" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tariff-vehicle">Vehicle type</Label>
              <Select
                value={form.vehicleType}
                onValueChange={(v) => setForm({ ...form, vehicleType: v as Tariff["vehicleType"] })}
              >
                <SelectTrigger id="tariff-vehicle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tariff-zone">Zone</Label>
              <Select
                value={form.zoneId ?? "__all"}
                onValueChange={(v) => setForm({ ...form, zoneId: v === "__all" ? undefined : v })}
              >
                <SelectTrigger id="tariff-zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All zones (city-wide)</SelectItem>
                  {ZONES.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} · {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A zone-specific tariff always wins over a city-wide one for the same vehicle type.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="effective-from">Effective from</Label>
              <Input
                id="effective-from"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Sessions started before this date are priced by the version that was live at the time.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {locked ? "Save as new draft" : editing ? "Save draft" : "Create draft"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function defaults(tariff?: Tariff | null) {
  return {
    name: tariff?.name ?? "",
    vehicleType: tariff?.vehicleType ?? ("CAR" as Tariff["vehicleType"]),
    zoneId: tariff?.zoneId,
    baseAmount: tariff?.baseAmount ?? 2000,
    baseMinutes: tariff?.baseMinutes ?? 60,
    incrementAmount: tariff?.incrementAmount ?? 1500,
    incrementMinutes: tariff?.incrementMinutes ?? 60,
    dailyCapAmount: tariff?.dailyCapAmount ?? 15000,
    gracePeriodMin: tariff?.gracePeriodMin ?? 10,
    overstayPenalty: tariff?.overstayPenalty ?? 5000,
    taxPercent: tariff?.taxPercent ?? 18,
    effectiveFrom: (tariff?.effectiveFrom ?? new Date().toISOString()).slice(0, 10),
  };
}
