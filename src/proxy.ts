import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/two-factor"];
const PUBLIC_API = ["/api/v1/auth", "/api/v1/public", "/api/v1/webhooks", "/api/v1/health"];

/**
 * Edge middleware: request correlation, auth gate and RBAC pre-check.
 * Business rules never live here — only auth, rate limiting and routing concerns.
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
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isPublicPage && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
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
