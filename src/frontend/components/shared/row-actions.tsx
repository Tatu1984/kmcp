"use client";

import * as React from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";

export type RowAction = {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** Renders a nested submenu instead of a plain item. */
  children?: RowAction[];
  separatorBefore?: boolean;
};

/**
 * The "⋯" menu used on every table row in the portal. One component so the
 * placement, keyboard behaviour and destructive styling never drift.
 */
export function RowActions({
  label = "Actions",
  actions,
  align = "end",
  trigger,
  className,
}: {
  label?: string;
  actions: RowAction[];
  align?: "start" | "end" | "center";
  trigger?: React.ReactNode;
  className?: string;
}) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8 text-muted-foreground data-[state=open]:bg-accent", className)}
            aria-label="Open row actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
        {visible.map((action, i) => (
          <React.Fragment key={`${action.label}-${i}`}>
            {action.separatorBefore && <DropdownMenuSeparator />}
            {action.children ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={action.disabled}>
                  {action.icon && <action.icon className="size-4" />}
                  {action.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {action.children
                    .filter((c) => !c.hidden)
                    .map((child, j) => (
                      <DropdownMenuItem
                        key={`${child.label}-${j}`}
                        onSelect={child.onSelect}
                        disabled={child.disabled}
                        variant={child.destructive ? "destructive" : "default"}
                      >
                        {child.icon && <child.icon className="size-4" />}
                        {child.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem
                onSelect={action.onSelect}
                disabled={action.disabled}
                variant={action.destructive ? "destructive" : "default"}
              >
                {action.icon && <action.icon className="size-4" />}
                {action.label}
                {action.shortcut && <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>}
              </DropdownMenuItem>
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
