"use client";

import * as React from "react";
import { CircleAlert, PlugZap, RefreshCw, VideoOff, Zap } from "lucide-react";

import { camerasApi, CAMERA_STATUS_LABELS, type ApiCamera } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { Button } from "@/frontend/components/ui/button";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * One camera's picture.
 *
 * The server is asked where to play from rather than the client building a URL,
 * and what comes back never carries a credential: it addresses the streaming
 * gateway, which holds the connection to the camera. That indirection is the
 * entire security model of this screen — a viewer who reads the network tab
 * finds an address for a stream they were already allowed to watch, and nothing
 * that would let them reach the camera itself.
 *
 * Two transports, because they answer different questions:
 *
 *   HLS is a playlist of a few seconds of video at a time. It plays in every
 *   browser, survives a poor connection, and is five to fifteen seconds behind
 *   the street. Right for "what does Camac Street look like".
 *
 *   WebRTC is a peer connection negotiated over WHEP. Under a second behind,
 *   and worth the extra machinery when somebody is watching an incident happen
 *   or driving a PTZ camera, where a five-second lag makes the controls
 *   unusable.
 *
 * HLS is the default and WebRTC is a switch, rather than the other way round,
 * because the failure modes of the two are not symmetric: HLS that struggles
 * buffers, and WebRTC that struggles through a municipal firewall shows
 * nothing at all.
 *
 * What this deliberately does not do is show a black rectangle. A dark player
 * is indistinguishable from a broken one, and "this camera is offline",
 * "nobody has deployed the video service" and "you may not watch this street"
 * are three completely different jobs.
 */

type Transport = "HLS" | "WEBRTC";

