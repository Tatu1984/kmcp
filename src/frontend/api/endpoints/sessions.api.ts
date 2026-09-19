import { api, type ApiResult } from "../client";
import type {
  IncidentStatus,
  IncidentType,
  PaymentMode,
  PaymentStatus,
  Quote,
  SessionStatus,
  SessionSource,
  SlotType,
} from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

/**
 * What `GET /sessions` will actually answer to.
 *
 * Written out rather than left as a loose record because two of these are
 * traps, and both cost an afternoon each:
 *
 * `status` takes **one** value. It is a `z.nativeEnum` on the server, so
 * `?status=ACTIVE,OVERSTAY` and a repeated `?status=` are both 400s. Anything
 * that wants "currently parked" has to ask twice — a sweep promotes a running
 * session from ACTIVE to OVERSTAY, so ACTIVE alone silently omits exactly the
 * vehicles an operator is looking for.
 *
 * `overstayOnly` is coerced with `Boolean(string)`, which makes `"false"` and
 * `"0"` both true, and it *overwrites* whatever `status`, `from` and `to` were
 * sent. Omit the key to switch it off; never send `false`.
 */
export interface SessionListQuery {
  page?: number;
  /** Capped at 100 by the API. */
  pageSize?: number;
  /** `startAt`, `endAt`, `payableAmount`, `status`, `plateNumber`; `-` for descending. */
  sort?: string;
  /** Matches a session code or a plate. */
  q?: string;
  /** One status only — see the note above. */
  status?: SessionStatus;
  zoneId?: string;
  vendorId?: string;
  attendantId?: string;
  plateNumber?: string;
  vehicleType?: SlotType;
  from?: string;
  to?: string;
}

export interface ApiSession {
  id: string;
  code: string;
  clientEventId?: string | null;
  zoneId: string;
  slotId?: string | null;
  plateNumber: string;
  vehicleTypeId: string;
  vendorId: string;
  attendantId?: string | null;
  shiftId?: string | null;
  tariffId?: string | null;
  status: SessionStatus;
  source: SessionSource;
  startAt: string;
  endAt?: string | null;
  durationMinutes?: number | null;
  evidenceStartMediaId?: string | null;
  evidenceEndMediaId?: string | null;
  grossAmount?: number | null;
  discountAmount: number;
  taxAmount: number;
  penaltyAmount: number;
  payableAmount?: number | null;
  /**
   * The fare, exactly as the server worked it out at exit.
   *
   * `sessions.service.ts:457` writes the whole `Quote` object into this JSON
   * column verbatim — no picking, no extra keys — so this is that type rather
   * than the `unknown` it used to be. Null for anything still running, and for
   * a cancelled session: `cancel()` zeroes the payable amount and leaves the
   * breakdown untouched.
   *
   * It is a JSON column, which means nothing enforces the shape on the way out
   * of the database. The adapter checks it before handing it to a screen rather
   * than trusting this annotation — see `toFareBreakdown`.
   */
  fareBreakdown?: Quote | null;
  cancelledReason?: string | null;
  createdAt: string;
  zone?: { id: string; code: string; name: string } | null;
  slot?: { id: string; code: string } | null;
  vehicleType?: { id: string; code: SlotType; label: string } | null;
  vendor?: { id: string; orgName: string } | null;
  attendant?: { id: string; employeeCode: string; user: { name: string } } | null;
  /** Server-computed: running time for a live session, final for a closed one. */
  elapsedMinutes?: number | null;
  isOverstay?: boolean;
  /**
   * The captured payment, if there is one. Mode only — a listing has no use
   * for a gateway reference.
   *
   * Carried because its absence was worse than its weight: the portal has a
   * required `paid` flag, had nothing to populate it from, and so asserted
   * `false` for every row — which rendered every completed session in the city
   * as unpaid, with an "Unpaid" figure on the screen agreeing with it.
   * Optional here so a response from an older deployment reads as unpaid rather
   * than throwing.
   */
  payments?: { mode: PaymentMode }[];
}

/**
 * What `GET /sessions/:id` adds on top of a list row.
 *
 * The list carries only whether a payment was captured and by what mode — the
 * two facts a table cell shows. Anything that needs a payment *id*, for a
 * refund or a receipt, still has to fetch the session, and this stays a
 * separate type so a screen holding a list row cannot quietly assume otherwise.
 */
export interface ApiSessionDetail extends ApiSession {
  payments: {
    id: string;
    amount: number;
    mode: PaymentMode;
    status: PaymentStatus;
    createdAt: string;
  }[];
  incidents: { id: string; type: IncidentType; status: IncidentStatus; createdAt: string }[];
}

export interface PlateLookup {
  plateNumber: string;
  known: boolean;
  vehicle: {
    id: string;
    plateNumber: string;
    makeModel?: string | null;
    colour?: string | null;
    isBlacklisted: boolean;
    vehicleType: { code: SlotType; label: string };
  } | null;
  active: ApiSession | null;
  recent: {
    id: string;
    code: string;
    startAt: string;
    endAt?: string | null;
    payableAmount?: number | null;
    zone: { name: string };
  }[];
}

