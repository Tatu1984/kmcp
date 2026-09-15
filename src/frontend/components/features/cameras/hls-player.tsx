"use client";

import { useEffect, useRef, useState } from "react";
import { getTokens } from "@/frontend/api/client";

interface Props {
  /** The credential-free playlist URL from the API (admin-gated on the server). */
  src: string;
  /** When false, the player stays torn down — no network, no decode. */
  active: boolean;
  autoPlay?: boolean;
  className?: string;
  onError?: (msg: string) => void;
}

type Status = "idle" | "loading" | "playing" | "error";

/**
 * Lazy, self-cleaning HLS player. Ported from the live-feed portal.
 *
 * It attaches hls.js ONLY while `active` is true, and fully destroys it when
 * `active` flips off (tile scrolled away, camera offline, viewer closed), so N
 * tiles never all decode at once and hidden tiles cost nothing.
 *
 * The one KMCP-specific addition: the API gates playback behind the admin's
 * bearer token, so every playlist/segment request carries `Authorization` via
 * hls.js `xhrSetup`. (Native Safari HLS cannot set request headers, so the MSE
 * path — hls.js — is preferred wherever it is supported.)
 */
export default function HlsPlayer({ src, active, autoPlay = true, className, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    // Set once the player is attached; removes listeners registered outside the
    // video element (which teardown alone would leave behind).
    let cleanupExtra: (() => void) | null = null;

    const teardown = () => {
      cleanupExtra?.();
      cleanupExtra = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    };

    if (!active) {
      teardown();
      // Deferred to a microtask so this is not a synchronous setState in the
      // effect body (which the lint rule forbids and React discourages).
      queueMicrotask(() => {
        if (!cancelled) setStatus("idle");
      });
      return () => {
        cancelled = true;
        teardown();
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setStatus("loading");
    });

    const authHeader = (): string | null => {
      const t = getTokens();
      return t?.accessToken ? `Bearer ${t.accessToken}` : null;
    };

    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 10,
          maxBufferLength: 15,
          // Stay near the live edge so the player never drifts back far enough
          // to request a segment the origin has already deleted (a 404 + stall).
          // The Edge Agent keeps a ~20s window plus a few extra segments; these
          // keep the player comfortably inside it.
          liveSyncDuration: 6,
          liveMaxLatencyDuration: 20,
          maxLiveSyncPlaybackRate: 1.5,
          manifestLoadingTimeOut: 8000,
          fragLoadingMaxRetry: 6,
          manifestLoadingMaxRetry: 4,
          xhrSetup: (xhr: XMLHttpRequest) => {
            const h = authHeader();
            if (h) xhr.setRequestHeader("Authorization", h);
          },
        });
        hlsRef.current = hls;

        /*
         * Jump to the live edge.
         *
         * This is a surveillance wall, not a film: the only moment worth showing
         * is now. Left alone a live player drifts backwards — every stall, tab
         * throttle or recovered network error resumes from where playback
         * stopped rather than from the present, and those setbacks accumulate
         * until the tile is minutes behind while still claiming to be live.
         * Seeking forward loses footage the operator was not watching anyway;
         * falling behind loses the footage they are.
         */
        const seekToLive = () => {
          const target = hls.liveSyncPosition;
          if (typeof target === "number" && Number.isFinite(target)) {
            if (video.currentTime < target - 1) video.currentTime = target;
            return;
          }
          // No live-sync position yet (early, or a short playlist): fall back to
          // the far end of whatever is buffered.
          const end = video.seekable.length ? video.seekable.end(video.seekable.length - 1) : 0;
          if (end > 0 && video.currentTime < end - 1) video.currentTime = end;
        };

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) video.play().catch(() => {});
        });
        video.addEventListener("playing", () => setStatus("playing"));

        // A stall is the usual way a tile slips into the past: playback halts,
        // the stream keeps advancing, and resuming where it left off is already
        // behind. Re-join at the edge instead.
        video.addEventListener("stalled", seekToLive);
        video.addEventListener("waiting", seekToLive);

        hls.on(Hls.Events.ERROR, (_evt: unknown, data: { fatal: boolean; type: string; details: string }) => {
          // Recoverable buffer stalls are reported as non-fatal; they are still
          // exactly the moment to re-join the live edge.
          if (!data.fatal) {
            if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) seekToLive();
            return;
          }
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // startLoad() resumes from the last position, which after an
              // outage is stale by however long the outage lasted. Restart at
              // the live edge so a blip costs a gap, not a permanent lag.
              hls.startLoad();
              seekToLive();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              seekToLive();
              break;
            default:
              setStatus("error");
              onError?.(`playback error: ${data.details}`);
              teardown();
          }
        });

        // A backgrounded tab is throttled hard; on return the player can be far
        // behind with a full buffer and no error to prompt a recovery.
        const onVisible = () => {
          if (document.visibilityState === "visible") seekToLive();
        };
        document.addEventListener("visibilitychange", onVisible);
        cleanupExtra = () => document.removeEventListener("visibilitychange", onVisible);
        return;
      }

      // Native HLS (Safari/iOS). Cannot attach an Authorization header, so this
      // only works where the feed is not token-gated; on desktop the MSE path
      // above is used instead.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        if (autoPlay) video.play().catch(() => {});
        video.addEventListener("playing", () => setStatus("playing"));
        return;
      }

      setStatus("error");
      onError?.("HLS is not supported in this browser");
    })();

    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, active]);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        muted
        playsInline
        controls={status === "playing"}
        style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
      />
      {status !== "playing" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#9ca3af",
            fontSize: 13,
            pointerEvents: "none",
          }}
        >
          {status === "idle" && "Idle"}
          {status === "loading" && "Connecting…"}
          {status === "error" && "Stream unavailable"}
        </div>
      )}
    </div>
  );
}
