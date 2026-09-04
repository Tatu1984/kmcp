"use client";

import { setTokens } from "@/frontend/api";
import type { Principal } from "@/frontend/api";
import type { PermissionKey, Role } from "@/shared/constants/roles";

/**
 * The portal's client-side session.
 *
 * The `kmcp_session` cookie exists so the edge proxy can bounce an unauthenticated
 * browser to /login before it downloads a dashboard it cannot use. It is a routing
 * hint, not a credential — every request that matters carries the bearer token from
 * `@/frontend/api`, and the API is the only thing that decides what a caller may see.
 */
export const SESSION_COOKIE = "kmcp_session";

const PRINCIPAL_KEY = "kmcp.principal";

/** The subset of the signed-in user the portal chrome actually renders. */
export interface SessionUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  /**
   * What this account may do, as resolved by the API.
   *
   * Undefined means "not known yet" and is deliberately distinct from an empty
   * array, which means "known, and this account may do nothing". The portal
   * must not gate on the difference being invisible: a screen that treated the
   * two alike would flash every control on, then hide them.
   */
  permissions?: PermissionKey[];
  /** True when the account may only operate inside `zoneIds`. */
  isZoneScoped?: boolean;
  /** Zones this account is restricted to. Empty means unrestricted. */
  zoneIds?: string[];
}

function writeCookie(value: string, remember: boolean): void {
  // Without max-age the cookie dies with the browser session, which is exactly
  // what "keep me signed in" being unticked should mean.
  const age = remember ? `; max-age=${60 * 60 * 24 * 30}` : "";
  document.cookie = `${SESSION_COOKIE}=${value}; path=/; samesite=lax${age}`;
}

export function startSession(user: SessionUser, remember = true): void {
  writeCookie(user.role.toLowerCase(), remember);
  try {
    window.localStorage.setItem(PRINCIPAL_KEY, JSON.stringify(user));
  } catch {
    // Private browsing with storage denied — the session still works, the
    // chrome just re-fetches the principal on every load.
  }
}

export function endSession(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  setTokens(null);
  try {
    window.localStorage.removeItem(PRINCIPAL_KEY);
  } catch {
    /* nothing to clear */
  }
}

let lastRawPrincipal: string | null = null;
let lastParsedPrincipal: SessionUser | null = null;

/**
 * Last known principal, so the header renders a name before /auth/me returns.
 *
 * Caches by the raw string so two calls against an unchanged
 * `localStorage` entry return the same object reference rather than a fresh
 * `JSON.parse` each time. `useSession` feeds this straight to
 * `useSyncExternalStore`, which warns of an infinite loop if a snapshot is
 * not referentially stable across calls that saw no real change.
 */
export function storedPrincipal(): SessionUser | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PRINCIPAL_KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRawPrincipal) return lastParsedPrincipal;
  lastRawPrincipal = raw;
  try {
    lastParsedPrincipal = raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    lastParsedPrincipal = null;
  }
  return lastParsedPrincipal;
}

/** Widens an API principal into the shape the chrome renders. */
export function toSessionUser(
  principal: Principal & {
    twoFactorEnabled?: boolean;
    lastLoginAt?: string;
    createdAt?: string;
    permissions?: PermissionKey[];
    isZoneScoped?: boolean;
    zoneIds?: string[];
  },
): SessionUser {
  return {
    id: principal.id,
    name: principal.name,
    email: principal.email,
    phone: principal.phone,
    role: principal.role,
    twoFactorEnabled: principal.twoFactorEnabled ?? false,
    lastLoginAt: principal.lastLoginAt,
    createdAt: principal.createdAt ?? new Date().toISOString(),
    // The login response carries no permissions — only /auth/me resolves them —
    // so these stay undefined until the principal has been fetched.
    permissions: principal.permissions,
    isZoneScoped: principal.isZoneScoped,
    zoneIds: principal.zoneIds,
  };
}