/**
 * What is parked right now, counted by the server.
 *
 * Worth preferring over counting rows in the browser for two reasons: it is not
 * limited to whichever page the table happened to load, and `overstayAfterMinutes`
 * is the threshold the server is *actually* sweeping on. That threshold is a
 * `systemConfig` row (`ops.overstayAfterMinutes`, falling back to 360) which an
 * administrator can change at runtime, so a portal that hardcoded six hours
 * would quietly disagree with the API the day somebody edited it.
 */
export interface SessionLiveSummary {
  /** Sessions in ACTIVE **or** OVERSTAY — everything with a vehicle in a bay. */
  activeSessions: number;
  overstaying: number;
  overstayAfterMinutes: number;
  /** Ids only; the caller resolves names from a zone list it already holds. */
  byZone: { zoneId: string; count: number }[];
}

/**
 * What a session costs, answered by the server.
 *
 * `GET /sessions/:id/quote`, guarded on `session.read` or `session.read.own`.
 * It answers for a session in any state, and `provisional` says which of two
 * quite different things is being handed over:
 *
 *  - a **running** session is priced live, through the same engine that will
 *    price it for real at exit. `provisional: true`. It is a statement about
 *    this moment and nothing more — the meter keeps going after it is read.
 *  - a **finished** one is read from storage, never re-priced. `provisional:
 *    false`. Re-running today's tariff over last week's session would quietly
 *    disagree with the receipt the citizen is holding.
 *
 * This is the only way the portal may show a figure for a running session. The
 * temptation is `tariffsApi.preview`, and it must be resisted: previewing a
 * duration against a rate card would make the portal the thing that priced a
 * real session, and then the portal, the attendant's handset and the citizen's
 * app would each hold their own opinion about one fare.
 */
export interface SessionQuote {
  sessionId: string;
  code: string;
  status: SessionStatus;
  zone?: { id: string; code: string; name: string } | null;
  slot?: { id: string; code: string; type: SlotType } | null;
  vehicleType?: { code: SlotType; label: string } | null;
  startAt: string;
  endAt?: string | null;
  elapsedMinutes: number;
  isOverstay: boolean;
  /** True while the session is still running. See the note above. */
  provisional: boolean;
  /** When the figure was struck: the exit time, or the moment it was quoted. */
  quotedAt?: string | null;
  grossAmount?: number | null;
  discountAmount: number;
  taxAmount: number;
  penaltyAmount: number;
  payableAmount?: number | null;
  /**
   * The breakdown behind those totals.
   *
   * Null for a session ended before the fare breakdown was stored: the server's
   * `storedQuote` hands back what is there rather than declaring a `Quote`
   * where none exists, "which would only move the failure into whichever app
   * read `quote.lines`". So this is checked, never assumed.
   */
  quote: Quote | null;
}

export const sessionsApi = {
  list: (query: SessionListQuery = {}): Promise<ApiResult<ApiSession[]>> =>
    api.get<ApiSession[]>("/sessions", { query: query as Query }),

  get: (idOrCode: string) => api.get<ApiSessionDetail>(`/sessions/${idOrCode}`),

  live: () => api.get<SessionLiveSummary>("/sessions/live"),

  /**
   * What this session costs, or would cost if it ended now.
   *
   * A deployment older than this route answers 404, which callers should let
   * degrade rather than treat as a fault: the honest "priced at exit" state is
   * the right thing to show when the server cannot say.
   */
  quote: (idOrCode: string) => api.get<SessionQuote>(`/sessions/${idOrCode}/quote`),

  lookupPlate: (plateNumber: string) =>
    api.get<PlateLookup>(`/sessions/plate/${encodeURIComponent(plateNumber)}`),

  /**
   * `clientEventId` makes this safe to retry — the same id always resolves to
   * the same session, which is what lets the vendor app flush an offline queue
   * more than once without charging twice.
   */
  start: (body: {
    clientEventId?: string;
    zoneId: string;
    slotId?: string;
    plateNumber: string;
    vehicleType: SlotType;
    location?: { lat: number; lng: number };
    evidenceMediaId?: string;
    startedAt?: string;
    source?: SessionSource;
  }) => api.post<ApiSession & { replayed: boolean }>("/sessions/start", body),

  end: (
    idOrCode: string,
    body: {
      clientEventId?: string;
      location?: { lat: number; lng: number };
      evidenceMediaId?: string;
      endedAt?: string;
      discountCode?: string;
    } = {},
  ) => api.post<ApiSession & { replayed: boolean }>(`/sessions/${idOrCode}/end`, body),

  cancel: (idOrCode: string, reason: string) =>
    api.post<ApiSession>(`/sessions/${idOrCode}/cancel`, { reason }),
};
