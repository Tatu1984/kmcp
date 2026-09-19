"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CarFront,
  CircleCheck,
  Grid3x3,
  ShieldAlert,
  SquareStack,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Label } from "@/frontend/components/ui/label";
import { Switch } from "@/frontend/components/ui/switch";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { ZoneScopeBadge } from "@/frontend/components/shared/zone-scope";
import { ElapsedTime, LiveClockProvider } from "@/frontend/components/shared/live-clock";
import { Plate, SectionCard } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { SessionDetailSheet } from "@/frontend/components/features/sessions/session-detail-sheet";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { useResource } from "@/frontend/hooks/use-api";
import { SESSIONS, SLOTS, ZONES } from "@/frontend/lib/mock";
import { sessionsApi, slotsApi, zonesApi, listAll } from "@/frontend/api";
import { toSession, toSlot } from "@/frontend/lib/adapters";
import { buildBayBoard, MISMATCH_COPY, type Bay } from "@/frontend/lib/bay-board";
import { LIST_POLL_MS, isSessionLive } from "@/frontend/lib/live";
import { ROUTES } from "@/shared/constants/routes";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import { isLiveApi } from "@/config/env";
import type { ParkingSession, Slot } from "@/shared/types/domain.types";

/**
 * Which bay holds which vehicle, and for how long.
 *
 * The gap this fills was the largest one in the portal: nothing joined a bay to
 * its occupant. The bay map on the Slots screen colours a tile by status, so it
 * can say "occupied" and nothing more — not the registration number, not how
 * long the car has been there, not which session to open if a citizen rings up
 * about it. An officer had to read the bay code off one screen and search for it
 * on another.
 *
 * ## Why a separate screen rather than a tab on Slots
 *
 * Permissions decide it. `GET /slots` is guarded on `zone.read`; `GET /sessions`
 * is guarded on `session.read`, and the two grants are held by different roles.
 * A tab inside the Slots page would put a panel that needs `session.read`
 * behind a page gated on `zone.read` — so an account holding only the latter
 * would open the page it is entitled to and find a tab that answers 403. As its
 * own destination it declares the grant it actually needs and `RouteGuard`
 * enforces it before anything renders.
 *
 * Two further reasons, less decisive but pointing the same way: this screen is
 * inherently per-zone, where Slots defaults to every zone at once, and it
 * polls, which Slots does not need to. The Slots page links here and this links
 * back.
 */
/** Every bay in one zone. */
function fetchZoneBays(zoneId: string): Promise<Slot[]> {
  return listAll((page, pageSize) => slotsApi.list({ zoneId, page, pageSize })).then((r) =>
    r.map(toSlot),
  );
}

/**
 * Every vehicle currently parked in one zone.
 *
 * Two requests, because the API takes one status at a time — `status` is a
 * `z.nativeEnum`, so a comma-separated or repeated value is a 400, not a union.
 *
 * And both statuses, because a background sweep rewrites a long-running
 * session's status from ACTIVE to OVERSTAY in place. Asking for ACTIVE alone
 * would drop every car that has been parked too long, which is precisely the
 * set of vehicles this board exists to surface.
 */
function fetchParkedSessions(zoneId: string): Promise<ParkingSession[]> {
  return Promise.all([
    listAll((page, pageSize) => sessionsApi.list({ zoneId, status: "ACTIVE", page, pageSize })),
    listAll((page, pageSize) => sessionsApi.list({ zoneId, status: "OVERSTAY", page, pageSize })),
  ]).then(([active, overstaying]) => [...active, ...overstaying].map(toSession));
}

