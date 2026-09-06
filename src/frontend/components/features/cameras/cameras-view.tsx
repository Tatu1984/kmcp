"use client";

import * as React from "react";
import { AlertTriangle, Cctv, Search } from "lucide-react";

import {
  camerasApi,
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
import { EmptyState } from "@/frontend/components/shared/empty-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { CameraPlayer } from "./camera-player";
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
 */
export function CamerasView() {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<ApiCamera | null>(null);

  const cameras = useApiQuery(["cameras", "list"], () =>
    camerasApi.list({ pageSize: 200 }).then((r) => r.data),
  );
  const health = useApiQuery(["cameras", "health"], () =>
    camerasApi.health().then((r) => r.data),
  );

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

  if (all.length === 0) {
    return (
      <EmptyState
        icon={Cctv}
        title="No cameras registered"
        description={
          "Cameras are filed against the road they are bolted to. Register one and it will " +
          "appear here under its street, whether or not it is streaming yet."
        }
      />
    );
  }

  const needle = query.trim().toLowerCase();
  const matching = needle
    ? all.filter(
        (c) =>
          c.code.toLowerCase().includes(needle) ||
          c.label.toLowerCase().includes(needle) ||
          c.street.name.toLowerCase().includes(needle),
      )
    : all;

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
        </div>
      ) : null}

      <div className="relative max-w-sm">
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
                  <CameraTile key={c.id} camera={c} onOpen={() => setSelected(c)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
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
                </dl>

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

function CameraTile({ camera, onOpen }: { camera: ApiCamera; onOpen: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{camera.code}</span>
          {/* Status is a dot and a word, never a dot alone. */}
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className={cn("size-2 rounded-full", STATUS_STYLE[camera.status])}
              aria-hidden
            />
            {CAMERA_STATUS_LABELS[camera.status]}
          </span>
        </div>
        <p className="text-sm font-medium leading-snug">{camera.label}</p>
        <p className="text-xs text-muted-foreground">
          {camera.status === "ONLINE"
            ? "Open to watch"
            : camera.lastSeenAt
              ? `Last seen ${new Date(camera.lastSeenAt).toLocaleDateString("en-IN")}`
              : "Never seen"}
        </p>
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
