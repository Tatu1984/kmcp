/** Error codes returned in the `error.code` field of the API envelope. */
export const ERROR_CODES = {
  VALIDATION_FAILED: { status: 400, message: "Some fields need attention." },
  UNAUTHENTICATED: { status: 401, message: "Please sign in again." },
  TOKEN_REUSED: { status: 401, message: "Session revoked for security reasons." },
  FORBIDDEN: { status: 403, message: "You do not have permission to do that." },
  DEVICE_NOT_BOUND: { status: 403, message: "This device is not registered to your account." },
  NOT_FOUND: { status: 404, message: "We could not find that." },
  SESSION_ALREADY_ACTIVE: { status: 409, message: "This vehicle already has an active parking session." },
  SESSION_NOT_ACTIVE: { status: 409, message: "This session has already ended." },
  SHIFT_ALREADY_CLOSED: { status: 409, message: "This shift is closed." },
  SETTLEMENT_ALREADY_APPROVED: { status: 409, message: "This settlement is locked after approval." },
  OUTSIDE_GEOFENCE: { status: 422, message: "You are outside every zone assigned to you." },
  ZONE_CLOSED: { status: 422, message: "This zone is closed right now." },
  ZONE_AT_CAPACITY: { status: 422, message: "No slots available for this vehicle type." },
  NO_APPLICABLE_TARIFF: { status: 422, message: "No published tariff covers this zone and vehicle type." },
  PASS_INVALID: { status: 422, message: "This pass is not valid here." },
  PAYMENT_NOT_CONFIRMED: { status: 422, message: "Payment has not been confirmed yet." },
  PAYMENT_SIGNATURE_INVALID: { status: 400, message: "Payment could not be verified." },
  IDEMPOTENCY_KEY_REQUIRED: { status: 400, message: "Missing idempotency key." },
  SYNC_BATCH_TOO_LARGE: { status: 400, message: "Too many events in one sync batch." },
  RATE_LIMITED: { status: 429, message: "Too many requests. Please wait a moment." },
  CLIENT_UPGRADE_REQUIRED: { status: 426, message: "Please update the app to continue." },
  INTERNAL_ERROR: { status: 500, message: "Something went wrong on our side." },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
