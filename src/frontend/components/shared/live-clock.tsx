"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CLOCK_TICK_MS, elapsedMinutesSince } from "@/frontend/lib/live";
import { formatDuration } from "@/shared/utils/common.util";

/**
 * One clock, shared by every ticking figure on a screen.
 *
 * The obvious way to make a duration count up is a `setInterval` inside the
 * component that shows it. On a table of running sessions that is one timer per
 * row — twenty-five timers on a page, each waking the main thread on its own
 * schedule, each needing its own cleanup, and all of them showing a slightly
 * different "now". A bay board is worse: a busy zone is two hundred tiles.
 *
 * So the interval lives here, once, and the current time is handed down through
 * context. Only the components that read it re-render: `children` is the same
 * element reference across this provider's own state updates, so React skips
 * reconciling the subtree and visits just the consumers.
 *
 * The clock starts at zero and is set from an effect rather than initialised
 * with `Date.now()`. That is deliberate. These are client components that Next
 * still renders on the server, and a time read during render is a time the
 * server and the browser disagree about — the hydration mismatch that produces
 * is real, if rare, and the fix is not to render a clock reading until there is
 * a client to read it. Until the first tick, `useLiveClock()` returns 0 and
 * consumers fall back to the figure the server sent with the row.
 */
const LiveClockContext = React.createContext<number>(0);

/** Milliseconds since the epoch, re-read on an interval. 0 before the first tick. */
export function useLiveClock(): number {
  return React.useContext(LiveClockContext);
}

export function LiveClockProvider({
  children,
  intervalMs = CLOCK_TICK_MS,
  /**
   * Stops the clock. A paused screen should stop ticking as well as stop
   * fetching: a duration that keeps climbing while the data behind it is frozen
   * is worse than one that visibly stopped, because only the second is honest
   * about being out of date.
   */
  enabled = true,
}: {
  children: React.ReactNode;
  intervalMs?: number;
  enabled?: boolean;
}) {
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;

    /**
     * A first reading straight away, so a freshly mounted screen is not
     * showing the server's figure for a whole interval before it starts
     * counting, and then one per interval after that.
     *
     * The first reading goes through a zero-delay timeout rather than being
     * written here in the effect body. Writing it directly is a synchronous
     * setState during an effect — a cascading render, which the React Compiler
     * refuses and is right to. Reading a clock is subscribing to an external
     * system, and the sanctioned shape for that is exactly this: set up the
     * subscription, let its callbacks do the updating.
     *
     * Both are cleared on unmount and whenever the clock is paused. An
     * interval that outlives the screen which started it is the leak this
     * component exists to make impossible.
     */
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs]);

  return <LiveClockContext.Provider value={now}>{children}</LiveClockContext.Provider>;
}

/**
 * How long a vehicle has been parked, counting up.
 *
 * `fallbackMinutes` is what the server said when the row was fetched. It is
 * shown before the first client tick and whenever the clock is paused, so this
 * never renders a blank and never renders a figure it made up: either it is
 * counting, or it is showing the server's own number.
 */
export function ElapsedTime({
  startAt,
  fallbackMinutes,
  className,
}: {
  startAt: string;
  fallbackMinutes?: number;
  className?: string;
}) {
  const now = useLiveClock();
  const minutes = now === 0 ? fallbackMinutes : elapsedMinutesSince(startAt, now);

  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {minutes === undefined ? "—" : formatDuration(minutes)}
    </span>
  );
}
