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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Money, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { TariffFormSheet } from "./tariff-form-sheet";
import { QuoteCalculator } from "./quote-calculator";
import { TARIFFS, HOLIDAYS, DISCOUNTS, ZONES } from "@/frontend/lib/mock";
import { tariffsApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
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
  put("vehicleTypeId", draft.vehicleType);
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

export function TariffsView() {
  const {
    items: tariffs,
    isLoading,
    emptyReason,
    apply,
  } = useResource<Tariff>(
    ["tariffs", "list"],
    () => listAll((page, pageSize) => tariffsApi.list({ page, pageSize })).then((r) => r.map(toTariff)),
    TARIFFS,
  );
  const [selected, setSelected] = React.useState<Tariff | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

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
                    onSelect: () => {
                      setSelected(tariff);
                      setFormOpen(true);
                    },
                  },
                  {
                    label: "Duplicate",
                    icon: Copy,
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
                    label: "Publish",
                    icon: Rocket,
                    hidden: tariff.isPublished,
                    separatorBefore: true,
                    onSelect: () => {
                      setSelected(tariff);
                      setPublishOpen(true);
                    },
                  },
                  {
                    label: "Archive version",
                    icon: Archive,
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
          <StatCard label="Active discounts" numeric={DISCOUNTS.filter((d) => d.isActive).length} icon={Percent} accent="info" hint={`${DISCOUNTS.reduce((s, d) => s + d.usedCount, 0).toLocaleString("en-IN")} redemptions`} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Holidays & events" numeric={HOLIDAYS.length} icon={CalendarDays} hint="Dates with a pricing multiplier" />
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
                options: [
                  { value: "All zones", label: "City-wide" },
                  ...ZONES.map((z) => ({ value: z.name, label: z.name })),
                ],
              },
            ]}
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
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toast.info("Add a date", { description: "Pick a date and set its multiplier." })}
              >
                <Plus className="size-3.5" /> Add date
              </Button>
            }
          >
            <ul className="divide-y divide-border/60">
              {HOLIDAYS.map((holiday) => (
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
                    actions={[
                      { label: "Edit date", icon: Pencil, onSelect: () => toast.info("Editing", { description: holiday.name }) },
                      { label: "Remove", icon: Archive, destructive: true, onSelect: () => toast.success("Date removed", { description: holiday.name }) },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------ discounts */}
        <TabsContent value="discounts" className="mt-4">
          <SectionCard
            title="Discount rules"
            description="Applied after the tariff and before tax"
            contentClassName="p-0"
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toast.info("New discount", { description: "Set a percentage or a flat amount off." })}
              >
                <Plus className="size-3.5" /> New discount
              </Button>
            }
          >
            <ul className="divide-y divide-border/60">
              {DISCOUNTS.map((discount) => (
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
                    actions={[
                      { label: "Edit discount", icon: Pencil, onSelect: () => toast.info("Editing", { description: discount.name }) },
                      {
                        label: discount.isActive ? "Pause" : "Resume",
                        icon: Layers,
                        onSelect: () =>
                          toast.success(discount.isActive ? "Discount paused" : "Discount resumed", {
                            description: discount.name,
                          }),
                      },
                      { label: "End discount", icon: Archive, destructive: true, separatorBefore: true, onSelect: () => toast.success("Discount ended") },
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
