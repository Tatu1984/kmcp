"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  BadgeIndianRupee,
  CalendarDays,
  Copy,
  Eye,
  FileCheck2,
  Layers,
  Pencil,
  Percent,
  Plus,
  Rocket,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Switch } from "@/frontend/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable, facetOptionsFrom } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Can } from "@/frontend/components/shared/can";
import { Money, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { TariffFormSheet } from "./tariff-form-sheet";
import { QuoteCalculator } from "./quote-calculator";
import { TARIFFS, HOLIDAYS, DISCOUNTS, ZONES } from "@/frontend/lib/mock";
import { tariffsApi, listAll, type ApiDiscount, type ApiHoliday } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { isLiveApi } from "@/config/env";
import { toTariff } from "@/frontend/lib/adapters";
import { formatDate, formatDuration } from "@/shared/utils/common.util";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import type { Tariff } from "@/shared/types/domain.types";

/** The form edits the rendered shape; the API takes its own field names. */
function toTariffPayload(draft: Partial<Tariff>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== "") payload[key] = value;
  };
  put("name", draft.name);
  put("zoneId", draft.zoneId);
  // `vehicleType`, not `vehicleTypeId`. The API takes the SlotType enum here,
  // and sending the wrong key meant a required field was simply absent — so
  // every attempt to draft or edit a tariff was rejected, and the message said
  // only that some fields needed attention.
  put("vehicleType", draft.vehicleType);
  put("baseAmount", draft.baseAmount);
  put("baseMinutes", draft.baseMinutes);
  put("incrementAmount", draft.incrementAmount);
  put("incrementMinutes", draft.incrementMinutes);
  put("dailyCapAmount", draft.dailyCapAmount);
  put("gracePeriodMin", draft.gracePeriodMin);
  put("overstayPenalty", draft.overstayPenalty);
  put("taxPercent", draft.taxPercent);
  put("effectiveFrom", draft.effectiveFrom);
  put("effectiveTo", draft.effectiveTo);
  return payload;
}

/**
 * A holiday and a discount as these two tabs render them.
 *
 * Narrower than the API shapes on purpose: the calendar row shows a date, a
 * name and a multiplier, and the demo dataset happens to carry exactly that.
 * One type for both sources is what lets the tabs work identically with and
 * without a backend.
 */
type HolidayRow = {
  id: string;
  date: string;
  name: string;
  isEvent: boolean;
  multiplier: number;
};

type DiscountRow = {
  id: string;
  name: string;
  code?: string;
  percentOff?: number;
  flatOff?: number;
  validTo: string;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
};

/**
 * A Prisma `Decimal` arrives as a string, not a number — deliberately, so a
 * rate is not rounded on the way through JSON. Coerce it once, at the edge.
 */
function decimal(value: number | string | null | undefined, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
}

const toHolidayRow = (holiday: ApiHoliday): HolidayRow => ({
  id: holiday.id,
  date: holiday.date,
  name: holiday.name,
  isEvent: holiday.isEvent,
  // No multiplier means the date is marked but priced normally.
  multiplier: decimal(holiday.multiplier, 1),
});

const toDiscountRow = (discount: ApiDiscount): DiscountRow => ({
  id: discount.id,
  name: discount.name,
  code: discount.code ?? undefined,
  percentOff: discount.percentOff == null ? undefined : decimal(discount.percentOff, 0),
  flatOff: discount.flatOff ?? undefined,
  validTo: discount.validTo,
  maxUses: discount.maxUses ?? undefined,
  usedCount: discount.usedCount,
  isActive: discount.isActive,
});

const EMPTY_HOLIDAY = { name: "", date: "", isEvent: false, multiplier: "1.4" };

/** Rupees in the form, paise past it — the same convention as the plan editor. */
const EMPTY_DISCOUNT = {
  name: "",
  code: "",
  kind: "percent" as "percent" | "flat",
  amount: "10",
  validFrom: "",
  validTo: "",
  maxUses: "",
};

