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
import { Switch } from "@/frontend/components/ui/switch";
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
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem, SpotlightCard } from "@/frontend/components/reactbits";
import { REPORT_JOBS, REPORT_TYPES, SCHEDULED_REPORTS, ZONES, VENDORS } from "@/frontend/lib/mock";
import { relativeTime } from "@/shared/utils/common.util";
import { cn } from "@/lib/utils";
import type { ReportJob } from "@/shared/types/domain.types";

const FORMAT_ICON = { pdf: FileText, xlsx: FileSpreadsheet, csv: FileBarChart } as const;

export function ReportsView() {
  const [jobs, setJobs] = React.useState<ReportJob[]>(REPORT_JOBS);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ReportJob | null>(null);
  const [reportType, setReportType] = React.useState<string>(REPORT_TYPES[0].key);
  const [format, setFormat] = React.useState<"pdf" | "xlsx" | "csv">("xlsx");

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
                    onSelect: () =>
                      toast.success("Download started", {
                        description: `${job.type}.${job.format}`,
                      }),
                  },
                  {
                    label: "Email to me",
                    icon: Mail,
                    disabled: job.status !== "COMPLETED",
                    onSelect: () => toast.success("Report emailed", { description: job.type }),
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
                      setJobs((list) => [
                        { ...job, id: `rpt_${list.length + 100}`, status: "QUEUED", createdAt: new Date().toISOString(), completedAt: undefined },
                        ...list,
                      ]);
                      toast.success("Report queued again", { description: job.type });
                    },
                  },
                  {
                    label: "Delete",
                    icon: Trash2,
                    destructive: true,
                    onSelect: () => {
                      setSelected(job);
                      setDeleteOpen(true);
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
            {REPORT_TYPES.map((type) => (
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
            emptyTitle="No reports generated"
            emptyDescription="Pick a report from the catalogue to generate your first export."
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
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {REPORT_TYPES.find((t) => t.key === reportType)?.description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-from">From</Label>
                <Input id="report-from" type="date" defaultValue="2026-08-01" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-to">To</Label>
                <Input id="report-to" type="date" defaultValue="2026-08-05" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-zone">Zone</Label>
                <Select defaultValue="__all">
                  <SelectTrigger id="report-zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All zones</SelectItem>
                    {ZONES.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.code} · {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-vendor">Vendor</Label>
                <Select defaultValue="__all">
                  <SelectTrigger id="report-vendor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All vendors</SelectItem>
                    {VENDORS.map((v) => (
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
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as typeof format)}
                className="grid grid-cols-3 gap-2"
              >
                {(["pdf", "xlsx", "csv"] as const).map((f) => {
                  const Icon = FORMAT_ICON[f];
                  return (
                    <label
                      key={f}
                      htmlFor={`fmt-${f}`}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors",
                        format === f ? "border-primary bg-primary/5" : "hover:bg-accent/40",
                      )}
                    >
                      <RadioGroupItem value={f} id={`fmt-${f}`} className="sr-only" />
                      <Icon className="size-5 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase">{f}</span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="report-email" className="text-sm">
                  Email when ready
                </Label>
                <p className="text-xs text-muted-foreground">
                  Sent to sudipta.banerjee@kmc.gov.in
                </p>
              </div>
              <Switch id="report-email" defaultChecked />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const type = REPORT_TYPES.find((t) => t.key === reportType)!;
                setJobs((list) => [
                  {
                    id: `rpt_${list.length + 200}`,
                    type: type.label,
                    paramsLabel: "01 Aug – 05 Aug 2026 · All zones",
                    status: "QUEUED",
                    requestedBy: "Sudipta Banerjee",
                    format,
                    createdAt: new Date().toISOString(),
                  },
                  ...list,
                ]);
                setGenerateOpen(false);
                toast.success("Report queued", {
                  description: `${type.label} · ${format.toUpperCase()}. You will be notified when it is ready.`,
                });
              }}
            >
              <Play className="size-4" /> Generate
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this report?"
        destructive
        confirmLabel="Delete report"
        description="The generated file is removed from storage. The record that it was generated stays in the audit trail."
        onConfirm={() => {
          setJobs((list) => list.filter((j) => j.id !== selected?.id));
          toast.success("Report deleted", { description: selected?.type });
        }}
      />
    </div>
  );
}
