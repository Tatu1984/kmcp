export { api, listAll, ApiError, setTokens, getTokens, deviceId, apiBaseUrl } from "./client";
export type { ApiResult, RequestOptions } from "./client";
export { authApi } from "./endpoints/auth.api";
export type { AuthDevice, LoginResponse, MeResponse, Principal, TokenPair } from "./endpoints/auth.api";
export { zonesApi } from "./endpoints/zones.api";
export type { ApiZone, ZoneListQuery } from "./endpoints/zones.api";
export { tariffsApi } from "./endpoints/tariffs.api";
export type { Quote, QuoteLine, ApiHoliday, ApiDiscount } from "./endpoints/tariffs.api";
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
export type { MediaPurpose, UploadTicket, ApiMedia, RbacMatrix, RbacRole } from "./endpoints/media.api";
export { sessionsApi } from "./endpoints/sessions.api";
export type { ApiSession, PlateLookup } from "./endpoints/sessions.api";
export { documentsApi, saveDocument, printDocument } from "./endpoints/documents.api";
export type { IssuedDocument, AuditTrailQuery } from "./endpoints/documents.api";
export { reportsApi, reportSchedulesApi } from "./endpoints/reports.api";
export type {
  ApiReportJob,
  ApiReportType,
  ApiReportSchedule,
  ReportFrequency,
  ReportScheduleBody,
} from "./endpoints/reports.api";
export { analyticsApi } from "./endpoints/analytics.api";
export type {
  DashboardOverview,
  HourlyPoint,
  DailyPoint,
  TopZone,
} from "./endpoints/analytics.api";
export { settlementsApi, revenueApi } from "./endpoints/settlements.api";
export type {
  ApiSettlement,
  ApiSettlementDetail,
  SettlementSummary,
  RevenueOverview,
} from "./endpoints/settlements.api";
export { privacyApi, saveDataExport } from "./endpoints/privacy.api";
export type {
  RetentionPolicy,
  RetentionClass,
  RetentionPreview,
  RetentionClassOutcome,
  ConsentSummary,
  DataExport,
} from "./endpoints/privacy.api";
export { citizensApi } from "./endpoints/citizens.api";
export type {
  ApiCitizen,
  ApiCitizenDetail,
  ApiCitizenVehicle,
  CitizenSummary,
} from "./endpoints/citizens.api";
export { passesApi, passPlansApi } from "./endpoints/passes.api";
export type { ApiPass, ApiPassPlan, PassSummary } from "./endpoints/passes.api";
export { incidentsApi } from "./endpoints/incidents.api";
export type { ApiIncident, IncidentSummary, IncidentListQuery } from "./endpoints/incidents.api";
export { shiftsApi } from "./endpoints/shifts.api";
export type { ApiShift, ShiftListQuery } from "./endpoints/shifts.api";
export { paymentsApi } from "./endpoints/payments.api";
export { messagingApi, describeDispatch, channelLabel } from "./endpoints/messaging.api";
export type {
  MessageChannel,
  ChannelStatus,
  ApiDelivery,
  DispatchSummary,
  DeliveryListQuery,
} from "./endpoints/messaging.api";
export type { ApiNotification } from "./endpoints/notifications.api";
export { notificationsApi } from "./endpoints/notifications.api";
export type {
  ApiPayment,
  ApiReceipt,
  PaymentSummary,
  PaymentListQuery,
} from "./endpoints/payments.api";