export function TariffsView() {
  const {
    items: tariffs,
    isLoading,
    isRefreshing,
    emptyReason,
    apply,
    refresh,
  } = useResource<Tariff>(
    ["tariffs", "list"],
    () => listAll((page, pageSize) => tariffsApi.list({ page, pageSize })).then((r) => r.map(toTariff)),
    TARIFFS,
  );

  /**
   * The calendar and the discount book, read from the API.
   *
   * Both tabs used to render the bundled demo arrays unconditionally, so a live
   * deployment showed six festival dates it had never been told about and hid
   * every one it had. `GET /holidays` and `GET /discounts` have existed all
   * along; nothing was ever asking them.
   */
  const {
    items: holidays,
    isLoading: holidaysLoading,
    emptyReason: holidaysEmpty,
    apply: applyHoliday,
  } = useResource<HolidayRow>(
    ["tariffs", "holidays"],
    () => tariffsApi.holidays().then((r) => r.data.map(toHolidayRow)),
    HOLIDAYS,
  );

  const {
    items: discounts,
    isLoading: discountsLoading,
    emptyReason: discountsEmpty,
    apply: applyDiscount,
  } = useResource<DiscountRow>(
    ["tariffs", "discounts"],
    () => tariffsApi.discounts().then((r) => r.data.map(toDiscountRow)),
    DISCOUNTS,
  );

  const [selected, setSelected] = React.useState<Tariff | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [holidayOpen, setHolidayOpen] = React.useState(false);
  const [holidayForm, setHolidayForm] = React.useState(EMPTY_HOLIDAY);
  const [discountOpen, setDiscountOpen] = React.useState(false);
  const [discountForm, setDiscountForm] = React.useState(EMPTY_DISCOUNT);

  const canAddHoliday = holidayForm.name.trim().length >= 2 && Boolean(holidayForm.date);
  const canAddDiscount =
    discountForm.name.trim().length >= 2 &&
    Number(discountForm.amount) > 0 &&
    Boolean(discountForm.validFrom) &&
    Boolean(discountForm.validTo) &&
    discountForm.validFrom <= discountForm.validTo;

  const columns = React.useMemo<ColumnDef<Tariff, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Tariff",
        meta: "Tariff",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{row.original.name}</span>
              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                v{row.original.version}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {VEHICLE_TYPE_LABELS[row.original.vehicleType]} · {row.original.zoneName}
            </p>
          </div>
        ),
      },
      {
        id: "published",
        accessorFn: (t) => (t.isPublished ? "Published" : "Draft"),
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.isPublished ? "APPROVED" : "DRAFT"}
            label={row.original.isPublished ? "Published" : "Draft"}
            pulse={row.original.isPublished}
          />
        ),
      },
      {
        id: "rate",
        accessorFn: (t) => t.baseAmount,
        header: "Rate",
        meta: "Rate",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-sm tabular">
              <Money value={row.original.baseAmount} /> / {formatDuration(row.original.baseMinutes)}
            </p>
            <p className="text-[11px] text-muted-foreground tabular">
              then {row.original.incrementAmount / 100} / {formatDuration(row.original.incrementMinutes)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "dailyCapAmount",
        header: "Daily cap",
        meta: "Daily cap",
        cell: ({ row }) => <Money value={row.original.dailyCapAmount} />,
      },
      {
        accessorKey: "gracePeriodMin",
        header: "Grace",
        meta: "Grace period",
        cell: ({ row }) => (
          <span className="text-sm tabular">{row.original.gracePeriodMin} min</span>
        ),
      },
      {
        id: "rules",
        accessorFn: (t) => t.rules.filter((r) => r.isActive).length,
        header: "Rules",
        meta: "Rules",
        cell: ({ row }) => (
          <Badge variant="secondary" className="tabular">
            {row.original.rules.filter((r) => r.isActive).length} active
          </Badge>
        ),
      },
      {
        accessorKey: "effectiveFrom",
        header: "Effective",
        meta: "Effective from",
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.effectiveFrom)}
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const tariff = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={tariff.name}
                actions={[
                  {
                    label: "View rules",
                    icon: Eye,
                    onSelect: () => {
                      setSelected(tariff);
                      setFormOpen(true);
                    },
                  },
                  {
                    label: tariff.isPublished ? "Edit as new draft" : "Edit draft",
                    icon: Pencil,
                    // Editing a published version forks a new draft, so both
                    // branches land on `POST`/`PATCH /tariffs` — tariff.write.
                    permission: "tariff.write",
                    onSelect: () => {
                      setSelected(tariff);
                      setFormOpen(true);
                    },
                  },
                  {
                    label: "Duplicate",
                    icon: Copy,
                    permission: "tariff.write",
                    onSelect: () => {
                      void apply(
                        () => tariffsApi.duplicate(tariff.id),
                        (list) => [
                        {
                          ...tariff,
                          id: `trf_copy_${list.length}`,
                          name: `${tariff.name} (copy)`,
                          isPublished: false,
                          version: tariff.version + 1,
                          },
                          ...list,
                        ],
                        {
                          success: "Tariff duplicated",
                          description: "Saved as an unpublished draft.",
                        },
                      ).catch(() => undefined);
                    },
                  },
                  {
                    /**
                     * The distinction the whole pricing module turns on:
                     * drafting a rate card is `tariff.write`, making it the
                     * live fare at the kerb is `tariff.publish`. An officer who
                     * may write a draft is deliberately not the one who signs
                     * it off, and this menu now says so before the click.
                     */
                    label: "Publish",
                    icon: Rocket,
                    permission: "tariff.publish",
                    hidden: tariff.isPublished,
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(tariff);
                      setPublishOpen(true);
                    },
                  },
                  {
                    // Archiving closes the effective window rather than
                    // deleting anything, which is why the API guards it with
                    // tariff.write and not tariff.publish.
                    label: "Archive version",
                    icon: Archive,
                    permission: "tariff.write",
                    destructive: true,
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(tariff);
                      setArchiveOpen(true);
                    },
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [apply],
  );

  const published = tariffs.filter((t) => t.isPublished).length;
  const drafts = tariffs.filter((t) => !t.isPublished).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tariffs and pricing"
        description="Government-approved rate cards. A published version is never edited — changes create a new version so any historic session can still be re-priced exactly."
        actions={
          <Can permission="tariff.write">
            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                setSelected(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Draft tariff
            </Button>
          </Can>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Published tariffs" numeric={published} icon={FileCheck2} accent="success" hint="Live and enforceable at the kerb" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Drafts" numeric={drafts} icon={Pencil} accent="warning" hint="Awaiting approval to publish" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Active discounts" numeric={discounts.filter((d) => d.isActive).length} icon={Percent} accent="info" hint={`${discounts.reduce((s, d) => s + d.usedCount, 0).toLocaleString("en-IN")} redemptions`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Holidays & events" numeric={holidays.length} icon={CalendarDays} hint="Dates with a pricing multiplier" />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="tariffs">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="tariffs">Rate cards</TabsTrigger>
          <TabsTrigger value="preview">Quote preview</TabsTrigger>
          <TabsTrigger value="holidays">Holidays &amp; events</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="tariffs" className="mt-4">
          <DataTable
            data={tariffs}
            columns={columns}
            searchKeys={["name", "zoneName"]}
            searchPlaceholder="Search tariff or zone…"
            facets={[
              {
                columnId: "published",
                label: "Status",
                options: [
                  { value: "Published", label: "Published" },
                  { value: "Draft", label: "Draft" },
                ],
              },
              {
                columnId: "zoneName",
                label: "Zone",
                /**
                 * The zones these rate cards are actually written for. The
                 * demo roster names zones a live deployment has no tariff in,
                 * so every option it offers empties the table. "All zones" is
                 * the city-wide sentinel `toTariff` puts on an unzoned tariff
                 * rather than a zone name, so it is listed once by hand and
                 * dropped from what the rows contribute.
                 */
                options: [
                  { value: "All zones", label: "City-wide" },
                  ...(isLiveApi
                    ? facetOptionsFrom(tariffs, (t) =>
                        t.zoneName === "All zones" ? undefined : t.zoneName,
                      )
                    : ZONES.map((z) => ({ value: z.name, label: z.name }))),
                ],
              },
            ]}
            onRefresh={() => {
              if (!isLiveApi) {
                toast.info("Demo data", {
                  description: "This screen reads from the bundled demo dataset — there is nothing new to fetch.",
                });
                return;
              }
              void refresh();
            }}
            isRefreshing={isRefreshing}
            onRowClick={(tariff) => {
              setSelected(tariff);
              setFormOpen(true);
            }}
            onExport={(rows) => toast.success("Export queued", { description: `${rows.length} tariffs` })}
            isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No tariffs configured"}
            emptyDescription={emptyReason ?? "Draft a rate card so attendants can start charging for parking."}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <QuoteCalculator />
        </TabsContent>

        {/* ------------------------------------------------------- holidays */}
        <TabsContent value="holidays" className="mt-4">
          <SectionCard
            title="Holiday and event calendar"
            description="Dates that trigger a holiday or event pricing rule"
            contentClassName="p-0"
            action={
              /* The calendar sits behind `discount.write`, not `tariff.write`.
                 It is priced as a concession rather than as a rate card, and
                 the API guards `POST /holidays` accordingly. */
              <Can permission="discount.write">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setHolidayForm(EMPTY_HOLIDAY);
                    setHolidayOpen(true);
                  }}
                >
                  <Plus className="size-3.5" /> Add date
                </Button>
              </Can>
            }
          >
            {holidays.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground text-pretty">
                {holidaysLoading
                  ? "Loading the calendar…"
                  : (holidaysEmpty ??
                    "No dates in the calendar. Sessions on every date are priced at the standard rate.")}
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {holidays.map((holiday) => (
                  <li key={holiday.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-center">
                      <CalendarDays className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(holiday.date)}</p>
                    </div>
                    {holiday.isEvent && <Badge variant="secondary">Event</Badge>}
                    <Badge variant="outline" className="tabular">
                      ×{holiday.multiplier}
                    </Badge>
                    <RowActions
                      label={holiday.name}
                      /**
                       * There is no "edit" here, because there is no
                       * `PATCH /holidays/:id` — the calendar is a set of dates,
                       * and correcting one is removing it and adding it back.
                       * A menu item that pretended otherwise would have to fake
                       * the write or silently delete-and-recreate, losing the
                       * row if the second call failed.
                       */
                      actions={[
                        {
                          label: "Remove",
                          icon: Archive,
                          destructive: true,
                          permission: "discount.write",
                          onSelect: () => {
                            void applyHoliday(
                              () => tariffsApi.removeHoliday(holiday.id),
                              (list) => list.filter((h) => h.id !== holiday.id),
                              { success: "Date removed", description: holiday.name },
                            ).catch(() => undefined);
                          },
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------ discounts */}
        <TabsContent value="discounts" className="mt-4">
          <SectionCard
            title="Discount rules"
            description="Applied after the tariff and before tax"
            contentClassName="p-0"
            action={
              <Can permission="discount.write">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setDiscountForm(EMPTY_DISCOUNT);
                    setDiscountOpen(true);
                  }}
                >
                  <Plus className="size-3.5" /> New discount
                </Button>
              </Can>
            }
          >
            {discounts.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground text-pretty">
                {discountsLoading
                  ? "Loading discount rules…"
                  : (discountsEmpty ?? "No discount rules. Every session is charged at the full fare.")}
              </p>
            )}
            <ul className="divide-y divide-border/60">
              {discounts.map((discount) => (
                <li key={discount.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Tag className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{discount.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {discount.code ? (
                        <span className="font-mono">{discount.code}</span>
                      ) : (
                        "Automatic"
                      )}{" "}
                      · valid to {formatDate(discount.validTo)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="tabular">
                    {discount.percentOff ? `${discount.percentOff}% off` : `₹${(discount.flatOff ?? 0) / 100} off`}
                  </Badge>
                  <div className="text-right">
                    <p className="text-sm tabular">{discount.usedCount.toLocaleString("en-IN")}</p>
                    <p className="text-[11px] text-muted-foreground">
                      of {discount.maxUses ? discount.maxUses.toLocaleString("en-IN") : "∞"}
                    </p>
                  </div>
                  <StatusBadge
                    status={discount.isActive ? "ACTIVE" : "INACTIVE"}
                    label={discount.isActive ? "Active" : "Paused"}
                  />
                  <RowActions
                    label={discount.name}
                    /**
                     * Pause and resume are the whole menu, because they are the
                     * whole endpoint: `PATCH /discounts/:id` accepts `isActive`
                     * and nothing else. "Edit discount" and "End discount" used
                     * to sit here and only toast — there is no route that
                     * rewrites a rule's terms or closes its window early, and a
                     * disabled item saying so is more honest than one that
                     * quietly did neither.
                     */
                    actions={[
                      {
                        label: discount.isActive ? "Pause" : "Resume",
                        icon: Layers,
                        permission: "discount.write",
                        onSelect: () => {
                          void applyDiscount(
                            () => tariffsApi.setDiscountActive(discount.id, !discount.isActive),
                            (list) =>
                              list.map((d) =>
                                d.id === discount.id ? { ...d, isActive: !d.isActive } : d,
                              ),
                            {
                              success: discount.isActive ? "Discount paused" : "Discount resumed",
                              description: discount.name,
                            },
                          ).catch(() => undefined);
                        },
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <TariffFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        tariff={selected}
        onSaved={(draft) =>
          apply(
            () =>
              // A published version is never edited in place — the API forks a
              // new draft, which is what keeps a historic session re-priceable.
              selected && !selected.isPublished
                ? tariffsApi.update(selected.id, toTariffPayload(draft))
                : tariffsApi.create(toTariffPayload(draft)),
            (list) =>
              selected && !selected.isPublished
                ? list.map((t) => (t.id === selected.id ? ({ ...t, ...draft } as Tariff) : t))
                : [
                    {
                      ...(draft as Tariff),
                      id: `trf_new_${list.length}`,
                      // Only ever built in demo mode — `apply` runs this branch
                      // when there is no backend and refetches otherwise — so
                      // the demo roster is the right place to name the zone.
                      zoneName: draft.zoneId
                        ? (ZONES.find((z) => z.id === draft.zoneId)?.name ?? "—")
                        : "All zones",
                      isPublished: false,
                      version: (selected?.version ?? 0) + 1,
                      createdAt: new Date().toISOString(),
                    },
                    ...list,
                  ],
            {
              success: selected && !selected.isPublished ? "Tariff updated" : "Draft created",
              description: draft.name,
            },
          )
        }
      />

      {/* ------------------------------------------------------- add a date */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a date to the calendar</DialogTitle>
            <DialogDescription>
              Rate cards carrying a holiday or event rule apply their multiplier on this date. A
              card without one is unaffected.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="holiday-name">Name</Label>
              <Input
                id="holiday-name"
                placeholder="Durga Puja — Ashtami"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holiday-multiplier">Multiplier</Label>
              <Input
                id="holiday-multiplier"
                type="number"
                step="0.1"
                min={0}
                max={10}
                value={holidayForm.multiplier}
                onChange={(e) => setHolidayForm({ ...holidayForm, multiplier: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">1.0 charges the normal fare.</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
              <div className="space-y-0.5">
                <Label htmlFor="holiday-event" className="text-sm">
                  This is an event, not a public holiday
                </Label>
                <p className="text-xs text-muted-foreground">
                  Events are usually a festival or a match, and are priced separately from
                  gazetted holidays.
                </p>
              </div>
              <Switch
                id="holiday-event"
                checked={holidayForm.isEvent}
                onCheckedChange={(v) => setHolidayForm({ ...holidayForm, isEvent: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canAddHoliday}
              onClick={() => {
                const multiplier = Number(holidayForm.multiplier);
                void applyHoliday(
                  () =>
                    tariffsApi.createHoliday({
                      name: holidayForm.name.trim(),
                      date: holidayForm.date,
                      isEvent: holidayForm.isEvent,
                      multiplier,
                    }),
                  (list) =>
                    [
                      ...list,
                      {
                        id: `hol_new_${list.length}`,
                        name: holidayForm.name.trim(),
                        date: holidayForm.date,
                        isEvent: holidayForm.isEvent,
                        multiplier,
                      },
                    ].sort((a, b) => a.date.localeCompare(b.date)),
                  { success: "Date added", description: holidayForm.name.trim() },
                )
                  .then(() => {
                    setHolidayOpen(false);
                    setHolidayForm(EMPTY_HOLIDAY);
                  })
                  .catch(() => undefined);
              }}
            >
              Add date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- new discount */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a discount rule</DialogTitle>
            <DialogDescription>
              Applied after the tariff and before tax. A rule with a code is redeemed by the citizen;
              one without applies automatically to every session it matches.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="discount-name">Name</Label>
              <Input
                id="discount-name"
                placeholder="EV concession"
                value={discountForm.name}
                onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="discount-code">Code (optional)</Label>
              <Input
                id="discount-code"
                placeholder="WELCOME"
                className="font-mono"
                value={discountForm.code}
                onChange={(e) =>
                  setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave it empty and the concession applies without anyone having to know about it.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount-kind">Type</Label>
              <Select
                value={discountForm.kind}
                onValueChange={(v) =>
                  setDiscountForm({ ...discountForm, kind: v as typeof discountForm.kind })
                }
              >
                <SelectTrigger id="discount-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage off</SelectItem>
                  <SelectItem value="flat">Flat amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount-amount">
                {discountForm.kind === "percent" ? "Percent off" : "Amount off (₹)"}
              </Label>
              <Input
                id="discount-amount"
                type="number"
                min={0}
                max={discountForm.kind === "percent" ? 100 : undefined}
                value={discountForm.amount}
                onChange={(e) => setDiscountForm({ ...discountForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount-from">Valid from</Label>
              <Input
                id="discount-from"
                type="date"
                value={discountForm.validFrom}
                onChange={(e) => setDiscountForm({ ...discountForm, validFrom: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount-to">Valid to</Label>
              <Input
                id="discount-to"
                type="date"
                value={discountForm.validTo}
                onChange={(e) => setDiscountForm({ ...discountForm, validTo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="discount-max">Maximum redemptions (optional)</Label>
              <Input
                id="discount-max"
                type="number"
                min={1}
                placeholder="Unlimited"
                value={discountForm.maxUses}
                onChange={(e) => setDiscountForm({ ...discountForm, maxUses: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canAddDiscount}
              onClick={() => {
                const amount = Number(discountForm.amount);
                // The form is in rupees because a concession is written in
                // rupees; the API, like everything past this line, is in paise.
                const percentOff = discountForm.kind === "percent" ? amount : undefined;
                const flatOff = discountForm.kind === "flat" ? Math.round(amount * 100) : undefined;
                const code = discountForm.code.trim() || undefined;
                void applyDiscount(
                  () =>
                    tariffsApi.createDiscount({
                      name: discountForm.name.trim(),
                      code,
                      percentOff,
                      flatOff,
                      validFrom: discountForm.validFrom,
                      validTo: discountForm.validTo,
                      maxUses: discountForm.maxUses ? Number(discountForm.maxUses) : undefined,
                    }),
                  (list) => [
                    {
                      id: `dsc_new_${list.length}`,
                      name: discountForm.name.trim(),
                      code,
                      percentOff,
                      flatOff,
                      validTo: discountForm.validTo,
                      maxUses: discountForm.maxUses ? Number(discountForm.maxUses) : undefined,
                      usedCount: 0,
                      isActive: true,
                    },
                    ...list,
                  ],
                  { success: "Discount created", description: discountForm.name.trim() },
                )
                  .then(() => {
                    setDiscountOpen(false);
                    setDiscountForm(EMPTY_DISCOUNT);
                  })
                  .catch(() => undefined);
              }}
            >
              Create discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={`Publish ${selected?.name}?`}
        confirmLabel="Publish tariff"
        typeToConfirm="PUBLISH"
        reason={{ label: "Approval reference", placeholder: "Board resolution 2026/14 dated 28 July 2026", required: true }}
        description={
          <div className="space-y-2">
            <p>
              Publishing makes this the live rate at the kerb from its effective date. Every attendant
              and citizen app picks it up on the next request — no app release is needed.
            </p>
            <p className="font-medium">
              A published version can never be edited. Changes create a new version, so any historic
              session can still be re-priced exactly as it was charged.
            </p>
          </div>
        }
        onConfirm={async (reason) => {
          if (!selected) return;
          await apply(
            () => tariffsApi.publish(selected.id, reason ?? "Approved from the portal"),
            (list) => list.map((t) => (t.id === selected.id ? { ...t, isPublished: true } : t)),
            { success: "Tariff published", description: `${selected.name} · approval ${reason}` },
          );
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${selected?.name}?`}
        destructive
        confirmLabel="Archive version"
        reason={{ label: "Why is this version being archived?", required: true }}
        description="Archiving stops the version being applied to new sessions. It stays on file so historic charges remain explainable."
        onConfirm={async (reason) => {
          if (!selected) return;
          await apply(
            () => tariffsApi.archive(selected.id, reason ?? "Archived from the portal"),
            (list) => list.filter((t) => t.id !== selected.id),
            { success: "Version archived", description: selected.name },
          );
        }}
      />

      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground">
        <BadgeIndianRupee className="mt-0.5 size-4 shrink-0" />
        <p className="text-pretty">
          Fares are computed only in <span className="font-mono">tariff.service.ts</span> on the
          server. No tariff table is ever shipped to a mobile device, which is why a rate change takes
          effect immediately and identically for the vendor app, the citizen app and this portal.
        </p>
      </div>
    </div>
  );
}
