"use client";

import * as React from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { NOT_PERMITTED } from "./can";
import type { PermissionKey } from "@/shared/constants/roles";
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
  /**
   * The permission this action needs. Resolved by the component rather than at
   * the call site, so gating cannot be forgotten in one of the twenty-seven
   * menus — a `permission` that is simply omitted is the only way to opt out,
   * and that omission is visible in review.
   *
   * An action the account may not perform is shown disabled, not removed: an
   * officer should learn what the platform does and where their authority
   * stops, rather than see a menu that quietly differs from a colleague's.
   * Pass `hideWhenDenied` for the few cases where its mere presence would
   * mislead.
   */
  permission?: PermissionKey;
  hideWhenDenied?: boolean;
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
  const { can, isReady } = usePermissions();

  /**
   * Denied actions are disabled and explained; only those explicitly marked
   * `hideWhenDenied` disappear. While the principal is still loading `can()`
   * answers false, so every permissioned action is briefly disabled — which is
   * the safe direction to be wrong in.
   */
  const resolve = (action: RowAction): RowAction => {
    if (!action.permission || can(action.permission)) return action;
    if (action.hideWhenDenied) return { ...action, hidden: true };
    return {
      ...action,
      disabled: true,
      label: isReady ? `${action.label} — ${NOT_PERMITTED}` : action.label,
    };
  };

  const visible = actions.map(resolve).filter((a) => !a.hidden);
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
                    .map(resolve)
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