export function BayBoardView() {
  const params = useSearchParams();
  const zoneParam = params.get("zone");
  const { isZoneScoped, zoneIds } = usePermissions();

  /** See the note on the sessions table: on by default, off in demo mode. */
  const [polling, setPolling] = React.useState(true);
  const [selected, setSelected] = React.useState<ParkingSession | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const { items: zones } = useResource<{ id: string; code: string; name: string }>(
    ["zones", "bay-board"],
    () =>
      listAll((page, pageSize) => zonesApi.list({ page, pageSize })).then((r) =>
        r.map((z) => ({ id: z.id, code: z.code, name: z.name })),
      ),
    ZONES.map((z) => ({ id: z.id, code: z.code, name: z.name })),
  );

  /**
   * A board is always of one zone, so unlike the Slots screen there is no "all
   * zones" option — two hundred tiles from four different streets is not a
   * board, it is a list. The URL wins if it names a zone, otherwise the first
   * zone the account can see.
   */
  const [chosen, setChosen] = React.useState(zoneParam ?? "");
  const zoneId = chosen || zones[0]?.id || "";
  const zone = zones.find((z) => z.id === zoneId);

  /**
   * A zone-scoped officer who followed a link to somebody else's zone.
   *
   * The API would refuse both requests below and the screen would report two
   * empty lists, which reads as a quiet car park rather than as a zone that is
   * not theirs. `zoneIds` from the principal answers it before either request
   * is made. Unscoped accounts and demo mode are unaffected — `zoneIds` is
   * empty for both.
   */
  const outOfScope = isZoneScoped && zoneIds.length > 0 && zoneId !== "" && !zoneIds.includes(zoneId);
  const enabled = zoneId !== "" && !outOfScope;
  const refetchInterval = polling ? LIST_POLL_MS : false;

  const bays = useResource<Slot>(
    ["slots", "bay-board", zoneId],
    () => fetchZoneBays(zoneId),
    SLOTS,
    { enabled, refetchInterval },
  );

  const sessions = useResource<ParkingSession>(
    ["sessions", "bay-board", zoneId],
    () => fetchParkedSessions(zoneId),
    SESSIONS,
    { enabled, refetchInterval },
  );

  /**
   * Narrowed to the chosen zone here as well as in the request.
   *
   * Against the API this is a no-op — both queries already asked for one zone.
   * Without one it is the whole of the filtering, because `useResource` seeds
   * its demo list once at mount and cannot re-seed it when the picker changes.
   * Doing it in both modes keeps one code path instead of a branch.
   */
  const board = React.useMemo(() => {
    const zoneBays = bays.items.filter((bay) => bay.zoneId === zoneId);
    const zoneSessions = sessions.items.filter(
      (session) => session.zoneId === zoneId && isSessionLive(session.status),
    );
    return buildBayBoard(zoneBays, zoneSessions);
  }, [bays.items, sessions.items, zoneId]);

  const openSession = (session: ParkingSession) => {
    setSelected(session);
    setSheetOpen(true);
  };

  const isLoading = bays.isLoading || sessions.isLoading;
  const emptyReason = bays.emptyReason ?? sessions.emptyReason;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bay board"
        meta={<ZoneScopeBadge />}
        description="Every bay in one zone, and the vehicle standing in it. Occupancy is joined to live sessions in the browser — the API has no endpoint that returns the two together."
        actions={
          <>
            {isLiveApi && (
              <div className="flex items-center gap-2 pr-1">
                <span className="relative flex size-2" aria-hidden>
                  {polling && (
                    <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-emerald-500" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex size-2 rounded-full",
                      polling ? "bg-emerald-500" : "bg-muted-foreground/50",
                    )}
                  />
                </span>
                <Label htmlFor="board-live" className="text-xs text-muted-foreground">
                  {polling ? "Live" : "Paused"}
                </Label>
                <Switch id="board-live" checked={polling} onCheckedChange={setPolling} />
              </div>
            )}
            <Select value={zoneId} onValueChange={setChosen}>
              <SelectTrigger size="sm" className="h-9 w-56">
                <SelectValue placeholder="Choose a zone" />
              </SelectTrigger>
              <SelectContent>
                {/* The same scoped list every other screen picks from:
                    `GET /zones` already answers with this account's allocation
                    and nothing else. */}
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.code} · {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link href={ROUTES.slots}>
                <SquareStack className="size-4" /> All bays
              </Link>
            </Button>
          </>
        }
      />

      {outOfScope ? (
        <EmptyState
          icon={ShieldAlert}
          title="That zone is not one of yours"
          description="Your account is limited to the zones named beside the title. Pick one of those to see its board."
        />
      ) : (
        /**
         * One clock for the whole board, and it doubles as the grouping this
         * branch needs — the tiles and the "parked without a bay" list below
         * them both count up, and two providers would tick on two schedules.
         * They would then straddle a minute boundary differently and report the
         * same vehicle as 41m in one section and 42m in the other, which is the
         * exact inconsistency a shared clock exists to prevent.
         *
         * A busy zone is two hundred tiles, so the other half of the reason is
         * arithmetic: one interval instead of two hundred, for figures that
         * change once a minute.
         */
        <LiveClockProvider>
          <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FadeStaggerItem>
              <StatCard
                label="Bays mapped"
                numeric={board.counts.bays}
                icon={SquareStack}
                hint={zone ? zone.name : "Choose a zone"}
              />
            </FadeStaggerItem>
            <FadeStaggerItem>
              <StatCard
                label="Vehicles parked"
                numeric={board.counts.liveSessions}
                icon={CarFront}
                accent="info"
                hint={
                  /* Sessions and occupied bays are counted separately and are
                     expected to differ — a session can be started without a
                     bay. Saying so stops the two figures reading as a
                     contradiction. */
                  board.withoutBay.length > 0
                    ? `${board.withoutBay.length} of them in no numbered bay`
                    : "All of them in a numbered bay"
                }
              />
            </FadeStaggerItem>
            <FadeStaggerItem>
              <StatCard
                label="Free"
                numeric={board.counts.free}
                icon={CircleCheck}
                accent="success"
                hint={
                  board.counts.outOfService > 0
                    ? `${board.counts.outOfService} out of service`
                    : "Every bay in service"
                }
              />
            </FadeStaggerItem>
            <FadeStaggerItem>
              <StatCard
                label="Needs reconciling"
                numeric={board.mismatches.length + board.unknownBay.length}
                icon={TriangleAlert}
                accent={board.mismatches.length + board.unknownBay.length > 0 ? "warning" : "success"}
                hint="Bays and sessions that disagree"
              />
            </FadeStaggerItem>
          </FadeStagger>

          {/* ------------------------------------------- reconciliation panel */}
          {(board.mismatches.length > 0 || board.unknownBay.length > 0) && (
            <SectionCard
              title={
                <span className="flex items-center gap-2">
                  <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
                  Bays and sessions that disagree
                </span>
              }
              description="Surfaced rather than smoothed over: each of these is a bay the city cannot sell, or a charge against the wrong space."
            >
              <ul className="divide-y divide-border/60">
                {board.mismatches.map((bay) => (
                  <li key={bay.slot.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-500/12 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      {bay.slot.code.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Bay {bay.slot.code} — {MISMATCH_COPY[bay.mismatch!].label}
                      </p>
                      <p className="text-xs text-pretty text-muted-foreground">
                        {MISMATCH_COPY[bay.mismatch!].detail}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={bay.slot.status} />
                      {bay.session && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => openSession(bay.session!)}
                        >
                          Open session
                        </Button>
                      )}
                    </div>
                  </li>
                ))}

                {board.unknownBay.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-red-500/12 text-red-700 dark:text-red-300">
                      <TriangleAlert className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {session.plateNumber} is in a bay this zone does not have
                      </p>
                      <p className="text-xs text-pretty text-muted-foreground">
                        Session {session.code} names a bay that is not in {zone?.name ?? "this zone"}
                        &apos;s list. Starting a session now refuses a bay from another zone, so this
                        is either older than that check or a bay that has been removed while the
                        vehicle was still in it.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0"
                      onClick={() => openSession(session)}
                    >
                      Open session
                    </Button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* --------------------------------------------------------- the board */}
          <SectionCard
            title={zone ? `${zone.name} · bay by bay` : "Bay by bay"}
            description="Click an occupied bay to open its session. Times count up from the arrival the server recorded."
            action={<BoardLegend />}
          >
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : board.counts.bays === 0 ? (
              <EmptyState
                icon={Grid3x3}
                title={emptyReason ? "Nothing to show" : "This zone has no numbered bays"}
                description={
                  emptyReason ??
                  "Sessions here are recorded against the zone rather than a bay, which is normal for a kerb that has never been marked out. Add bays on the Slots screen to see them here."
                }
                action={
                  emptyReason ? undefined : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${ROUTES.slots}?zone=${zoneId}`}>Add bays to this zone</Link>
                    </Button>
                  )
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {board.bays.map((bay) => (
                  <BayTile key={bay.slot.id} bay={bay} onOpen={openSession} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* ------------------------------------------- parked, but not in a bay */}
          {board.withoutBay.length > 0 && (
            <SectionCard
              title={`Parked in the zone without a numbered bay (${board.withoutBay.length})`}
              description="Not a fault. A bay is optional when a session starts, and many zones are priced for more vehicles than anyone has marked out bays for."
            >
              <ul className="divide-y divide-border/60">
                {board.withoutBay.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => openSession(session)}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-accent/40"
                    >
                      <Plate value={session.plateNumber} />
                      <span className="text-xs text-muted-foreground">
                        {VEHICLE_TYPE_LABELS[session.vehicleType]}
                      </span>
                      <StatusBadge status={session.status} pulse />
                      <span className="ml-auto text-sm">
                        <ElapsedTime
                          startAt={session.startAt}
                          fallbackMinutes={session.elapsedMinutes}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </LiveClockProvider>
      )}

      <SessionDetailSheet session={selected} open={sheetOpen} onOpenChange={setSheetOpen} />

      <div className="text-xs text-muted-foreground">
        A city-wide map of nearby lots is a separate screen and does not exist yet.{" "}
        <Link href={ROUTES.zones} className="underline-offset-2 hover:underline">
          Parking zones
        </Link>{" "}
        lists them in the meantime.
      </div>
    </div>
  );
}

/**
 * One bay.
 *
 * Colour carries the bay's status, as it does on the Slots map, with one
 * addition: an overstaying vehicle reads amber rather than the blue of an
 * ordinary occupied bay, because it is the thing an officer is scanning for.
 *
 * A mismatch is drawn as a dashed border and a corner marker rather than as
 * another colour. Deliberately a separate channel: a bay can be both
 * overstaying and mismatched, and one tile cannot be two colours.
 */
function BayTile({ bay, onOpen }: { bay: Bay; onOpen: (session: ParkingSession) => void }) {
  const { slot, session, mismatch } = bay;
  const overstaying = Boolean(session?.isOverstay);

  const tone = session
    ? overstaying
      ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20"
      : "border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20"
    : slot.status === "OCCUPIED"
      ? // Marked occupied with nothing in it. Not drawn as a busy bay, because
        // it is not one, and not drawn as free either — nobody can park here.
        "border-muted-foreground/30 bg-muted/40"
      : slot.status === "RESERVED"
        ? "border-violet-500/40 bg-violet-500/10"
        : slot.status === "OUT_OF_SERVICE"
          ? "border-red-500/35 bg-red-500/10"
          : "border-emerald-500/35 bg-emerald-500/[0.07]";

  return (
    <button
      type="button"
      // Only an occupied bay has somewhere to go. A free one is not a disabled
      // control in the sense that something is being withheld — there is simply
      // no session behind it — so it is marked as such for a screen reader and
      // left un-hoverable rather than looking broken.
      disabled={!session}
      aria-label={
        session
          ? `Bay ${slot.code}, ${session.plateNumber}, open session`
          : `Bay ${slot.code}, ${slot.status.replace(/_/g, " ").toLowerCase()}`
      }
      onClick={() => session && onOpen(session)}
      className={cn(
        "relative flex h-24 flex-col items-start gap-1 rounded-lg border p-2 text-left transition-all",
        tone,
        mismatch && "border-dashed ring-1 ring-amber-500/40",
        session ? "cursor-pointer hover:scale-[1.02]" : "cursor-default",
      )}
      title={
        mismatch
          ? `${MISMATCH_COPY[mismatch].label} — ${MISMATCH_COPY[mismatch].detail}`
          : `${VEHICLE_TYPE_LABELS[slot.type]} · ${slot.status.replace(/_/g, " ").toLowerCase()}`
      }
    >
      <div className="flex w-full items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-semibold">{slot.code}</span>
        {mismatch && (
          <TriangleAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      {session ? (
        <>
          <Plate value={session.plateNumber} className="max-w-full truncate px-1 py-0 text-[10px]" />
          <span
            className={cn(
              "text-xs font-medium",
              overstaying ? "text-amber-700 dark:text-amber-300" : "text-sky-700 dark:text-sky-300",
            )}
          >
            <ElapsedTime startAt={session.startAt} fallbackMinutes={session.elapsedMinutes} />
          </span>
          {overstaying && (
            <Badge
              variant="outline"
              className="h-4 border-amber-500/40 px-1 text-[9px] text-amber-700 dark:text-amber-300"
            >
              overstay
            </Badge>
          )}
        </>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">
            {slot.status === "AVAILABLE"
              ? "Free"
              : slot.status === "OCCUPIED"
                ? "No session"
                : slot.status === "RESERVED"
                  ? "Held back"
                  : "Out of service"}
          </span>
          <span className="mt-auto truncate text-[9px] text-muted-foreground opacity-80">
            {VEHICLE_TYPE_LABELS[slot.type]}
          </span>
        </>
      )}
    </button>
  );
}

function BoardLegend() {
  const keys: { label: string; className: string }[] = [
    { label: "Free", className: "bg-emerald-500/40" },
    { label: "Parked", className: "bg-sky-500/50" },
    { label: "Overstaying", className: "bg-amber-500/60" },
    { label: "Held back", className: "bg-violet-500/50" },
    { label: "Out of service", className: "bg-red-500/50" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {keys.map((key) => (
        <span key={key.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("size-2 rounded-sm", key.className)} />
          {key.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <TriangleAlert className="size-2.5 text-amber-600 dark:text-amber-400" />
        Disagrees
      </span>
    </div>
  );
}
