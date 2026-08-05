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
import { NOTIFICATIONS } from "@/frontend/lib/mock";
import { relativeTime } from "@/shared/utils/common.util";
import type { NotificationItem } from "@/shared/types/domain.types";

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
  const [items, setItems] = React.useState<NotificationItem[]>(NOTIFICATIONS);
  const [open, setOpen] = React.useState(false);
  const unread = items.filter((n) => !n.read).length;

  const markAll = () => {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const markOne = (id: string) => setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const dismiss = (id: string) => {
    const item = items.find((n) => n.id === id);
    setItems((list) => list.filter((n) => n.id !== id));
    toast("Notification dismissed", {
      description: item?.title,
      action: { label: "Undo", onClick: () => setItems(NOTIFICATIONS) },
    });
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
          {items.length === 0 ? (
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
