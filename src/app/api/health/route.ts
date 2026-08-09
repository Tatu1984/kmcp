import { NextResponse } from "next/server";

/**
 * Liveness, and the commit this build came from.
 *
 * Vercel sets `VERCEL_GIT_COMMIT_SHA` at build time. Reporting it is what lets
 * CI prove the deployed portal is the code that was pushed — a push whose
 * deploy hook silently never fired otherwise looks perfectly healthy, because
 * the previous build is still serving.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "kmcp-portal",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "unknown",
  });
}
