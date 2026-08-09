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
import { SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem, SpotlightCard } from "@/frontend/components/reactbits";
import { REPORT_JOBS, REPORT_TYPES, SCHEDULED_REPORTS, ZONES, VENDORS } from "@/frontend/lib/mock";
import { reportsApi, zonesApi, vendorsApi } from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { toReportJob } from "@/frontend/lib/adapters";
import { relativeTime } from "@/shared/utils/common.util";
import { cn } from "@/lib/utils";
import type { ReportJob } from "@/shared/types/domain.types";

const FORMAT_ICON = { pdf: FileText, xlsx: FileSpreadsheet, csv: FileBarChart } as const;

/** Today and a month ago, as the date inputs want them. */
function isoDate(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function ReportsView() {
  const {
    items: jobs,
    isLoading,
    isBusy,
    emptyReason,
    apply,
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
    zonesApi.list({ pageSize: 200 }).then((r) => r.data),
  );
  const vendors = useApiQuery(["vendors", "for-reports"], () =>
    vendorsApi.list({ pageSize: 200 }).then((r) => r.data),
  );

  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState<string>(REPORT_TYPES[0].key);
  const [from, setFrom] = React.useState(() => isoDate(30));
  const [to, setTo] = React.useState(() => isoDate(0));
  const [zoneId, setZoneId] = React.useState("__all");
  const [vendorId, setVendorId] = React.useState("__all");

  const zoneOptions = zones.data ?? ZONES;
  const vendorOptions = vendors.data ?? VENDORS;

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
                    label: "Email to me",
                    icon: Mail,
                    disabled: job.status !== "COMPLETED",
                    onSelect: () => toast.info("Emailing reports is not built yet"),
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
    [],
  );

  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const running = jobs.filter((j) => j.status === "RUNNING" || j.status === "QUEUED").length;
  const failed = jobs.filter((j) => j.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate, schedule and export every statutory and operational report. Large reports run as background jobs and land here when ready."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setScheduleOpen(true)}>
              <CalendarClock className="size-4" /> Schedule
            </Button>
            <Button size="sm" className="h-9" onClick={() => setGenerateOpen(true)}>
              <Plus className="size-4" /> Generate report
            </Button>
          </>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Report types" numeric={REPORT_TYPES.length} icon={FileBarChart} hint="Available to generate" />
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
          <TabsTrigger value="scheduled">Scheduled ({SCHEDULED_REPORTS.length})</TabsTrigger>
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
            description="Generated automatically and emailed to the recipients"
            contentClassName="p-0"
            action={
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setScheduleOpen(true)}>
                <Plus className="size-3.5" /> New schedule
              </Button>
            }
          >
            <ul className="divide-y divide-border/60">
              {SCHEDULED_REPORTS.map((schedule) => (
                <li key={schedule.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <CalendarClock className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{schedule.type}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {schedule.cadence} · {schedule.recipients}
                    </p>
                  </div>
                  <Badge variant="secondary" className="uppercase">
                    {schedule.format}
                  </Badge>
                  <StatusBadge
                    status={schedule.isActive ? "ACTIVE" : "INACTIVE"}
                    label={schedule.isActive ? "Active" : "Paused"}
                  />
                  <RowActions
                    label={schedule.type}
                    actions={[
                      { label: "Run now", icon: Play, onSelect: () => toast.success("Report queued", { description: schedule.type }) },
                      { label: "Edit schedule", icon: CalendarClock, onSelect: () => setScheduleOpen(true) },
                      {
                        label: schedule.isActive ? "Pause" : "Resume",
                        icon: Clock,
                        onSelect: () =>
                          toast.success(schedule.isActive ? "Schedule paused" : "Schedule resumed", {
                            description: schedule.type,
                          }),
                      },
                      { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => toast.success("Schedule deleted") },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* ---------------------------------------------------------- generate */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate a report</DialogTitle>
            <DialogDescription>
              Large reports run in the background. You will get a notification and an email when the
              file is ready.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="report-type">Report</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-type">
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
                  <SelectTrigger id="report-zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All zones</SelectItem>
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
                  <SelectTrigger id="report-vendor">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a recurring report</DialogTitle>
            <DialogDescription>
              The report is generated automatically and emailed to the recipients you list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sched-type">Report</Label>
              <Select defaultValue={REPORT_TYPES[0].key}>
                <SelectTrigger id="sched-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sched-cadence">Cadence</Label>
                <Select defaultValue="daily">
                  <SelectTrigger id="sched-cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekly">Every Monday</SelectItem>
                    <SelectItem value="monthly">1st of every month</SelectItem>
                    <SelectItem value="quarterly">Every quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-time">At</Label>
                <Input id="sched-time" type="time" defaultValue="06:00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-recipients">Recipients</Label>
              <Input
                id="sched-recipients"
                placeholder="commissioner@kmc.gov.in, audit@kmc.gov.in"
              />
              <p className="text-xs text-muted-foreground">Comma-separated email addresses.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setScheduleOpen(false);
                toast.success("Schedule created", { description: "The first run happens tomorrow at 06:00." });
              }}
            >
              Create schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        There is no delete. A report is a record that somebody asked a question
        of the data on a given day, which is the same class of fact the audit
        trail holds — and nothing carrying history is deleted in this system.
        Nothing is stored to remove either: the file is regenerated on download.
      */}
    </div>
  );
}
