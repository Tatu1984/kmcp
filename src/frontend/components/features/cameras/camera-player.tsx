"use client";

import * as React from "react";
import { CircleAlert, PlugZap, Video, VideoOff } from "lucide-react";

import { camerasApi, CAMERA_STATUS_LABELS, type ApiCamera } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * One camera's picture.
 *
 * There is no streaming gateway yet, and this component is the seam where one
 * will land. It asks the server where to play from and renders whatever comes
 * back; today that is always `available: false` with a reason, and the day a
 * gateway exists it becomes a signed URL and a protocol. Nothing above this
 * component needs to know the difference, which is the point of putting the
 * question to the server rather than building a URL on the client.
 *
 * What it deliberately does not do is show a black rectangle. A dark player is
 * indistinguishable from a broken one, and the difference between "this camera
 * is offline", "nobody has deployed the video service" and "you may not watch
 * this street" is the difference between three entirely different jobs.
 */
export function CameraPlayer({
  camera,
  className,
}: {
  camera: ApiCamera;
  className?: string;
}) {
  const playback = useApiQuery(["camera", camera.id, "playback"], () =>
    camerasApi.playback(camera.id).then((r) => r.data),
  );

  const frame = (children: React.ReactNode) => (
    <div
      className={cn(
        "flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 p-6 text-center",
        className,
      )}
    >
      {children}
    </div>
  );

  if (playback.isLoading) {
    return <Skeleton className={cn("aspect-video w-full rounded-lg", className)} />;
  }

  // The camera itself is dark. Say when it was last seen — "offline" without a
  // time is a fact nobody can act on, and the gap is what tells an engineer
  // whether this is a blip or a fortnight.
  if (camera.status !== "ONLINE") {
    return frame(
      <>
        <VideoOff className="size-7 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">{CAMERA_STATUS_LABELS[camera.status]}</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {camera.lastSeenAt
            ? `Last seen ${new Date(camera.lastSeenAt).toLocaleString("en-IN")}.`
            : "This camera has never been heard from since it was registered."}
        </p>
      </>,
    );
  }

  const data = playback.data;

  if (playback.isError || !data) {
    return frame(
      <>
        <CircleAlert className="size-7 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Could not ask about this camera</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          The camera reports itself online, so this is the portal or the API rather than the
          hardware.
        </p>
      </>,
    );
  }

  if (!data.available) {
    return frame(
      <>
        <PlugZap className="size-7 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          {data.reason === "NOT_PERMITTED" ? "Not yours to watch" : "No video service yet"}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {data.detail ??
            "This camera is registered and the screens are built, but nothing is serving its picture yet."}
        </p>
      </>,
    );
  }

  /**
   * The live path, which no deployment reaches today.
   *
   * Left as a single branch on purpose: when a gateway lands, an HLS player
   * goes here for `protocol === "HLS"` and a WebRTC one beside it, and every
   * screen that embeds this component is already finished.
   */
  return frame(
    <>
      <Video className="size-7 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">Stream ready</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        {data.protocol} playback is available for this camera. The player has not been wired
        up yet — this is the seam it drops into.
      </p>
    </>,
  );
}
