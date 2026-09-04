"use client";

import * as React from "react";
import { useSession } from "@/frontend/hooks/use-session";
import { ALL_PERMISSIONS, type PermissionKey } from "@/shared/constants/roles";
import { isLiveApi } from "@/config/env";

/**
 * What the signed-in account may do.
 *
 * The API has always decided this correctly — 165 of its routes carry a
 * permission guard, and the services re-assert zone scope on the rows they
 * touch. This is the portal agreeing with it *before* the click, so an Auditor
 * is never offered "Approve settlement" only to be told no by a red toast.
 *
 * Two rules make it safe to use anywhere:
 *
 * `can()` denies while the principal is still loading. A control that flickers
 * on and then disappears is worse than one that appears a moment late, and a
 * permission check that defaults to "allow" is a bug waiting for a slow
 * network. Callers that need to distinguish "not yet" from "no" read `isReady`.
 *
 * Demo mode grants everything. With no API configured there is no principal to
 * resolve, and the walkthrough exists to show the whole product.
 */
export interface Permissions {
  /** True when this account holds the permission. False while still loading. */
  can: (permission: PermissionKey) => boolean;
  /** True when the account holds at least one of them. */
  canAny: (...permissions: PermissionKey[]) => boolean;
  /** True when the account holds all of them. */
  canAll: (...permissions: PermissionKey[]) => boolean;
  /** False until the principal has resolved. Gate skeletons on this. */
  isReady: boolean;
  /** True when this account may only operate inside `zoneIds`. */
  isZoneScoped: boolean;
  /** Zones the account is restricted to. Empty means unrestricted. */
  zoneIds: string[];
  /** Everything granted, for the rare screen that wants to display it. */
  granted: readonly PermissionKey[];
}

export function usePermissions(): Permissions {
  const { user, isLoading } = useSession();

  return React.useMemo<Permissions>(() => {
    if (!isLiveApi) {
      return {
        can: () => true,
        canAny: () => true,
        canAll: () => true,
        isReady: true,
        isZoneScoped: false,
        zoneIds: [],
        granted: ALL_PERMISSIONS,
      };
    }

    // `permissions` is undefined until /auth/me answers, which is a different
    // thing from an account that holds none. Only the latter is a real empty.
    const granted = user?.permissions;
    const isReady = !isLoading && granted !== undefined;
    const held = new Set<string>(granted ?? []);

    return {
      can: (permission) => isReady && held.has(permission),
      canAny: (...permissions) => isReady && permissions.some((p) => held.has(p)),
      canAll: (...permissions) => isReady && permissions.every((p) => held.has(p)),
      isReady,
      isZoneScoped: user?.isZoneScoped ?? false,
      zoneIds: user?.zoneIds ?? [],
      granted: (granted ?? []) as readonly PermissionKey[],
    };
  }, [user, isLoading]);
}
