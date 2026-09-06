import { ROUTES, landingFor } from "@/shared/constants/routes";
import { NextResponse, type NextRequest } from "next/server";

/** The operator portal, and nothing that merely begins with the same letters. */
function isOperatorPath(pathname: string): boolean {
  return pathname === "/vendor" || pathname.startsWith("/vendor/");
}

const PUBLIC_PATHS = ["/login", "/vendors/login", "/forgot-password", "/two-factor"];
const PUBLIC_API = [
  "/api/v1/auth",
  "/api/v1/public",
  "/api/v1/webhooks",
  "/api/v1/health",
  // The portal's own liveness route. CI reads it to confirm what is deployed,
  // and CI holds no bearer token.
  "/api/health",
];

/**
 * Edge proxy: request correlation and the authentication gate. Nothing else.
 *
 * This comment used to promise an "RBAC pre-check" and there has never been
 * one. There should not be, either, and it is worth writing down why so the
 * promise is not made again.
 *
 * The only thing the edge knows about a caller is `kmcp_session`, which holds a
 * lowercased role code — written by `document.cookie` in `frontend/lib/session.ts`,
 * unsigned, not http-only, and therefore editable by anyone who opens a console
 * and types. A `/settlements` gate keyed on it would stop nobody who wanted in,
 * yet would read to every future maintainer as though the route were protected.
 * That is worse than no gate at all: it invites someone to lean on it.
 *
 * Nor could it be made correct if the cookie were trustworthy. Permissions are
 * role rows the authority edits from the settings screen — grant `settlement.read`
 * to ZONE_OFFICER at four o'clock and a role-to-permission table compiled into
 * this bundle would still be bouncing zone officers away from a page the API is
 * serving them, with nothing in the audit trail to say why.
 *
 * So the work is split by what each layer can honestly answer. Here: "is anyone
 * signed in at all", which the cookie does answer, and where a forged one buys
 * only an empty dashboard shell whose every request the API refuses. In
 * `app/(dashboard)/layout.tsx`: "may this account open this page", from the
 * permissions /auth/me resolved, so a bookmarked /settlements explains itself
 * instead of flashing a screen full of failed requests. The API is the only
 * authority over the data either way; both of these are courtesies that save a
 * wasted click.
 *
 * Business rules never live here — only auth and routing concerns.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isPublicApi = PUBLIC_API.some((p) => pathname.startsWith(p));
  const session = request.cookies.get("kmcp_session")?.value;

  // API surface: bearer token is verified in the route layer; here we only gate.
  if (pathname.startsWith("/api/") && !isPublicApi) {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Please sign in again." },
          meta: { requestId },
        },
        { status: 401 },
      );
    }
  }

  // Portal surface.
  if (!pathname.startsWith("/api/") && !isPublicPage && !session) {
    const url = request.nextUrl.clone();
    // An operator arrives on a link of their own and should meet their own
    // door, not the authority's console asking for a KMC work address.
    //
    // The test has to be exact. `startsWith("/vendor")` also matches
    // `/vendors`, which is the authority's own list of contractors — a zone
    // officer opening a bookmark to it would have been handed the operator
    // sign-in and told to enter an address their organisation was registered
    // with, which they do not have.
    url.pathname = isOperatorPath(pathname) ? "/vendors/login" : "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  /**
   * An operator who has wandered into the authority's console is sent home.
   *
   * A vendor typing `/dashboard`, or opening a bookmark somebody sent them, met
   * KMC's shell: a sidebar of doors that mostly refuse them, a vendor register
   * that answers 403, and a settlements screen with an approve button they can
   * never press. Nothing leaks — every screen there is scoped by the API to
   * their own operator and the rest is refused — but it is the exact experience
   * the separate portal exists to avoid, and it teaches them the system is
   * mostly refusals.
   *
   * Routing, not a gate, and the distinction matters here more than anywhere
   * else in this file: the cookie says `vendor` because a script wrote it, and
   * a forged one buys nothing, because the API judges the bearer token on every
   * request. This only decides which shell somebody is shown.
   *
   * `/settings` is deliberately exempt. It is where an account changes its own
   * password and enrols an authenticator, the operator portal has no equivalent
   * of its own yet, and locking a vendor out of their own password to save them
   * a confusing sidebar would be a poor trade.
   */
  if (
    session &&
    landingFor(session) === ROUTES.vendorPortal &&
    !pathname.startsWith("/api/") &&
    !isOperatorPath(pathname) &&
    !isPublicPage &&
    !pathname.startsWith("/settings")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.vendorPortal;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublicPage && session) {
    const url = request.nextUrl.clone();
    // The cookie's value is the role in lower case, which is enough to know
    // whether this is a vendor going to their own portal or a KMC account
    // going to the dashboard.
    url.pathname = landingFor(session);
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};


