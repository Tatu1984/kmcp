"use client";

import * as React from "react";
import {
  AlertTriangle,
  Cctv,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  camerasApi,
  listAll,
  CAMERA_STATUS_LABELS,
  type ApiCamera,
  type CameraStatus,
} from "@/frontend/api";
import { useApiQuery, describeApiError } from "@/frontend/hooks/use-api";
import { isLiveApi } from "@/config/env";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent } from "@/frontend/components/ui/card";
import { Input } from "@/frontend/components/ui/input";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { Switch } from "@/frontend/components/ui/switch";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { Can } from "@/frontend/components/shared/can";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { CameraPlayer } from "./camera-player";
import { CameraFormDialog } from "./camera-form-dialog";
import { cn } from "@/lib/utils";

/**
 * Every camera on the network, grouped by the road it is bolted to.
 *
 * Two jobs on one screen, and the second is the one people actually open it
 * for. Watching a street is the obvious one. Knowing which of forty cameras are
 * dark right now is the one that gets asked every morning, so the counts sit
 * above the list rather than behind a tab.
 *
 * Nothing plays automatically. A wall of live streams costs bandwidth on every
 * page load and answers a question nobody asked; a picture opens when somebody
 * chooses a camera, one at a time.
 *
 * Registering, editing and testing sit behind `camera.manage`, so a zone
 * officer opening this screen sees the same cameras and none of the controls —
 * which is the right split: watching a street and being trusted with the
 * password to one are different things.
 */
