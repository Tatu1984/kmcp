import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ERROR_CODES, type ErrorCode } from "@/shared/constants/errors";
import type { ApiMeta } from "@/shared/types/common.types";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public details?: { field: string; issue: string }[],
    message?: string,
  ) {
    super(message ?? ERROR_CODES[code].message);
    this.name = "AppError";
  }
}

function meta(requestId?: string): ApiMeta {
  return { requestId: requestId ?? crypto.randomUUID() };
}

export function ok<T>(data: T, extra?: Partial<ApiMeta>) {
  return NextResponse.json({ success: true as const, data, meta: { ...meta(), ...extra } });
}

export function created<T>(data: T, extra?: Partial<ApiMeta>) {
  return NextResponse.json(
    { success: true as const, data, meta: { ...meta(), ...extra } },
    { status: 201 },
  );
}

export function accepted<T>(data: T, extra?: Partial<ApiMeta>) {
  return NextResponse.json(
    { success: true as const, data, meta: { ...meta(), ...extra } },
    { status: 202 },
  );
}

export function fail(code: ErrorCode, details?: { field: string; issue: string }[]) {
  const spec = ERROR_CODES[code];
  return NextResponse.json(
    { success: false as const, error: { code, message: spec.message, details }, meta: meta() },
    { status: spec.status },
  );
}

/** Wrap every route handler so nothing ever leaks a stack trace to a client. */
export function handleError(error: unknown) {
  if (error instanceof AppError) return fail(error.code, error.details);

  if (error instanceof ZodError) {
    return fail(
      "VALIDATION_FAILED",
      error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
    );
  }

  console.error("[kmcp] unhandled", error);
  return fail("INTERNAL_ERROR");
}
