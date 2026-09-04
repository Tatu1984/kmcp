"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  Copy,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Separator } from "@/frontend/components/ui/separator";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/frontend/components/ui/radio-group";
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
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Can } from "@/frontend/components/shared/can";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { ZoneScopeBadge } from "@/frontend/components/shared/zone-scope";
import { SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem, SpotlightCard } from "@/frontend/components/reactbits";
import { REPORT_JOBS, REPORT_TYPES, SCHEDULED_REPORTS, ZONES, VENDORS } from "@/frontend/lib/mock";
import {
  reportsApi,
  reportSchedulesApi,
  zonesApi,
  vendorsApi,
  listAll,
  messagingApi,
  channelLabel,
  type MessageChannel,
} from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { useMessaging } from "@/frontend/hooks/use-messaging";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { isLiveApi } from "@/config/env";
import { toReportJob, toReportSchedule } from "@/frontend/lib/adapters";
import { relativeTime } from "@/shared/utils/common.util";
import { cn } from "@/lib/utils";
import type { ReportFrequency, ReportJob, ReportSchedule } from "@/shared/types/domain.types";

const FORMAT_ICON = { pdf: FileText, xlsx: FileSpreadsheet, csv: FileBarChart } as const;

/** Today and a month ago, as the date inputs want them. */
function isoDate(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/** Monday first, as an ISO weekday is numbered and as a working week is read. */
const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const DELIVERY_CHANNELS: MessageChannel[] = ["EMAIL", "SMS", "WHATSAPP"];

/**
 * The zone the schedule's hour is spoken in.
 *
 * Fixed here rather than offered as a picker. The API stores it per schedule so
 * a deployment elsewhere is not forced to do arithmetic in its head, but this
 * authority runs one city and a dropdown of four hundred IANA names would be a
 * question nobody in the office has an opinion about — while quietly making it
 * possible to set a schedule to a zone the officer does not live in.
 */
const SCHEDULE_TIMEZONE = "Asia/Kolkata";

/** The editable shape of a schedule, before it becomes a request body. */
interface ScheduleForm {
  name: string;
  type: string;
  frequency: ReportFrequency;
  hour: number;
  minute: number;
  weekday: number;
  dayOfMonth: number;
  zoneId: string;
  vendorId: string;
  channels: MessageChannel[];
}

const BLANK_SCHEDULE: ScheduleForm = {
  name: "",
  type: "revenue",
  frequency: "DAILY",
  hour: 6,
  minute: 0,
  weekday: 1,
  dayOfMonth: 1,
  zoneId: "__all",
  vendorId: "__all",
  channels: ["EMAIL"],
};

function formOf(schedule: ReportSchedule): ScheduleForm {
  return {
    name: schedule.name,
    type: schedule.type,
    frequency: schedule.frequency,
    hour: schedule.hour,
    minute: schedule.minute,
    weekday: schedule.weekday ?? 1,
    dayOfMonth: schedule.dayOfMonth ?? 1,
    zoneId: schedule.zoneId ?? "__all",
    vendorId: schedule.vendorId ?? "__all",
    channels: schedule.channels.filter((c): c is MessageChannel =>
      DELIVERY_CHANNELS.includes(c as MessageChannel),
    ),
  };
}

/** "06:00" — the value an `<input type="time">` wants. */
function clockOf(form: { hour: number; minute: number }): string {
  return `${String(form.hour).padStart(2, "0")}:${String(form.minute).padStart(2, "0")}`;
}

/**
 * The cadence in words, for the preview under the form and for demo mode.
 *
 * The API words this too, and its wording is what the list renders — this is
 * not a second source of truth for a saved row. It exists because an officer
 * choosing "monthly, day 31" deserves to read back what they have chosen before
 * they commit to it, and because the demo build has no API to ask.
 */
function describeCadence(form: ScheduleForm): string {
  const clock = clockOf(form);
  if (form.frequency === "DAILY") return `Every day at ${clock} (${SCHEDULE_TIMEZONE})`;
  if (form.frequency === "WEEKLY") {
    const day = WEEKDAYS.find((d) => d.value === form.weekday)?.label ?? "Monday";
    return `Every ${day} at ${clock} (${SCHEDULE_TIMEZONE})`;
  }
  return `On day ${form.dayOfMonth} of every month at ${clock} (${SCHEDULE_TIMEZONE})`;
}

/** What a run of this cadence covers — the API derives the same window. */
function describeWindow(frequency: ReportFrequency): string {
  if (frequency === "DAILY") return "Yesterday";
  if (frequency === "WEEKLY") return "The previous 7 days";
  return "The previous calendar month";
}

export function ReportsView() {
  const { isZoneScoped } = usePermissions();
  const { send } = useMessaging();

  const {
    items: jobs,
    isLoading,
    isRefreshing,
    isBusy,
    emptyReason,
    apply,
    refresh,
  } = useResource<ReportJob>(
    ["reports", "list"],
    () => reportsApi.list({ pageSize: 100 }).then((r) => r.data.map(toReportJob)),
    REPORT_JOBS,
  );

  // The catalogue is served by the API so the portal cannot offer a report the
  // backend has no code to run.
  const catalogue = useApiQuery(["reports", "types"], () =>
    reportsApi.types().then((r) => r.data),
  );
  const reportTypes = catalogue.data ?? REPORT_TYPES;

  const zones = useApiQuery(["zones", "for-reports"], () =>
    listAll((page, pageSize) => zonesApi.list({ page, pageSize })),
  );
  const vendors = useApiQuery(["vendors", "for-reports"], () =>
    listAll((page, pageSize) => vendorsApi.list({ page, pageSize })),
  );

  /**
   * The schedules, on the same footing as the job history: from the API when
   * there is one, from the bundled dataset when there is not. They were a
   * hard-coded array with every control disabled until the API grew a
   * `ReportSchedule` table, a runner behind the cron endpoint and delivery
   * through the messaging module.
   */
  const {
    items: schedules,
    isLoading: schedulesLoading,
    isBusy: schedulesBusy,
    emptyReason: schedulesEmptyReason,
    apply: applySchedule,
  } = useResource<ReportSchedule>(
    ["reports", "schedules"],
    () => reportSchedulesApi.list({ pageSize: 100 }).then((r) => r.data.map(toReportSchedule)),
    SCHEDULED_REPORTS,
  );

  /**
   * Which channels this deployment actually holds credentials for.
   *
   * Offering WhatsApp on a deployment with no WhatsApp account would let an
   * officer schedule a delivery that can only ever be recorded as failed —
   * every fortnight, silently, for as long as the schedule lives.
   */
  const messagingChannels = useApiQuery(["messaging", "channels"], () =>
    messagingApi.channels().then((r) => r.data.channels),
  );

  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState<string>(REPORT_TYPES[0].key);
  const [from, setFrom] = React.useState(() => isoDate(30));
  const [to, setTo] = React.useState(() => isoDate(0));
  const [zoneId, setZoneId] = React.useState("__all");
  const [vendorId, setVendorId] = React.useState("__all");

  /**
   * The pickers offer what the API served, and nothing when it has not answered.
   *
   * `GET /zones` is zone-scoped server-side, so this list *is* the officer's
   * allocation — no client-side filter against `zoneIds` is needed, and one
   * would be a weaker duplicate of the rule the query already applies. What was
   * wrong is the fallback: `?? ZONES` put the demo city's zones in front of a
   * live operator whenever the request was slow or refused, and picking one
   * sent an id the authority's database has never held.
   */
  const zoneOptions = isLiveApi ? (zones.data ?? []) : ZONES;
  const vendorOptions = isLiveApi ? (vendors.data ?? []) : VENDORS;

  /** Runs the report and downloads it once it has been produced. */
  const generate = () =>
    apply(
      async () => {
        const { data } = await reportsApi.generate({
          type: reportType,
          from: new Date(`${from}T00:00:00`).toISOString(),
          to: new Date(`${to}T23:59:59`).toISOString(),
          zoneId: zoneId === "__all" ? undefined : zoneId,
          vendorId: vendorId === "__all" ? undefined : vendorId,
        });
        await reportsApi.download(data.id);
      },
      (list) => [
        {
          id: `rpt_${list.length + 200}`,
          type: reportTypes.find((t) => t.key === reportType)?.label ?? reportType,
          paramsLabel: `${from} – ${to}`,
          status: "COMPLETED" as const,
          requestedBy: "You",
          format: "csv" as const,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        ...list,
      ],
      { success: "Report ready", description: "The file has been downloaded." },
    );

  // -------------------------------------------------------------- schedules

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ReportSchedule | null>(null);
  const [form, setForm] = React.useState<ScheduleForm>(BLANK_SCHEDULE);
  const [deleting, setDeleting] = React.useState<ReportSchedule | null>(null);

  const patch = (changes: Partial<ScheduleForm>) => setForm((current) => ({ ...current, ...changes }));

  const openNewSchedule = () => {
    setEditing(null);
    setForm({ ...BLANK_SCHEDULE, type: reportTypes[0]?.key ?? BLANK_SCHEDULE.type });
    setScheduleOpen(true);
  };

  const openEditSchedule = (schedule: ReportSchedule) => {
    setEditing(schedule);
    setForm(formOf(schedule));
    setScheduleOpen(true);
  };

  /**
   * There is no recipient field, and its absence is the design rather than an
   * unfinished form. A schedule runs as — and is delivered to — the account
   * that created it, so a list of addresses here would be an export path for a
   * spreadsheet of plate numbers, addressed by anyone who can reach this
   * screen. The same rule as "Email to me" on a finished job.
   */
  const scheduleBody = () => ({
    name: form.name.trim(),
    type: form.type,
    frequency: form.frequency,
    hour: form.hour,
    minute: form.minute,
    weekday: form.frequency === "WEEKLY" ? form.weekday : null,
    dayOfMonth: form.frequency === "MONTHLY" ? form.dayOfMonth : null,
    timezone: SCHEDULE_TIMEZONE,
    zoneId: form.zoneId === "__all" ? null : form.zoneId,
    vendorId: form.vendorId === "__all" ? null : form.vendorId,
    channels: form.channels,
  });

  /** The demo row a save produces, shaped exactly as the API's own would be. */
  const demoScheduleFrom = (existing?: ReportSchedule): ReportSchedule => {
    const zone = zoneOptions.find((z) => z.id === form.zoneId);
    const vendor = vendorOptions.find((v) => v.id === form.vendorId);
    return {
      id: existing?.id ?? `sch_${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      label: reportTypes.find((t) => t.key === form.type)?.label ?? form.type,
      frequency: form.frequency,
      hour: form.hour,
      minute: form.minute,
      weekday: form.frequency === "WEEKLY" ? form.weekday : null,
      dayOfMonth: form.frequency === "MONTHLY" ? form.dayOfMonth : null,
      timezone: SCHEDULE_TIMEZONE,
      cadence: describeCadence(form),
      zoneId: form.zoneId === "__all" ? null : form.zoneId,
      vendorId: form.vendorId === "__all" ? null : form.vendorId,
      paramsLabel: `${describeWindow(form.frequency)} · ${zone?.name ?? vendor?.orgName ?? "All zones"}`,
      channels: form.channels,
      ownerName: existing?.ownerName ?? "You",
      isActive: existing?.isActive ?? true,
      nextRunAt: existing?.nextRunAt ?? new Date(Date.now() + 86_400_000).toISOString(),
      lastRunAt: existing?.lastRunAt,
      lastStatus: existing?.lastStatus,
      failureCount: existing?.failureCount ?? 0,
      failuresBeforePause: existing?.failuresBeforePause ?? 3,
    };
  };

  const saveSchedule = () =>
    applySchedule(
      async () => {
        if (editing) await reportSchedulesApi.update(editing.id, scheduleBody());
        else await reportSchedulesApi.create(scheduleBody());
      },
      (list) =>
        editing
          ? list.map((s) => (s.id === editing.id ? demoScheduleFrom(editing) : s))
          : [demoScheduleFrom(), ...list],
      {
        success: editing ? "Schedule updated" : "Schedule created",
        description: describeCadence(form),
      },
    );

  /**
   * Pausing and resuming are one PATCH with `isActive`, which is what the API
   * offers — there is no separate verb, and inventing one in the client would
   * mean the next-run instant was recomputed in two places.
   */
  const setScheduleActive = (schedule: ReportSchedule, isActive: boolean) =>
    applySchedule(
      () => reportSchedulesApi.update(schedule.id, { isActive }),
      (list) =>
        list.map((s) =>
          s.id === schedule.id ? { ...s, isActive, failureCount: isActive ? 0 : s.failureCount } : s,
        ),
      {
        success: isActive ? "Schedule resumed" : "Schedule paused",
        description: schedule.name,
      },
    );

  const runScheduleNow = (schedule: ReportSchedule) =>
    applySchedule(
      () => reportSchedulesApi.runNow(schedule.id),
      (list) =>
        list.map((s) =>
          s.id === schedule.id
            ? { ...s, lastRunAt: new Date().toISOString(), lastStatus: "COMPLETED" as const, failureCount: 0 }
            : s,
        ),
      {
        success: "Report run",
        // Worth saying out loud: the run belongs to the schedule's owner, not to
        // whoever pressed the button, and that is where it was delivered.
        description: `${schedule.name} — sent to ${schedule.ownerName}. The next run is unchanged.`,
      },
    );

  const deleteSchedule = (schedule: ReportSchedule) =>
    applySchedule(
      () => reportSchedulesApi.remove(schedule.id),
      (list) => list.filter((s) => s.id !== schedule.id),
      {
        success: "Schedule deleted",
        description: "The reports it already produced are still in the history.",
      },
    );

  const columns = React.useMemo<ColumnDef<ReportJob, unknown>[]>(
    () => [
      {
        accessorKey: "type",
        header: "Report",
        meta: "Report",
        cell: ({ row }) => {
          const Icon = FORMAT_ICON[row.original.format];
          return (
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                <Icon className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.original.type}</p>
                <p className="truncate text-xs text-muted-foreground">{row.original.paramsLabel}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "requestedBy",
        header: "Requested by",
        meta: "Requested by",
        cell: ({ row }) => <span className="text-sm">{row.original.requestedBy}</span>,
      },
      {
        accessorKey: "format",
        header: "Format",
        meta: "Format",
        cell: ({ row }) => (
          <Badge variant="secondary" className="uppercase">
            {row.original.format}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} pulse={row.original.status === "RUNNING"} />
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Requested",
        meta: "Requested at",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-xs">{relativeTime(row.original.createdAt)}</p>
            {row.original.sizeKb && (
              <p className="text-[11px] text-muted-foreground tabular">{row.original.sizeKb} KB</p>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const job = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={job.type}
                actions={[
                  {
                    label: "Download",
                    icon: Download,
                    // The download re-runs the report, so the API guards it with
                    // the same `report.generate` as running one from scratch.
                    permission: "report.generate",
                    disabled: job.status !== "COMPLETED",
                    onSelect: () => {
                      // Re-runs the stored parameters server-side, so the file
                      // always matches the data as it stands now.
                      reportsApi
                        .download(job.id)
                        .then(() => toast.success("Download started", { description: job.type }))
                        .catch((error: unknown) =>
                          toast.error(
                            error instanceof Error ? error.message : "The download failed.",
                          ),
                        );
                    },
                  },
                  {
                    /**
                     * POST /messaging/reports/email — messaging.controller.ts,
                     * on report.generate, the grant running the report needs.
                     *
                     * To the signed-in account and no other: the route takes no
                     * recipient, because a field for one would be an export
                     * path for a spreadsheet of plate numbers. What is emailed
                     * is the report's particulars, not the file — nothing in
                     * the platform renders a document yet, and the download
                     * action beside this one is what produces the data.
                     */
                    label: "Email to me",
                    icon: Mail,
                    permission: "report.generate",
                    disabled: job.status !== "COMPLETED",
                    onSelect: () =>
                      void send(
                        () =>
                          messagingApi.emailReport({
                            reportName: job.type,
                            format: job.format,
                            rangeLabel: job.paramsLabel,
                          }),
                        { success: "Report emailed", description: job.type },
                      ),
                  },
                  {
                    label: "Copy job ID",
                    icon: Copy,
                    onSelect: () => {
                      void navigator.clipboard.writeText(job.id);
                      toast.success("Copied", { description: job.id });
                    },
                  },
                  {
                    label: "Re-run",
                    icon: RotateCcw,
                    permission: "report.generate",
                    separatorBefore: true,
                    onSelect: () => {
                      // Downloading already re-runs it; this is the same act
                      // named the way an operator thinks about it.
                      reportsApi
                        .download(job.id)
                        .then(() => toast.success("Report re-run", { description: job.type }))
                        .catch((error: unknown) =>
                          toast.error(error instanceof Error ? error.message : "The re-run failed."),
                        );
                    },
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    // `send` is stable (useCallback with no dependencies in useMessaging), so
    // naming it here costs nothing and keeps the memo honest.
    [send],
  );

  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const running = jobs.filter((j) => j.status === "RUNNING" || j.status === "QUEUED").length;
  const failed = jobs.filter((j) => j.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        meta={<ZoneScopeBadge />}
        description={
          /**
           * A scoped officer's reports are mostly, but not entirely, their own.
           * `ReportsService` filters the revenue, occupancy, duration, vendor,
           * collection, government-revenue and tax builders through the same
           * zone scope as everything else — but the citizen, settlement and
           * audit reports are built with no scope at all, and ZONE_OFFICER
           * holds `report.generate`. Naming that here is the honest thing the
           * portal can do; fixing it belongs in the API.
           */
          isZoneScoped
            ? "Generate and export operational reports. Most are limited to your zones — the citizen, settlement and audit reports cover the whole authority."
            : "Generate, schedule and export every statutory and operational report. Large reports run as background jobs and land here when ready."
        }
        actions={
          <Can permission="report.generate">
            <Button variant="outline" size="sm" className="h-9" onClick={openNewSchedule}>
              <CalendarClock className="size-4" /> Schedule
            </Button>
            <Button size="sm" className="h-9" onClick={() => setGenerateOpen(true)}>
              <Plus className="size-4" /> Generate report
            </Button>
          </Can>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          {/* The catalogue the API serves, not the demo list beside it —
              those two are the same length today and need not stay that way. */}
          <StatCard label="Report types" numeric={reportTypes.length} icon={FileBarChart} hint="Available to generate" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Ready to download" numeric={completed} icon={CheckCircle2} accent="success" hint="Completed in the last 7 days" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="In progress" numeric={running} icon={Clock} accent="info" hint="Queued or running now" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Failed" numeric={failed} icon={CircleAlert} accent={failed > 0 ? "danger" : "success"} hint="Re-run from the ⋯ menu" />
        </FadeStaggerItem>
      </FadeStagger>

      <Tabs defaultValue="catalogue">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="jobs">History ({jobs.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({schedules.length})</TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------- catalogue */}
        <TabsContent value="catalogue" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reportTypes.map((type) => (
              <SpotlightCard key={type.key} className="rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setReportType(type.key);
                    setGenerateOpen(true);
                  }}
                  className="group flex h-full w-full flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileBarChart className="size-4.5" />
                  </span>
                  <p className="text-sm font-medium">{type.label}</p>
                  <p className="text-xs text-muted-foreground text-pretty">{type.description}</p>
                  <span className="mt-auto pt-2 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Generate →
                  </span>
                </button>
              </SpotlightCard>
            ))}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- jobs */}
        <TabsContent value="jobs" className="mt-4">
          <DataTable
            data={jobs}
            columns={columns}
            searchKeys={["type", "paramsLabel", "requestedBy"]}
            searchPlaceholder="Search report type, parameters or requester…"
            facets={[
              {
                columnId: "status",
                label: "Status",
                options: [
                  { value: "COMPLETED", label: "Completed" },
                  { value: "RUNNING", label: "Running" },
                  { value: "QUEUED", label: "Queued" },
                  { value: "FAILED", label: "Failed" },
                ],
              },
              {
                columnId: "format",
                label: "Format",
                options: [
                  { value: "pdf", label: "PDF" },
                  { value: "xlsx", label: "Excel" },
                  { value: "csv", label: "CSV" },
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
            isLoading={isLoading}
            emptyTitle={emptyReason ? "Nothing to show" : "No reports generated"}
            emptyDescription={
              emptyReason ?? "Pick a report from the catalogue to generate your first export."
            }
          />
        </TabsContent>

        {/* ----------------------------------------------------- scheduled */}
        <TabsContent value="scheduled" className="mt-4">
          <SectionCard
            title="Scheduled reports"
            description={
              // Says what the officer is looking at and, more usefully, whose
              // account the report will arrive in — because that is the answer
              // to the first question anyone asks about a schedule.
              "Each one runs on the API's scheduler and is delivered to the account that created it."
            }
            contentClassName="p-0"
            action={
              <Can permission="report.generate">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openNewSchedule}>
                  <Plus className="size-3.5" /> New schedule
                </Button>
              </Can>
            }
          >
            {schedulesLoading ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Loading schedules…
              </p>
            ) : schedules.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={schedulesEmptyReason ? "Nothing to show" : "No schedules yet"}
                description={
                  schedulesEmptyReason ??
                  "A schedule runs a report on a cadence and delivers it to you. The period is worked out at each run, so a daily collection always means yesterday."
                }
                action={
                  schedulesEmptyReason ? undefined : (
                    <Can permission="report.generate">
                      <Button size="sm" onClick={openNewSchedule}>
                        <Plus className="size-4" /> New schedule
                      </Button>
                    </Can>
                  )
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {schedules.map((schedule) => (
                  <li key={schedule.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                      <CalendarClock className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{schedule.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {schedule.label} · {schedule.cadence}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {schedule.paramsLabel} · to {schedule.ownerName}
                        {schedule.channels.length > 0 &&
                          ` by ${schedule.channels
                            .map((c) => channelLabel(c as MessageChannel))
                            .join(", ")}`}
                      </p>
                      {/* A schedule the API switched off after repeated
                          failures, with the reason it gave. Without this the
                          officer sees only that it stopped. */}
                      {schedule.failureCount > 0 && (
                        <p className="truncate text-[11px] text-amber-700 dark:text-amber-400">
                          {schedule.failureCount >= schedule.failuresBeforePause
                            ? `Paused after ${schedule.failureCount} failed runs`
                            : `${schedule.failureCount} of ${schedule.failuresBeforePause} failed runs`}
                          {schedule.lastError ? ` — ${schedule.lastError}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="whitespace-nowrap text-right">
                      <p className="text-[11px] text-muted-foreground">
                        {schedule.isActive ? "Next run" : "Paused"}
                      </p>
                      <p className="text-xs">
                        {schedule.isActive ? relativeTime(schedule.nextRunAt) : "—"}
                      </p>
                    </div>

                    {schedule.lastStatus && (
                      <StatusBadge status={schedule.lastStatus} />
                    )}
                    <StatusBadge
                      status={schedule.isActive ? "ACTIVE" : "INACTIVE"}
                      label={schedule.isActive ? "Active" : "Paused"}
                    />

                    <RowActions
                      label={schedule.name}
                      actions={[
                        {
                          label: "Run now",
                          icon: Play,
                          // The API runs it as the schedule's owner and leaves
                          // the next run where it was, so this is a copy of the
                          // report rather than a way to move Monday.
                          permission: "report.generate",
                          disabled: schedulesBusy,
                          onSelect: () => void runScheduleNow(schedule).catch(() => {}),
                        },
                        {
                          label: "Edit schedule",
                          icon: Pencil,
                          permission: "report.generate",
                          onSelect: () => openEditSchedule(schedule),
                        },
                        {
                          label: schedule.isActive ? "Pause" : "Resume",
                          icon: schedule.isActive ? Pause : Clock,
                          permission: "report.generate",
                          disabled: schedulesBusy,
                          onSelect: () =>
                            void setScheduleActive(schedule, !schedule.isActive).catch(() => {}),
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          permission: "report.generate",
                          destructive: true,
                          separatorBefore: true,
                          onSelect: () => setDeleting(schedule),
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* ---------------------------------------------------------- generate */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate a report</DialogTitle>
            {/* Reports run inline — the API produces the file within the
                request and the browser downloads it. Nothing queues, and
                nothing arrives later, so this no longer promises a
                notification and an email that were never going to come. Once
                a job is listed, "Email to me" sends its particulars. */}
            <DialogDescription>
              The file downloads as soon as it has been produced. You can email yourself a completed
              report&apos;s details from its row afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="report-type">Report</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {reportTypes.find((t) => t.key === reportType)?.description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-from">From</Label>
                <Input
                  id="report-from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-to">To</Label>
                <Input
                  id="report-to"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-zone">Zone</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger id="report-zone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">{isZoneScoped ? "All my zones" : "All zones"}</SelectItem>
                    {zoneOptions.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.code} · {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-vendor">Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger id="report-vendor" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All vendors</SelectItem>
                    {vendorOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.orgName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Format</Label>
              <RadioGroup value="csv" className="grid grid-cols-3 gap-2">
                {(["pdf", "xlsx", "csv"] as const).map((f) => {
                  const Icon = FORMAT_ICON[f];
                  // Only CSV is produced. Rendering a PDF or a real workbook
                  // needs a library the API does not carry, and handing back a
                  // CSV named `.pdf` would be worse than saying so.
                  const available = f === "csv";
                  return (
                    <label
                      key={f}
                      htmlFor={`fmt-${f}`}
                      title={available ? undefined : "Not available yet"}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors",
                        available
                          ? "cursor-pointer border-primary bg-primary/5"
                          : "cursor-not-allowed opacity-40",
                      )}
                    >
                      <RadioGroupItem
                        value={f}
                        id={`fmt-${f}`}
                        disabled={!available}
                        className="sr-only"
                      />
                      <Icon className="size-5 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase">{f}</span>
                    </label>
                  );
                })}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                CSV opens directly in Excel. PDF and native workbooks are not built yet.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isBusy || !from || !to || from > to}
              onClick={() => {
                void generate()
                  .then(() => setGenerateOpen(false))
                  .catch(() => {});
              }}
            >
              <Play className="size-4" /> {isBusy ? "Running…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------- schedule */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit schedule" : "Schedule a report"}</DialogTitle>
            {/*
              Two things this form deliberately does not ask for. A period,
              because the point of a schedule is that the window moves with it —
              the API derives "yesterday" or "last month" at each run. And a
              list of recipients, because the report goes to the account that
              owns the schedule and to nobody else; a field for other people's
              addresses would be an export path for a spreadsheet of plate
              numbers.
            */}
            <DialogDescription>
              The report runs on its own and arrives in your account. Each run covers the period the
              cadence implies, worked out afresh every time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-name">Name</Label>
              <Input
                id="schedule-name"
                value={form.name}
                placeholder="Daily collection summary"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schedule-type">Report</Label>
              <Select value={form.type} onValueChange={(type) => patch({ type })}>
                <SelectTrigger id="schedule-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* The same catalogue the Generate dialog offers, which the
                      API has already filtered to what this account may run — so
                      a schedule cannot be created for a report that would be
                      refused every time it fired. */}
                  {reportTypes.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schedule-frequency">Repeats</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(frequency) => patch({ frequency: frequency as ReportFrequency })}
                >
                  <SelectTrigger id="schedule-frequency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schedule-time">At</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={clockOf(form)}
                  onChange={(e) => {
                    const [hour, minute] = e.target.value.split(":").map(Number);
                    // A cleared time input reports "", so both halves are
                    // guarded — an NaN hour would be sent to the API and
                    // refused, which is a worse way to learn the field is empty.
                    if (Number.isFinite(hour) && Number.isFinite(minute)) patch({ hour, minute });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Local time in {SCHEDULE_TIMEZONE}, not UTC.
                </p>
              </div>
            </div>

            {form.frequency === "WEEKLY" && (
              <div className="space-y-1.5">
                <Label htmlFor="schedule-weekday">On</Label>
                <Select
                  value={String(form.weekday)}
                  onValueChange={(value) => patch({ weekday: Number(value) })}
                >
                  <SelectTrigger id="schedule-weekday" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.frequency === "MONTHLY" && (
              <div className="space-y-1.5">
                <Label htmlFor="schedule-day">Day of the month</Label>
                <Input
                  id="schedule-day"
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth}
                  onChange={(e) => patch({ dayOfMonth: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  A day past the end of a short month runs on its last day — the 31st becomes the
                  28th in February, never the 1st of March.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schedule-zone">Zone</Label>
                <Select value={form.zoneId} onValueChange={(zoneId) => patch({ zoneId })}>
                  <SelectTrigger id="schedule-zone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">{isZoneScoped ? "All my zones" : "All zones"}</SelectItem>
                    {zoneOptions.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.code} · {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schedule-vendor">Vendor</Label>
                <Select value={form.vendorId} onValueChange={(vendorId) => patch({ vendorId })}>
                  <SelectTrigger id="schedule-vendor" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All vendors</SelectItem>
                    {vendorOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.orgName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Tell me by</Label>
              <div className="flex flex-wrap gap-4">
                {DELIVERY_CHANNELS.map((channel) => {
                  // A channel the deployment holds no credentials for is shown
                  // and disabled rather than hidden: an officer should be able
                  // to see that WhatsApp exists and is not switched on, and ask
                  // for it, instead of wondering where it went.
                  const status = messagingChannels.data?.find((c) => c.channel === channel);
                  const available = !isLiveApi || status?.configured !== false;
                  return (
                    <label
                      key={channel}
                      htmlFor={`ch-${channel}`}
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        available ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                      )}
                      title={available ? undefined : "This deployment has no credentials for it"}
                    >
                      <Checkbox
                        id={`ch-${channel}`}
                        disabled={!available}
                        checked={form.channels.includes(channel)}
                        onCheckedChange={(checked) =>
                          patch({
                            channels: checked
                              ? [...form.channels, channel]
                              : form.channels.filter((c) => c !== channel),
                          })
                        }
                      />
                      <span className="capitalize">{channelLabel(channel)}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                The portal also raises an alert each time it runs, whichever of these you pick.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium">{describeCadence(form)}</p>
              <p className="text-xs text-muted-foreground">
                Each run covers {describeWindow(form.frequency).toLowerCase()}.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={schedulesBusy || form.name.trim().length === 0 || form.channels.length === 0}
              onClick={() => {
                void saveSchedule()
                  .then(() => setScheduleOpen(false))
                  .catch(() => {});
              }}
            >
              <CalendarClock className="size-4" />
              {schedulesBusy ? "Saving…" : editing ? "Save changes" : "Create schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        Deleting a schedule is allowed, unlike deleting a report. A job is a
        record that somebody asked a question of the data on a given day — the
        same class of fact the audit trail holds, and nothing carrying history is
        deleted in this system. A schedule is only the intention to keep asking,
        and the runs it already produced survive it untouched.
      */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this schedule?"
        description={
          deleting
            ? `"${deleting.name}" will stop running. The reports it has already produced stay in the history.`
            : undefined
        }
        confirmLabel="Delete schedule"
        destructive
        onConfirm={async () => {
          if (deleting) await deleteSchedule(deleting).catch(() => {});
          setDeleting(null);
        }}
      />

      {/*
        There is no delete for a report itself. A report is a record that
        somebody asked a question of the data on a given day, which is the same
        class of fact the audit trail holds — and nothing carrying history is
        deleted in this system. Nothing is stored to remove either: the file is
        regenerated on download.
      */}
    </div>
  );
}
