"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Maximize2,
  Minimize2,
  Pencil,
  X,
  Zap,
} from "lucide-react";

import { CAMERA_STATUS_LABELS, type ApiCamera } from "@/frontend/api";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Can } from "@/frontend/components/shared/can";
import { CameraPlayer } from "./camera-player";
import { cn } from "@/lib/utils";

/**
 * One camera, filling the screen.
 *
 * Deliberately not a dialog. A modal would put the picture in a box inside a
 * box, which is the opposite of what somebody wants when they click a camera —
 * they have stopped browsing the network and started watching a street, and
 * everything that is not the street should get out of the way. So: a black
 * surface over the whole viewport, the picture as large as its aspect ratio
 * allows, and the chrome fading to the edges.
 *
 * Two different things are called "full screen" here and both are wanted. This
 * overlay is the app's own, which keeps the arrow keys and the camera's details;
 * the button in the corner asks the browser for real full screen on top of it,
 * which is what a control room with a wall display wants and what an operator
 * pressing F11 expects to find.
 *
 * Arrow keys walk the road. Somebody checking a junction looks at all three
 * cameras on it, and making them close, find the next tile and click it turns a
 * ten-second job into a chore.
 */
export function CameraFullscreen({
  camera,
  siblings,
  onSelect,
  onClose,
  onProbe,
  onEdit,
  probing,
}: {
  camera: ApiCamera;
  /** The other cameras on the same road, in the order the wall shows them. */
  siblings: ApiCamera[];
  onSelect: (camera: ApiCamera) => void;
  onClose: () => void;
  onProbe: () => void;
  onEdit: () => void;
  probing: boolean;
}) {
  const shellRef = React.useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = React.useState(false);
  /**
   * Everything the old side panel used to say, one press away.
   *
   * It cannot be on screen by default — the whole point of this view is the
   * picture — but it must not be lost either: when a camera is dark, "last seen
   * three weeks ago" and ffprobe's own words about why are the only things on
   * this screen worth reading.
   */
  const [showDetails, setShowDetails] = React.useState(false);

  const index = siblings.findIndex((c) => c.id === camera.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  // Keyboard: escape closes, arrows walk the road. Bound to the document
  // because the picture itself takes focus once it starts playing.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
      if (event.key === "ArrowLeft" && previous) onSelect(previous);
      if (event.key === "ArrowRight" && next) onSelect(next);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onSelect, previous, next]);

  // The browser owns its own full-screen state — the user can leave it with F11
  // or Escape without telling us — so the button reflects the event rather than
  // what it last did.
  React.useEffect(() => {
    function onChange() {
      setNativeFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // The page behind must not scroll while a camera is filling the screen.
  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function toggleNativeFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await shellRef.current?.requestFullscreen();
      }
    } catch {
      // Refused — an iframe without the permission, or a browser that does not
      // offer it. The overlay is already full-viewport, so there is nothing to
      // report and nothing to fall back to.
    }
  }

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`${camera.code}, ${camera.label}`}
    >
      <header className="flex items-start justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-white/50">{camera.code}</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-white/70">
              <span
                className={cn(
                  "size-2 rounded-full",
                  camera.status === "ONLINE" ? "bg-emerald-400" : "bg-white/40",
                )}
                aria-hidden
              />
              {CAMERA_STATUS_LABELS[camera.status]}
            </span>
          </div>
          <h2 className="truncate text-lg font-semibold text-white">{camera.label}</h2>
          <p className="truncate text-xs text-white/50">
            {camera.street.name}, {camera.street.ward.name}
            {camera.resolution ? ` · ${camera.resolution}` : ""}
            {camera.fps ? ` · ${camera.fps} fps` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Can permission="camera.manage">
            <Button
              variant="ghost"
              size="sm"
              onClick={onProbe}
              disabled={probing}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Zap className="size-4" aria-hidden />
              <span className="hidden sm:inline">{probing ? "Testing…" : "Test"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Pencil className="size-4" aria-hidden />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </Can>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails((v) => !v)}
            className={cn(
              "text-white hover:bg-white/10 hover:text-white",
              showDetails && "bg-white/15",
            )}
            aria-pressed={showDetails}
          >
            <Info className="size-4" aria-hidden />
            <span className="hidden sm:inline">Details</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void toggleNativeFullscreen()}
            className="text-white hover:bg-white/10 hover:text-white"
            aria-label={nativeFullscreen ? "Leave full screen" : "Full screen"}
          >
            {nativeFullscreen ? (
              <Minimize2 className="size-4" aria-hidden />
            ) : (
              <Maximize2 className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-6">
        {/* Sized by height so the picture fills what is available without ever
            pushing the header off the screen. */}
        <div className="w-full max-w-[min(100%,calc((100svh-11rem)*16/9))]">
          <CameraPlayer camera={camera} />
        </div>

        {showDetails ? (
          <aside className="absolute inset-y-4 right-4 w-72 overflow-y-auto rounded-xl bg-black/80 p-4 text-white backdrop-blur sm:right-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Status" value={CAMERA_STATUS_LABELS[camera.status]} />
              <Detail
                label="Last seen"
                value={
                  camera.lastSeenAt
                    ? new Date(camera.lastSeenAt).toLocaleString("en-IN")
                    : "Never"
                }
              />
              <Detail label="Make & model" value={camera.makeModel ?? "Not recorded"} />
              <Detail
                label="Installed"
                value={
                  camera.installedAt
                    ? new Date(camera.installedAt).toLocaleDateString("en-IN")
                    : "Not recorded"
                }
              />
              <Detail
                label="Picture"
                value={
                  camera.resolution
                    ? `${camera.resolution}${camera.fps ? ` · ${camera.fps} fps` : ""}`
                    : "Not tested"
                }
              />
              <Detail
                label="Bays in view"
                value={camera.coverageSlots == null ? "Not recorded" : String(camera.coverageSlots)}
              />
            </dl>

            {/* ffprobe's own words. Terse, but "401 Unauthorized" and
                "Connection refused" send an engineer to two different places,
                and paraphrasing loses exactly that. */}
            {camera.probeError ? (
              <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300">
                  Last test failed
                </p>
                <p className="mt-1 break-words font-mono text-[11px] text-white/70">
                  {camera.probeError}
                </p>
                {camera.probedAt ? (
                  <p className="mt-1 text-[11px] text-white/50">
                    {new Date(camera.probedAt).toLocaleString("en-IN")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {camera.hasIR ? (
                <Badge variant="outline" className="border-white/30 text-white">
                  Infra-red
                </Badge>
              ) : null}
              {camera.hasPTZ ? (
                <Badge variant="outline" className="border-white/30 text-white">
                  Pan, tilt, zoom
                </Badge>
              ) : null}
              {!camera.isActive ? <Badge variant="secondary">Out of service</Badge> : null}
            </div>

            {camera.street.zones.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Zones priced on this road
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {camera.street.zones.map((zone) => (
                    <Badge key={zone.id} variant="outline" className="border-white/30 text-white">
                      {zone.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}

        {previous ? (
          <Arrow side="left" label={`Previous camera, ${previous.code}`} onClick={() => onSelect(previous)} />
        ) : null}
        {next ? (
          <Arrow side="right" label={`Next camera, ${next.code}`} onClick={() => onSelect(next)} />
        ) : null}
      </div>

      {siblings.length > 1 ? (
        <footer className="flex items-center justify-center gap-2 pb-4 text-xs text-white/50">
          {camera.street.name} · camera {index + 1} of {siblings.length}
          <span className="hidden sm:inline">· arrow keys to move along the road</span>
        </footer>
      ) : null}
    </div>
  );
}

function Arrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        side === "left" ? "left-2 sm:left-6" : "right-2 sm:right-6",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-5" aria-hidden />
      ) : (
        <ChevronRight className="size-5" aria-hidden />
      )}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  );
}
