export { api, ApiError, setTokens, getTokens, deviceId, apiBaseUrl } from "./client";
export type { ApiResult, RequestOptions } from "./client";
export { authApi } from "./endpoints/auth.api";
export type { LoginResponse, MeResponse, Principal, TokenPair } from "./endpoints/auth.api";
export { zonesApi } from "./endpoints/zones.api";
export type { ApiZone, ZoneListQuery } from "./endpoints/zones.api";
export { tariffsApi } from "./endpoints/tariffs.api";
export type { Quote, QuoteLine } from "./endpoints/tariffs.api";
export { auditApi, activityApi } from "./endpoints/audit.api";
export type {
  AuditEntry,
  AuditActor,
  AuditSummary,
  AuthEvent,
  ActivityOverview,
  LiveSession,
} from "./endpoints/audit.api";
export { geographyApi } from "./endpoints/geography.api";
export type { ApiWard, ApiStreet } from "./endpoints/geography.api";
export { vendorsApi } from "./endpoints/vendors.api";
export type { ApiVendor } from "./endpoints/vendors.api";
export { vehicleTypesApi, slotsApi, attendantsApi, usersApi, settingsApi } from "./endpoints/master.api";
export type {
  ApiVehicleType,
  ApiSlot,
  SlotSummary,
  ApiAttendant,
  ApiUser,
  ConfigEntry,
  ApiCmsPage,
  ApiFaq,
  ApiBanner,
} from "./endpoints/master.api";
export { mediaApi, uploadFile, rbacApi } from "./endpoints/media.api";
export type { MediaPurpose, UploadTicket, ApiMedia, RbacMatrix } from "./endpoints/media.api";
export { sessionsApi } from "./endpoints/sessions.api";
export type { ApiSession, PlateLookup } from "./endpoints/sessions.api";
