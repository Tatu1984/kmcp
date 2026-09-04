import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * What must never leave the portal inside an error report.
 *
 * The screens in this portal are windows onto a municipality's record of its
 * citizens: a registration number, the phone number an OTP went to, the point
 * on a street where an attendant opened a session. A crash report is a copy of
 * whatever the page was doing at the time, so without this every one of those
 * would end up in a third party's database the first time a table failed to
 * load.
 *
 * The report keeps what is actually read during triage — the stack, the route,
 * the error code, and the request id that ties the event back to the API's own
 * audit trail — and replaces the rest.
 *
 * Matching is by field *name*, normalised so `plate_number`, `plateNumber` and
 * `PLATE-NUMBER` are one key. A reviewer can check a name list against the API
 * contract; a rule that tried to recognise a registration number by its shape
 * would quietly stop working the day a neighbouring state issued a new format.
 *
 * This list is deliberately a mirror of `src/observability/scrub.ts` in
 * kmcp-backend. The two repos deploy separately and share no package, so the
 * only thing keeping them in step is that a field added to one is added to the
 * other.
 *
 * The known limit is free text. A message like "no session for KA01AB1234"
 * carries a plate in a position no field name describes; this does not catch
 * it. API error messages are constants (see the backend's `ERROR_CODES`), so
 * that gap is closed at the source rather than here.
 */
const REDACTED_FIELDS: ReadonlySet<string> = new Set([
  // Vehicle registration. In a parking system the plate *is* the citizen's
  // identifier — a session, a payment and an incident are all reachable from it.
  "plate",
  "plateno",
  "platenumber",
  "registrationnumber",
  "regno",
  "vehiclenumber",
  "vehicleregistration",

  // How we reach a citizen, and the code we send them when we do.
  "phone",
  "phoneno",
  "phonenumber",
  "mobile",
  "mobilenumber",
  "msisdn",
  "contactphone",
  "alternatephone",
  "whatsapp",
  "email",
  "emailaddress",
  "otp",
  "otpcode",

  // Where someone was. Shift starts, session geotags and zone boundaries are
  // all metre-accurate positions of a named person or vehicle.
  "lat",
  "lng",
  "latitude",
  "longitude",
  "centerlat",
  "centerlng",
  "startlat",
  "startlng",
  "endlat",
  "endlng",
  "coordinates",
  "boundary",
  "geometry",
  "location",
  "gps",

  // Credentials and the financial identifiers of a vendor organisation. Not
  // personal data in the same sense, but nothing that grants access or moves
  // money belongs in a crash report either.
  "password",
  "currentpassword",
  "newpassword",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "secret",
  "apikey",
  "clientsecret",
  "signature",
  "pin",
  "totp",
  "totpsecret",
  "twofactorcode",
  "bankaccountno",
  "bankaccountnumber",
  "bankifsc",
  "ifsc",
  "pan",
  "gstin",
  "aadhaar",
]);

/**
 * Headers dropped outright rather than redacted.
 *
 * `x-request-id` is deliberately *not* here: it is the whole reason this
 * instrumentation exists, and it identifies a request rather than a person.
 */
const DROPPED_HEADERS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
]);

export const REDACTED = "[redacted]";

/** `plate_number`, `plateNumber` and `PLATE-NUMBER` are one key, not three. */
const normalise = (key: string): string => key.toLowerCase().replace(/[_\-\s]/g, "");

export const isRedactedField = (key: string): boolean => REDACTED_FIELDS.has(normalise(key));

/**
 * Replaces every sensitive field in a structure, however deeply nested.
 *
 * Depth is capped because an event is not worth a stack overflow, and because
 * anything eight levels into a request body is not what someone is reading a
 * crash report to find out.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isRedactedField(key) ? REDACTED : redact(entry, depth + 1);
  }
  return out;
}

/** Redacts the values of sensitive parameters, keeping the shape of the query. */
function redactSearchParams(params: URLSearchParams): void {
  for (const key of [...params.keys()]) {
    if (isRedactedField(key)) params.set(key, REDACTED);
  }
}

/**
 * `?plate=KA01AB1234&status=ACTIVE` → `?plate=[redacted]&status=ACTIVE`.
 *
 * Sentry reports a query string in whichever of three shapes the transport
 * happened to produce, so all three are handled rather than assumed.
 */
export function redactQueryString(
  query: string | [string, string][] | Record<string, string>,
): string | [string, string][] | Record<string, string> {
  if (typeof query === "string") {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    redactSearchParams(params);
    return `${query.startsWith("?") ? "?" : ""}${params.toString()}`;
  }
  if (Array.isArray(query)) {
    return query.map(([key, value]): [string, string] => [
      key,
      isRedactedField(key) ? REDACTED : value,
    ]);
  }
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, isRedactedField(key) ? REDACTED : value]),
  );
}

/** The same treatment for a URL that carries its parameters inline. */
export function redactUrl(url: string): string {
  const split = url.indexOf("?");
  if (split === -1) return url;
  const params = new URLSearchParams(url.slice(split + 1));
  redactSearchParams(params);
  return `${url.slice(0, split)}?${params.toString()}`;
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (DROPPED_HEADERS.has(key.toLowerCase())) continue;
    out[key] = isRedactedField(key) ? REDACTED : value;
  }
  return out;
}

/**
 * Breadcrumbs are where a browser SDK does most of its leaking.
 *
 * Every `fetch` the portal makes leaves one behind, and a list screen's fetch
 * URL is where a plate or a phone number most often appears — a search box
 * writes straight into the query string. Navigation breadcrumbs carry the same
 * risk through `to` and `from`.
 *
 * Console breadcrumbs are dropped rather than cleaned. A console breadcrumb is
 * whatever someone passed to `console.log`, flattened into a message: there are
 * no field names for a name-based rule to match on, and the one thing worse
 * than no breadcrumb trail is one that looks scrubbed and is not. Returning
 * null here removes the breadcrumb entirely.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  if (!breadcrumb.data) return breadcrumb;
  const data = redact(breadcrumb.data) as Record<string, unknown>;
  for (const key of ["url", "to", "from"]) {
    const value = data[key];
    if (typeof value === "string") data[key] = redactUrl(value);
  }
  return { ...breadcrumb, data };
}

/**
 * The `beforeSend` body: the last point at which an event is still ours.
 *
 * Everything an event can carry from the wire — body, query string, URL,
 * headers, cookies — is cleaned here, along with the breadcrumb trail and the
 * loose `extra` bag. Returning the event (rather than null) is what sends it;
 * this only ever removes.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const request = event.request;
  if (request) {
    if (request.data !== undefined) request.data = redact(request.data);
    if (request.query_string !== undefined) {
      request.query_string = redactQueryString(request.query_string);
    }
    if (typeof request.url === "string") request.url = redactUrl(request.url);
    if (request.headers) request.headers = redactHeaders(request.headers);
    // A session cookie is a live credential; nothing in it aids debugging.
    delete request.cookies;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  if (event.extra) event.extra = redact(event.extra) as Record<string, unknown>;

  /**
   * The account id stays — knowing *which* account hit this is most of
   * triage — but the identifying columns Sentry likes to attach to it do not.
   */
  if (event.user) {
    event.user = { id: event.user.id };
  }

  return event;
}
