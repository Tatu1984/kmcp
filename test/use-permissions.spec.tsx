import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { ALL_PERMISSIONS } from "@/shared/constants/roles";
import type { SessionUser } from "@/frontend/lib/session";

/**
 * The gate in front of every control in the portal.
 *
 * This hook has exactly two failure modes and they are opposites. Answer "yes"
 * too early and an Auditor is offered "Approve settlement" during the second
 * before /auth/me returns — a control that should never have been theirs, and
 * one they may well click. Answer "no" when the account genuinely holds
 * nothing, or when there is no API to ask, and the portal is a dead shell of
 * disabled buttons with no explanation.
 *
 * Both of those come down to one distinction: `permissions` being *undefined*
 * (not resolved yet) is not the same fact as `permissions` being `[]` (resolved,
 * and this account may do nothing). The tests below are mostly about that
 * distinction holding.
 */

const state: { isLiveApi: boolean } = { isLiveApi: true };
const session: { user: SessionUser | null; isLoading: boolean } = { user: null, isLoading: false };

// A getter, so demo mode and live mode can both be exercised in one file —
// `isLiveApi` is a module constant computed from the environment at import.
vi.mock("@/config/env", () => ({
  get isLiveApi() {
    return state.isLiveApi;
  },
  clientEnv: {},
}));

vi.mock("@/frontend/hooks/use-session", () => ({
  useSession: () => ({ ...session, isDemo: !state.isLiveApi, signOut: vi.fn() }),
}));

const principal = (permissions?: SessionUser["permissions"]): SessionUser => ({
  id: "user-1",
  name: "A. Officer",
  role: "ZONE_OFFICER",
  twoFactorEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  permissions,
});

beforeEach(() => {
  state.isLiveApi = true;
  session.user = null;
  session.isLoading = false;
});

describe("while the principal is still loading", () => {
  it("denies rather than allowing", () => {
    session.isLoading = true;

    const { result } = renderHook(() => usePermissions());

    // The safe direction to be wrong in. A control that appears a moment late
    // is a smaller problem than one that appears and then vanishes — and a
    // permission check that defaults to "allow" is a security hole waiting for
    // a slow network.
    expect(result.current.can("settlement.approve")).toBe(false);
    expect(result.current.canAny("zone.read", "settlement.approve")).toBe(false);
    expect(result.current.canAll("zone.read")).toBe(false);
    expect(result.current.isReady).toBe(false);
  });

  it("still denies once loading finishes but permissions have not arrived", () => {
    /**
     * The case that makes `isLoading` alone insufficient. The portal seeds the
     * session from the copy kept at sign-in so the header does not flash empty,
     * and that copy has no permissions — the login response does not carry any,
     * only /auth/me resolves them. So there is a real window where loading is
     * over and the answer is still unknown.
     */
    session.user = principal(undefined);
    session.isLoading = false;

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isReady).toBe(false);
    expect(result.current.can("zone.read")).toBe(false);
  });
});

describe("once the principal has resolved", () => {
  it("distinguishes an account that holds nothing from one not yet known", () => {
    session.user = principal([]);

    const { result } = renderHook(() => usePermissions());

    // Resolved, and the answer is no. `isReady` is what tells a screen it may
    // stop showing a skeleton and start explaining why a control is missing.
    expect(result.current.isReady).toBe(true);
    expect(result.current.can("zone.read")).toBe(false);
    expect(result.current.granted).toEqual([]);
  });

  it("grants what the account holds and nothing beside it", () => {
    session.user = principal(["zone.read", "session.read"]);

    const { result } = renderHook(() => usePermissions());

    expect(result.current.can("zone.read")).toBe(true);
    expect(result.current.can("zone.write")).toBe(false);
    expect(result.current.canAny("zone.write", "session.read")).toBe(true);
    expect(result.current.canAll("zone.read", "zone.write")).toBe(false);
    expect(result.current.canAll("zone.read", "session.read")).toBe(true);
  });

  it("reports the zone scope the API resolved", () => {
    session.user = { ...principal(["zone.read"]), isZoneScoped: true, zoneIds: ["zone-7"] };

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isZoneScoped).toBe(true);
    expect(result.current.zoneIds).toEqual(["zone-7"]);
  });
});

describe("demo mode", () => {
  it("grants everything, with no principal to ask about", () => {
    /**
     * With no API configured there is no /auth/me and never will be, so the
     * "deny while loading" rule would deny forever and the walkthrough — which
     * is how this product is shown to the authority, on a laptop, with no
     * backend — would be a screen of greyed-out buttons.
     */
    state.isLiveApi = false;
    session.user = null;
    session.isLoading = false;

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isReady).toBe(true);
    expect(result.current.can("settlement.payout")).toBe(true);
    expect(result.current.canAll(...ALL_PERMISSIONS)).toBe(true);
    expect(result.current.granted).toEqual(ALL_PERMISSIONS);
    // Demo mode must not also invent a zone restriction; every screen is meant
    // to be reachable in a walkthrough.
    expect(result.current.isZoneScoped).toBe(false);
  });
});
