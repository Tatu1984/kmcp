export const ROUTES = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  twoFactor: "/two-factor",

  dashboard: "/dashboard",

  zones: "/zones",
  zone: (id: string) => `/zones/${id}`,
  slots: "/slots",
  wards: "/wards",

  sessions: "/sessions",
  session: (id: string) => `/sessions/${id}`,
  incidents: "/incidents",

  vendors: "/vendors",
  vendor: (id: string) => `/vendors/${id}`,

  /**
   * The vendor's own portal, which is a different place from `/vendors`.
   *
   * `/vendors` is the authority looking at its contractors. `/vendor` is a
   * contractor looking at itself — its own zones, its own staff, its own
   * settlement. Deliberately a separate route group with its own shell, so a
   * vendor never sees the authority's navigation.
   */
  vendorPortal: "/vendor",
  /**
   * Sits under `/vendors` rather than `/vendor` on purpose: the operator's
   * door belongs in the same namespace as everything else about operators,
   * and one fewer near-identical URL is one fewer way to send somebody to the
   * wrong sign-in screen. It resolves ahead of `/vendors/[id]` because a
   * static segment always beats a dynamic one.
   */
  vendorLogin: "/vendors/login",
  vendorStaff: "/vendor/staff",
  vendorSettlements: "/vendor/settlements",
  attendants: "/attendants",
  shifts: "/shifts",

  tariffs: "/tariffs",
  passes: "/passes",

  payments: "/payments",
  settlements: "/settlements",
  settlement: (id: string) => `/settlements/${id}`,
  revenue: "/revenue",
  reports: "/reports",

  citizens: "/citizens",
  audit: "/audit",
  cms: "/cms",
  settings: "/settings",
  connection: "/settings/connection",
} as const;

export const API = {
  base: "/api/v1",
} as const;

/**
 * Where an account belongs when nothing else has been asked for.
 *
 * A vendor arrives on a link of their own — parking.<host>/vendor — and is
 * bounced through /login like anyone else, so after signing in they must land
 * back in their own portal rather than on the authority's dashboard, which
 * shows them KMC's view of the whole city and none of their own business.
 *
 * Takes a role in any casing because the two callers hold it differently: the
 * portal has the principal from /auth/me, and the edge proxy has only the
 * session cookie, whose value is the role in lower case.
 */
export function landingFor(role: string | undefined | null): string {
  return role?.toUpperCase() === "VENDOR" ? ROUTES.vendorPortal : ROUTES.dashboard;
}