export function CameraPlayer({
  camera,
  className,
  /**
   * A tile in a wall of cameras rather than the one somebody opened.
   *
   * Drops the transport switch, the reconnect button and the line of prose
   * under the picture — on a grid of three they would be three sets of
   * controls competing with the video, and the choice they offer is one you
   * make about a camera you are actually watching. Full screen has them all.
   */
  compact = false,
}: {
  camera: ApiCamera;
  className?: string;
  compact?: boolean;
}) {
  const [transport, setTransport] = React.useState<Transport>("HLS");

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
          {camera.probeError
            ? camera.probeError
            : camera.lastSeenAt
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
          {data.reason === "NOT_PERMITTED"
            ? "Not yours to watch"
            : data.reason === "NO_SOURCE"
              ? "No stream address"
              : data.reason === "OUT_OF_SERVICE"
                ? "Out of service"
                : "No video service yet"}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {data.detail ??
            "This camera is registered and the screens are built, but nothing is serving its picture yet."}
        </p>
      </>,
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {transport === "HLS" ? (
        <HlsVideo key={`hls-${data.hlsUrl}`} url={data.hlsUrl!} ready={data.ready} compact={compact} />
      ) : (
        <WhepVideo key={`whep-${data.webrtcUrl}`} url={data.webrtcUrl!} ready={data.ready} compact={compact} />
      )}

      {compact ? null : (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {transport === "HLS"
            ? "Playing over HLS — a few seconds behind."
            : "Playing over WebRTC — under a second behind."}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void playback.refetch()}
            disabled={playback.isFetching}
          >
            <RefreshCw
              className={cn("size-3.5", playback.isFetching && "animate-spin")}
              aria-hidden
            />
            Reconnect
          </Button>
          <Button
            variant={transport === "WEBRTC" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTransport((t) => (t === "HLS" ? "WEBRTC" : "HLS"))}
          >
            <Zap className="size-3.5" aria-hidden />
            {transport === "HLS" ? "Low latency" : "Back to HLS"}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

/** Shared chrome so both transports fail and load the same way. */
function Surface({
  children,
  message,
}: {
  children: React.ReactNode;
  message?: { title: string; detail: string };
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
      {children}
      {message ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 p-6 text-center">
          <p className="text-sm font-medium text-white">{message.title}</p>
          <p className="max-w-sm text-xs text-white/70">{message.detail}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * HLS, using the browser's own player where it has one.
 *
 * Safari and iOS play HLS natively, so there the `<video>` element is the whole
 * implementation. Everywhere else needs hls.js, which is loaded on demand: it
 * is a few hundred kilobytes, and every other screen in this portal would
 * otherwise carry it to show a table.
 */
function HlsVideo({ url, ready, compact }: { url: string; ready: boolean; compact?: boolean }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [waiting, setWaiting] = React.useState(!ready);

  React.useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    setError(null);
    setWaiting(true);

    /**
     * hls.js first, native second, and that order is the whole fix for a bug
     * this got wrong.
     *
     * The obvious test — `canPlayType("application/vnd.apple.mpegurl")` — is a
     * trap. Chromium answers "maybe" and then cannot demux the stream: the
     * element reached readyState 4 with `DEMUXER_ERROR_COULD_NOT_PARSE` on it,
     * `play()` rejected with "the element has no supported sources", and the
     * tile sat on a black frame at 0:00 looking exactly like a camera that was
     * not sending anything.
     *
     * Media Source Extensions is the capability that actually matters, and
     * `Hls.isSupported()` tests for it. Where it is missing — iOS, where every
     * browser is Safari's engine and MSE is not offered — HLS plays natively,
     * so that branch is the fallback rather than the fast path.
     */
    void (async () => {
      try {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;

        if (!Hls.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            void video.play().catch(() => undefined);
            destroy = () => {
              video.removeAttribute("src");
              video.load();
            };
            return;
          }
          setError("This browser cannot play the stream.");
          return;
        }

        const hls = new Hls({
          // The gateway pulls on demand, so the first request for a camera
          // nobody is watching arrives before there is a playlist. Retrying is
          // the normal path rather than an error path.
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1000,
          // Small buffer: this is live video and being thirty seconds behind
          // is worse than a rebuffer.
          liveSyncDurationCount: 3,
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setWaiting(false);
          void video.play().catch(() => undefined);
        });

        hls.on(Hls.Events.ERROR, (_event, payload) => {
          if (!payload.fatal) return;
          if (payload.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Usually the gateway still opening the camera. Ask again.
            hls.startLoad();
            return;
          }
          if (payload.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          setError("The stream stopped and could not be recovered.");
          hls.destroy();
        });

        hls.loadSource(url);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      } catch {
        if (!cancelled) setError("The video player could not be loaded.");
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  return (
    <Surface
      message={
        error
          ? { title: "No picture", detail: error }
          : waiting
            ? {
                title: "Connecting to the camera",
                detail:
                  "The gateway opens a camera when somebody asks to watch it, so the first few seconds are normal.",
              }
            : undefined
      }
    >
      <video
        ref={ref}
        className="size-full object-contain"
        muted
        playsInline
        autoPlay
        /**
         * No scrub bar on a tile in a wall of three. It is a live stream, so
         * the timeline means nothing, and the control strip covered a third of
         * a picture somebody is trying to glance at. Full screen has controls,
         * which is where anybody who wants them has gone.
         */
        controls={!compact}
        /**
         * Autoplay, tried more than once.
         *
         * `autoPlay` alone left tiles sitting on their first frame at 0:00: the
         * gateway opens a camera on demand, so the element is attached long
         * before there is anything to play, and the browser's own attempt has
         * been and gone by the time data arrives. `canPlay` fires when there
         * is, which is the moment worth asking again.
         */
        onCanPlay={(event) => void event.currentTarget.play().catch(() => undefined)}
        onPlaying={() => setWaiting(false)}
      />
    </Surface>
  );
}

/**
 * WebRTC over WHEP, which is a single POST.
 *
 * WHEP standardises what used to be a bespoke signalling dance: the browser
 * offers an SDP, the server answers with one, and the peer connection is up.
 * No library, no socket, no dependency — the whole client is the forty lines
 * below, which is why the low-latency path is worth offering at all.
 */
function WhepVideo({ url, ready, compact }: { url: string; ready: boolean; compact?: boolean }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [waiting, setWaiting] = React.useState(!ready);

  React.useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let cancelled = false;
    setError(null);
    setWaiting(true);

    const peer = new RTCPeerConnection({
      // A public STUN server is enough where the gateway is publicly
      // addressable. A deployment behind carrier NAT needs a TURN server, and
      // that is a piece of infrastructure rather than a line of code.
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });

    peer.ontrack = (event) => {
      video.srcObject = event.streams[0];
      setWaiting(false);
      void video.play().catch(() => undefined);
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed") {
        setError("The low-latency connection could not be established. Switch back to HLS.");
      }
    };

    void (async () => {
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/sdp" },
          body: offer.sdp,
        });

        if (!response.ok) {
          throw new Error(`the gateway answered ${response.status}`);
        }

        const answer = await response.text();
        if (cancelled) return;
        await peer.setRemoteDescription({ type: "answer", sdp: answer });
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? `Could not start the low-latency stream: ${cause.message}.`
            : "Could not start the low-latency stream.",
        );
      }
    })();

    return () => {
      cancelled = true;
      peer.close();
      video.srcObject = null;
    };
  }, [url]);

  return (
    <Surface
      message={
        error
          ? { title: "No picture", detail: error }
          : waiting
            ? {
                title: "Negotiating a direct connection",
                detail: "WebRTC needs a moment to find a route to the gateway.",
              }
            : undefined
      }
    >
      <video
        ref={ref}
        className="size-full object-contain"
        muted
        playsInline
        autoPlay
        controls={!compact}
        onCanPlay={(event) => void event.currentTarget.play().catch(() => undefined)}
        onPlaying={() => setWaiting(false)}
      />
    </Surface>
  );
}
