export const API_CONFIG = {
  version: "v1",
  basePath: "/api/v1",
  timeoutMs: 20_000,
  maxPageSize: 100,
  defaultPageSize: 25,
  maxSyncBatch: 50,
  idempotencyTtlSeconds: 60 * 60 * 24,
  rateLimits: {
    default: { windowSeconds: 60, max: 120 },
    auth: { windowSeconds: 60, max: 10 },
    otp: { windowSeconds: 300, max: 5 },
    sync: { windowSeconds: 60, max: 30 },
  },
  headers: {
    deviceId: "X-Device-Id",
    clientVersion: "X-Client-Version",
    idempotencyKey: "Idempotency-Key",
    requestId: "X-Request-Id",
  },
} as const;