export function CamerasView() {
  const [query, setQuery] = React.useState("");
  /**
   * Ids, not rows.
   *
   * Holding the camera object here froze it: testing a camera with its panel
   * open wrote a new status, resolution and frame rate, the tile behind the
   * panel updated, and the panel went on saying "Offline · Not tested" because
   * it was rendering a copy taken when it opened. Keeping the id and looking
   * the camera up on each render means every screen shows the same camera.
   */
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [probing, setProbing] = React.useState<string | null>(null);
  const [showRetired, setShowRetired] = React.useState(false);

  // Paged rather than asked for in one go: the API caps pageSize at 100, and a
  // city with two or three cameras per stretch of kerb passes that quickly.
  // `listAll` walks the pages, which is what every other list screen here does.
  const cameras = useApiQuery(["cameras", "list"], () =>
    listAll<ApiCamera>((page, pageSize) => camerasApi.list({ page, pageSize })),
  );
  const health = useApiQuery(["cameras", "health"], () =>
    camerasApi.health().then((r) => r.data),
  );

  function refresh() {
    void cameras.refetch();
    void health.refetch();
  }

  /**
   * Test a camera, and say what it said.
   *
   * The answer goes in a toast rather than a dialog because it is one sentence
   * and the row behind it updates anyway: a probe writes the status, the
   * resolution and the frame rate, so the tile the operator is looking at
   * changes underneath the message.
   */
  async function probe(camera: ApiCamera) {
    setProbing(camera.id);
    const pending = toast.loading(`Testing ${camera.code}…`, {
      description: "Opening the stream. This can take a few seconds.",
    });
    try {
      const { data } = await camerasApi.probe(camera.id);
      refresh();
      if (data.reachable) {
        toast.success(`${camera.code} answered`, {
          id: pending,
          description: [data.resolution, data.codec, data.fps ? `${data.fps} fps` : null]
            .filter(Boolean)
            .join(" · ") || "The stream opened.",
        });
      } else {
        toast.error(`${camera.code} did not answer`, {
          id: pending,
          description: data.error ?? "The camera could not be reached.",
        });
      }
    } catch (cause) {
      toast.error("Could not test the camera", { id: pending, description: describeApiError(cause) });
    } finally {
      setProbing(null);
    }
  }

  async function remove(camera: ApiCamera) {
    try {
      await camerasApi.remove(camera.id);
      toast.success(`${camera.code} removed`);
      if (selectedId === camera.id) setSelectedId(null);
      refresh();
    } catch (cause) {
      toast.error("Could not remove the camera", { description: describeApiError(cause) });
    }
  }

  if (!isLiveApi) {
    return (
      <EmptyState
        icon={Cctv}
        title="Not connected to an API"
        description={
          "Cameras are read from the live API — there is no sample footage to stand in for " +
          "them. Set NEXT_PUBLIC_API_URL to the API's full base URL, including the /api/v1 " +
          "path, and rebuild."
        }
      />
    );
  }

  if (cameras.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (cameras.isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load cameras"
        description={describeApiError(cameras.error)}
        action={
          <Button variant="outline" size="sm" onClick={() => void cameras.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const all = cameras.data ?? [];
  // Looked up rather than remembered, so a probe or an edit is reflected
  // everywhere at once. A camera that has just been deleted resolves to null,
  // which closes its panel.
  const selected = all.find((c) => c.id === selectedId) ?? null;
  const editing = all.find((c) => c.id === editingId) ?? null;
  const deleting = all.find((c) => c.id === deletingId) ?? null;

  const registerButton = (
    <Can permission="camera.manage">
      <Button
        size="sm"
        onClick={() => {
          setEditingId(null);
          setFormOpen(true);
        }}
      >
        <Plus className="size-4" aria-hidden />
        Register camera
      </Button>
    </Can>
  );

  if (all.length === 0) {
    return (
      <>
        <EmptyState
          icon={Cctv}
          title="No cameras registered"
          description={
            "Cameras are filed against the road they are bolted to. Register one and it will " +
            "appear here under its street, whether or not it is streaming yet."
          }
          action={registerButton}
        />
        <CameraFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          camera={editing}
          onSaved={refresh}
        />
      </>
    );
  }

  const needle = query.trim().toLowerCase();
  const inScope = showRetired ? all : all.filter((c) => c.isActive);
  const matching = needle
    ? inScope.filter(
        (c) =>
          c.code.toLowerCase().includes(needle) ||
          c.label.toLowerCase().includes(needle) ||
          c.street.name.toLowerCase().includes(needle),
      )
    : inScope;

  // Grouped by road, because that is how somebody thinks about them: they are
  // going to look at a street, not at a camera id.
  const byStreet = new Map<string, { name: string; ward: string; cameras: ApiCamera[] }>();
  for (const c of matching) {
    const entry = byStreet.get(c.streetId) ?? {
      name: c.street.name,
      ward: c.street.ward.name,
      cameras: [],
    };
    entry.cameras.push(c);
    byStreet.set(c.streetId, entry);
  }

  const dark = (health.data?.byStatus ?? [])
    .filter((s) => s.status !== "ONLINE" && s.status !== "DECOMMISSIONED")
    .reduce((sum, s) => sum + s.count, 0);
  const retired = all.filter((c) => !c.isActive).length;

  return (
    <div className="space-y-6">
      {/* The morning question, before anything else on the page. */}
      {health.data ? (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border p-4">
          <Figure label="Cameras" value={String(health.data.total)} />
          <Figure
            label="Not showing a picture"
            value={String(dark)}
            tone={dark > 0 ? "warn" : "default"}
          />
          {health.data.neverSeen > 0 ? (
            <Figure
              label="Never seen"
              value={String(health.data.neverSeen)}
              tone="warn"
              hint="Registered but never once heard from"
            />
          ) : null}
          <div className="ml-auto">{registerButton}</div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a road, a code or a position"
            className="pl-9"
            aria-label="Search cameras"
          />
        </div>

        {/* Only offered when there is something to show. A toggle that reveals
            nothing is a question about the data, not a control. */}
        {retired > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showRetired} onCheckedChange={setShowRetired} />
            Show {retired} out of service
          </label>
        ) : null}
      </div>

      {matching.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches that"
          description="No camera, code or road matched what you typed."
        />
      ) : (
        <div className="space-y-8">
          {[...byStreet.entries()].map(([streetId, group]) => (
            <section key={streetId} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{group.name}</h2>
                <span className="text-sm text-muted-foreground">
                  {group.ward} · {group.cameras.length} camera
                  {group.cameras.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.cameras.map((c) => (
                  <CameraTile
                    key={c.id}
                    camera={c}
                    busy={probing === c.id}
                    onOpen={() => setSelectedId(c.id)}
                    onEdit={() => {
                      setEditingId(c.id);
                      setFormOpen(true);
                    }}
                    onProbe={() => void probe(c)}
                    onDelete={() => setDeletingId(c.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.label}</SheetTitle>
                <SheetDescription>
                  {selected.code} · {selected.street.name}, {selected.street.ward.name}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                <CameraPlayer camera={selected} />

                <Can permission="camera.manage">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void probe(selected)}
                      disabled={probing === selected.id}
                    >
                      <Zap className="size-4" aria-hidden />
                      {probing === selected.id ? "Testing…" : "Test connection"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(selected.id);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </Button>
                  </div>
                </Can>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Detail label="Status" value={CAMERA_STATUS_LABELS[selected.status]} />
                  <Detail
                    label="Last seen"
                    value={
                      selected.lastSeenAt
                        ? new Date(selected.lastSeenAt).toLocaleString("en-IN")
                        : "Never"
                    }
                  />
                  <Detail label="Make & model" value={selected.makeModel ?? "Not recorded"} />
                  <Detail
                    label="Installed"
                    value={
                      selected.installedAt
                        ? new Date(selected.installedAt).toLocaleDateString("en-IN")
                        : "Not recorded"
                    }
                  />
                  <Detail
                    label="Picture"
                    value={
                      selected.resolution
                        ? `${selected.resolution}${selected.fps ? ` · ${selected.fps} fps` : ""}`
                        : "Not tested"
                    }
                  />
                  <Detail
                    label="Bays in view"
                    value={
                      selected.coverageSlots == null ? "Not recorded" : String(selected.coverageSlots)
                    }
                  />
                </dl>

                {/* ffprobe's own words. Terse, but "401 Unauthorized" and
                    "Connection refused" send an engineer to two different
                    places, and paraphrasing loses exactly that. */}
                {selected.probeError ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
                      Last test failed
                    </p>
                    <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                      {selected.probeError}
                    </p>
                    {selected.probedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(selected.probedAt).toLocaleString("en-IN")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-1.5">
                  {selected.hasIR ? <Badge variant="outline">Infra-red</Badge> : null}
                  {selected.hasPTZ ? <Badge variant="outline">Pan, tilt, zoom</Badge> : null}
                  {!selected.isActive ? <Badge variant="secondary">Out of service</Badge> : null}
                </div>

                {selected.street.zones.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Zones priced on this road
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.street.zones.map((z) => (
                        <Badge key={z.id} variant="outline">
                          {z.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <CameraFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        camera={editing}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title={`Remove ${deleting?.code ?? "this camera"}?`}
        description={
          <>
            This deletes the registration. For a camera that exists but is off the network,
            mark it out of service instead — that keeps its history and its place on the road.
          </>
        }
        confirmLabel="Remove camera"
        destructive
        typeToConfirm={deleting?.code}
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  );
}

const STATUS_STYLE: Record<CameraStatus, string> = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-muted-foreground",
  DEGRADED: "bg-amber-500",
  MAINTENANCE: "bg-sky-500",
  DECOMMISSIONED: "bg-muted-foreground/50",
};

function CameraTile({
  camera,
  busy,
  onOpen,
  onEdit,
  onProbe,
  onDelete,
}: {
  camera: ApiCamera;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onProbe: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={cn(
        "group relative transition-colors hover:bg-muted/50",
        !camera.isActive && "opacity-60",
      )}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{camera.code}</span>
          {/* Status is a dot and a word, never a dot alone. */}
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className={cn("size-2 rounded-full", STATUS_STYLE[camera.status])} aria-hidden />
            {CAMERA_STATUS_LABELS[camera.status]}
          </span>
        </div>

        {/* The whole tile opens the camera; the menu is the exception, so it
            sits outside the button rather than inside it. */}
        <button
          type="button"
          onClick={onOpen}
          className="block w-full space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-sm font-medium leading-snug">{camera.label}</p>
          <p className="text-xs text-muted-foreground">
            {!camera.isActive
              ? "Out of service"
              : camera.status === "ONLINE"
                ? camera.resolution
                  ? `Open to watch · ${camera.resolution}`
                  : "Open to watch"
                : camera.lastSeenAt
                  ? `Last seen ${new Date(camera.lastSeenAt).toLocaleDateString("en-IN")}`
                  : "Never seen"}
          </p>
        </button>

        <Can permission="camera.manage">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-2 right-2 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Actions for ${camera.code}`}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onProbe} disabled={busy}>
                <Zap className="size-4" aria-hidden />
                {busy ? "Testing…" : "Test connection"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="size-4" aria-hidden />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Can>
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-500",
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
