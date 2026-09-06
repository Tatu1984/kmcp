"use client";

import * as React from "react";
import {
  AlertTriangle,
  Cctv,
  MoreHorizontal,
  Pencil,
  Plus,
  Maximize2,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/frontend/components/ui/accordion";
import { CameraPlayer } from "./camera-player";
import { CameraFullscreen } from "./camera-fullscreen";
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
  /**
   * Which roads are open. Null means nobody has chosen yet, which is different
   * from "none open" and is why this is not just an array: untouched, the first
   * road opens so the page shows a picture rather than a list of closed rows,
   * and a search opens everything it matched — but once somebody has opened or
   * closed a road themselves, their choice stands.
   */
  const [openRoads, setOpenRoads] = React.useState<string[] | null>(null);
  const [openChoiceFor, setOpenChoiceFor] = React.useState("");

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

  // A new search is a new question, so the roads it matched open and any
  // earlier choice is forgotten. Adjusted during render rather than in an
  // effect, as `ConfirmDialog` and the camera form do.
  if (openChoiceFor !== needle) {
    setOpenChoiceFor(needle);
    setOpenRoads(null);
  }

  const roadIds = [...byStreet.keys()];
  const roadsOpen = openRoads ?? (needle ? roadIds : roadIds.slice(0, 1));

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
        /**
         * A road at a time, and nothing plays until one is opened.
         *
         * The old screen listed every camera as a card you had to open one by
         * one to see anything, which made "look at Camac Street" a sequence of
         * clicks rather than a glance. Expanding a road now shows its two or
         * three pictures side by side, live.
         *
         * Still not a wall of forty streams on page load, which is what the
         * gateway would have to carry if every road were open: the media server
         * pulls a camera on demand, so a closed road costs nothing and an open
         * one costs exactly the cameras somebody is looking at. Roads are opened
         * by a person, and as many as they like at once.
         */
        <Accordion
          type="multiple"
          value={roadsOpen}
          onValueChange={setOpenRoads}
          className="rounded-xl border"
        >
          {[...byStreet.entries()].map(([streetId, group]) => {
            const darkOnRoad = group.cameras.filter(
              (c) => c.status !== "ONLINE" && c.isActive,
            ).length;

            return (
              <AccordionItem key={streetId} value={streetId} className="px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 pr-2 text-left">
                    <span className="text-base font-semibold tracking-tight">{group.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {group.ward} · {group.cameras.length} camera
                      {group.cameras.length === 1 ? "" : "s"}
                    </span>
                    {/* The one fact worth carrying on a closed row: whether
                        opening it will show pictures or apologies. */}
                    {darkOnRoad > 0 ? (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-500">
                        {darkOnRoad} dark
                      </Badge>
                    ) : null}
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="grid gap-3 pb-2 sm:grid-cols-2 xl:grid-cols-3">
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
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/*
        Clicking a picture stops browsing the network and starts watching a
        street, so the picture takes the whole screen rather than opening a
        panel beside the list. Everything an operator might do to the camera
        travels with it.
      */}
      {selected ? (
        <CameraFullscreen
          camera={selected}
          siblings={(byStreet.get(selected.streetId)?.cameras ?? [selected])}
          onSelect={(camera) => setSelectedId(camera.id)}
          onClose={() => setSelectedId(null)}
          onProbe={() => void probe(selected)}
          onEdit={() => {
            setEditingId(selected.id);
            setFormOpen(true);
          }}
          probing={probing === selected.id}
        />
      ) : null}


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

/**
 * One camera on the wall: the picture, live, and everything about it in the
 * strip underneath.
 *
 * This used to be a card of text you had to open to see anything, which made
 * "look at Camac Street" a sequence of clicks. The picture is the tile now.
 * The compact player drops the transport switch and the reconnect button —
 * three sets of controls competing with three videos is noise, and both are
 * there in full screen, which is where somebody who wants them has gone.
 */
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
    <Card className={cn("group overflow-hidden py-0", !camera.isActive && "opacity-60")}>
      <CardContent className="p-0">
        <div className="relative">
          <CameraPlayer camera={camera} compact />

          {/*
            The click target is the picture, which is what somebody reaches for.
            It sits over the video rather than wrapping it, because a <button>
            around a <video> swallows the player's own controls — and it steps
            aside for them in full screen, where those controls are the point.
          */}
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Watch ${camera.code} full screen`}
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/25 focus-visible:bg-black/25 focus-visible:outline-none"
          >
            <span className="rounded-full bg-black/60 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Maximize2 className="size-4" aria-hidden />
            </span>
          </button>
        </div>

        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{camera.code}</span>
              {/* Status is a dot and a word, never a dot alone. */}
              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                <span
                  className={cn("size-1.5 rounded-full", STATUS_STYLE[camera.status])}
                  aria-hidden
                />
                {camera.isActive ? CAMERA_STATUS_LABELS[camera.status] : "Out of service"}
              </span>
            </div>
            <p className="truncate text-sm font-medium leading-snug">{camera.label}</p>
          </div>

          <Can permission="camera.manage">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={`Actions for ${camera.code}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onOpen}>
                  <Maximize2 className="size-4" aria-hidden />
                  Watch full screen
                </DropdownMenuItem>
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
        </div>
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
