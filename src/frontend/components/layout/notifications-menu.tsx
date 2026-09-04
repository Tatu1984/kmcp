"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  CircleCheck,
  Info,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/frontend/components/ui/popover";
import { AnimatedList, AnimatedListItem } from "@/frontend/components/reactbits";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { NOTIFICATIONS } from "@/frontend/lib/mock";
import { isLiveApi } from "@/config/env";
import { notificationsApi, type ApiNotification } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { relativeTime } from "@/shared/utils/common.util";
import type { NotificationItem } from "@/shared/types/domain.types";

/**
 * How urgent an alert looks, inferred from its template name.
 *
 * The API stores a template and a payload rather than a severity, because
 * severity is a presentation decision and the same alert is a red banner in the
 * portal and a plain line of text in an SMS. Deriving it here keeps that
 * decision on the side that renders it.
 */
function kindOf(template: string): NotificationItem["kind"] {
  if (/variance|overstay|incident|failed|reject/.test(template)) return "alert";
  if (/pending|approval|application|capacity|expiring/.test(template)) return "warning";
  if (/published|ready|approved|paid|complete/.test(template)) return "success";
  return "info";
}

function toItem(row: ApiNotification): NotificationItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    kind: kindOf(row.template),
    href: row.href,
    createdAt: row.createdAt,
    read: row.read,
  };
}

const KIND_ICON = {
  alert: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CircleCheck,
} as const;

const KIND_CLASS = {
  alert: "text-red-600 bg-red-500/10 dark:text-red-400",
  warning: "text-amber-600 bg-amber-500/12 dark:text-amber-400",
  info: "text-sky-600 bg-sky-500/10 dark:text-sky-400",
  success: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
} as const;

export function NotificationsMenu() {
  const [open, setOpen] = React.useState(false);

  /**
   * The badge is its own request, and a much cheaper one than the list.
   *
   * The bell sits on every screen, so the count refreshes on an interval while
   * the full list is only fetched when the menu is actually opened.
   */
  const count = useApiQuery(
    ["notifications", "unread-count"],
    () => notificationsApi.unreadCount().then((r) => r.data.unread),
    { refetchInterval: 60_000, staleTime: 30_000 },
  );

  const feed = useApiQuery(
    ["notifications", "list"],
    () => notificationsApi.list({ pageSize: 25 }).then((r) => r.data.map(toItem)),
    { enabled: open },
  );

  // Demo mode keeps its own copy so the walkthrough can mark and dismiss.
  const [demo, setDemo] = React.useState<NotificationItem[]>(NOTIFICATIONS);
  const items = isLiveApi ? (feed.data ?? []) : demo;
  const unread = isLiveApi ? (count.data ?? 0) : demo.filter((n) => !n.read).length;
  const isLoading = isLiveApi && open && feed.isLoading;

  /** Refresh both the list and the badge after a write. */
  const reload = React.useCallback(() => {
    void feed.refetch();
    void count.refetch();
  }, [feed, count]);

  const markAll = () => {
    if (!isLiveApi) {
      setDemo((list) => list.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
      return;
    }
    notificationsApi
      .markAllRead()
      .then(() => {
        reload();
        toast.success("All notifications marked as read");
      })
      .catch(() => toast.error("Those could not be marked as read. Please try again."));
  };

  const markOne = (id: string) => {
    if (!isLiveApi) {
      setDemo((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
      return;
    }
    // Fire and forget: the row is being navigated away from, and a failed
    // mark-as-read is not worth interrupting that with a toast.
    notificationsApi.markRead(id).then(reload).catch(() => undefined);
  };

  const dismiss = (id: string) => {
    const item = items.find((n) => n.id === id);

    if (!isLiveApi) {
      setDemo((list) => list.filter((n) => n.id !== id));
      toast("Notification dismissed", {
        description: item?.title,
        action: { label: "Undo", onClick: () => setDemo(NOTIFICATIONS) },
      });
      return;
    }

    /**
     * No undo on the live path. Dismissing deletes the row server-side, so an
     * "Undo" button here could only re-render something that no longer exists —
     * which is exactly the kind of control this pass is removing, not adding.
     */
    notificationsApi
      .dismiss(id)
      .then(() => {
        reload();
        toast("Notification dismissed", { description: item?.title });
      })
      .catch(() => toast.error("That could not be dismissed. Please try again."));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9" aria-label="Notifications">
          <Bell className="size-4.5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-2">
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-red-500" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[24rem] p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unread} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={markAll}
              disabled={unread === 0}
              aria-label="Mark all as read"
            >
              <CheckCheck className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              asChild
              aria-label="Notification settings"
            >
              <Link href="/settings?tab=notifications" onClick={() => setOpen(false)}>
                <Settings2 className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-[22rem]">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-7 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="You are all caught up"
              description="New alerts about zones, shifts and settlements will appear here."
            />
          ) : (
            <AnimatedList className="divide-y divide-border/60">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind];
                const body = (
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                        KIND_CLASS[n.kind],
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start gap-2">
                        <p
                          className={cn(
                            "flex-1 text-sm leading-snug text-pretty",
                            !n.read && "font-medium",
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                        {n.body}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {relativeTime(n.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dismiss(n.id);
                          }}
                          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <AnimatedListItem key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => {
                          markOne(n.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "block px-3 py-3 transition-colors hover:bg-accent/50",
                          !n.read && "bg-primary/[0.035]",
                        )}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div
                        onClick={() => markOne(n.id)}
                        className={cn(
                          "cursor-default px-3 py-3 transition-colors hover:bg-accent/50",
                          !n.read && "bg-primary/[0.035]",
                        )}
                      >
                        {body}
                      </div>
                    )}
                  </AnimatedListItem>
                );
              })}
            </AnimatedList>
          )}
        </ScrollArea>

        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/audit" onClick={() => setOpen(false)}>
              View the full activity trail
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
