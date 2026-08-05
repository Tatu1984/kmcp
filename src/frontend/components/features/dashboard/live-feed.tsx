"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  BadgeIndianRupee,
  CalendarClock,
  CircleParking,
  Coins,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { Switch } from "@/frontend/components/ui/switch";
import { Label } from "@/frontend/components/ui/label";
import { AnimatedList, AnimatedListItem } from "@/frontend/components/reactbits";
import { Money } from "@/frontend/components/shared/bits";
import { ACTIVITY_FEED } from "@/frontend/lib/mock";
import { relativeTime } from "@/shared/utils/common.util";
import type { ActivityItem } from "@/shared/types/domain.types";

const KIND: Record<ActivityItem["kind"], { icon: LucideIcon; className: string }> = {
  session_start: { icon: CircleParking, className: "text-sky-600 bg-sky-500/10 dark:text-sky-400" },
  session_end: { icon: ArrowRightLeft, className: "text-slate-600 bg-slate-500/10 dark:text-slate-300" },
  payment: { icon: BadgeIndianRupee, className: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400" },
  incident: { icon: ShieldAlert, className: "text-red-600 bg-red-500/10 dark:text-red-400" },
  shift: { icon: CalendarClock, className: "text-amber-600 bg-amber-500/12 dark:text-amber-400" },
  settlement: { icon: Coins, className: "text-violet-600 bg-violet-500/10 dark:text-violet-400" },
};

export function LiveActivityFeed() {
  const [live, setLive] = React.useState(true);
  const [items, setItems] = React.useState<ActivityItem[]>(() => ACTIVITY_FEED.slice(0, 12));
  const cursor = React.useRef(12);

  React.useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      const next = ACTIVITY_FEED[cursor.current % ACTIVITY_FEED.length];
      cursor.current += 1;
      setItems((list) => [{ ...next, id: `${next.id}-${cursor.current}` }, ...list].slice(0, 12));
    }, 4200);
    return () => window.clearInterval(timer);
  }, [live]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            {live && (
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-emerald-500" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                live ? "bg-emerald-500" : "bg-muted-foreground/50",
              )}
            />
          </span>
          <span className="text-xs text-muted-foreground">
            {live ? "Streaming live" : "Paused"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="live-toggle" className="text-xs text-muted-foreground">
            Live
          </Label>
          <Switch id="live-toggle" checked={live} onCheckedChange={setLive} />
        </div>
      </div>

      <ScrollArea className="h-[330px] pr-3">
        <AnimatedList className="space-y-1">
          {items.map((item) => {
            const meta = KIND[item.kind];
            return (
              <AnimatedListItem key={item.id}>
                <div className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-accent/40">
                  <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", meta.className)}>
                    <meta.icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      {item.amount !== undefined && (
                        <Money value={item.amount} className="shrink-0 text-sm font-medium" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
                    {relativeTime(item.at)}
                  </span>
                </div>
              </AnimatedListItem>
            );
          })}
        </AnimatedList>
      </ScrollArea>

      <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" asChild>
        <Link href="/sessions">Open the full session log</Link>
      </Button>
    </div>
  );
}
