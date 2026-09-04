"use client";

import * as React from "react";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import type { PermissionKey } from "@/shared/constants/roles";

/**
 * Renders its children only for an account that holds the permission.
 *
 * Use this for whole sections and page-level controls. Table row menus have
 * their own gate — `RowAction.permission` — so a menu item can be *disabled
 * with a reason* rather than removed, which is usually the better answer for a
 * consequential action: a Zone Officer should be able to see that settlement
 * approval exists and is not theirs, rather than wonder where it went.
 *
 * `fallback` is for the cases where something must still occupy the space —
 * an explanation, or a read-only rendering of what the control would have done.
 */
export function Can({
  permission,
  any,
  all,
  fallback = null,
  children,
}: {
  /** A single permission. Shorthand for `all={[permission]}`. */
  permission?: PermissionKey;
  /** Renders when the account holds at least one of these. */
  any?: PermissionKey[];
  /** Renders when the account holds every one of these. */
  all?: PermissionKey[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAny, canAll } = usePermissions();

  const allowed =
    (permission ? can(permission) : true) &&
    (any?.length ? canAny(...any) : true) &&
    (all?.length ? canAll(...all) : true);

  return <>{allowed ? children : fallback}</>;
}

/**
 * The reason a control is disabled, phrased for the person reading it.
 *
 * Kept here so every screen says the same thing. "Forbidden" is what the API
 * says; this is what an officer should be told.
 */
export const NOT_PERMITTED = "Your role does not permit this.";
