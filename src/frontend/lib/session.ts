"use client";

import { setTokens } from "@/frontend/api";
import type { Principal } from "@/frontend/api";
import type { Role } from "@/shared/constants/roles";

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

/** Last known principal, so the header renders a name before /auth/me returns. */
export function storedPrincipal(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRINCIPAL_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

/** Widens an API principal into the shape the chrome renders. */
export function toSessionUser(
  principal: Principal & { twoFactorEnabled?: boolean; lastLoginAt?: string; createdAt?: string },
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
  };
}
