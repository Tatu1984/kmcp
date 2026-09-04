import { describe, expect, it } from "vitest";
import {
  toReportSchedule,
  toShift,
  toSession,
  toTariff,
  toVendor,
  toZone,
  toZonePayload,
} from "@/frontend/lib/adapters";
import type { ApiZone } from "@/frontend/api/endpoints/zones.api";
import type { ApiShift } from "@/frontend/api/endpoints/shifts.api";
import type { ApiSession } from "@/frontend/api/endpoints/sessions.api";
import type { ApiTariff } from "@/frontend/api/endpoints/tariffs.api";
import type { ApiVendor } from "@/frontend/api/endpoints/vendors.api";
import type { ApiReportSchedule } from "@/frontend/api/endpoints/reports.api";

/**
 * Where the API's answer becomes what a table cell renders.
 *
 * The interesting behaviour here is not the field copying — a rename shows up
 * as a type error. It is the small set of places where these functions decide
 * what *absence* means, because those decisions are invisible in the types and
 * each one is the difference between a blank cell and a false statement:
 *
 *  - a field the API cannot answer yet stays `undefined`, so the screen renders
 *    "—". Substituting 0 would render ₹0, which asserts there was no revenue;
 *  - a null the API *does* mean, like a cash deposit not yet declared, must not
 *    collapse into the zero that means an empty pocket;
 *  - a null that carries a meaning of its own, like a tariff with no zone,
 *    becomes that meaning rather than a dash.
 *
 * These are the assertions a future "let's default everything to zero" tidy-up
 * would have to argue with.
 */

const zone: ApiZone = {
  id: "zone-1",
  code: "Z-01",
  name: "MG Road",
  wardId: "ward-3",
  centerLat: 12.9716,
  centerLng: 77.5946,
  capacity: 40,
  allowedVehicleTypeIds: ["CAR"],
  openTime: "06:00",
  closeTime: "22:00",
  status: "OPEN",
  createdAt: "2026-01-01T00:00:00.000Z",
  occupied: 12,
  available: 28,
  occupancyPct: 30,
  availability: "AVAILABLE",
};

describe("a zone", () => {
  it("leaves the figures the API has no source for undefined", () => {
    const view = toZone(zone);

    // Revenue is computed from captured payments, and settlement figures from
    // the settlement ledger. Neither is wired up yet. `undefined` renders as a
    // dash; 0 would render as ₹0, which reads as a fact about a busy zone.
    expect(view.revenueToday).toBeUndefined();
    expect(view.revenueMonth).toBeUndefined();
    // Only the single-zone endpoint counts bays; a list row genuinely does not
    // know, and must not claim the zone has none.
    expect(view.slotCount).toBeUndefined();
  });

  it("renders a missing relation as a dash rather than an empty name", () => {
    const view = toZone(zone);

    expect(view.wardName).toBe("—");
    expect(view.streetName).toBe("—");
    // No vendor is a real state — an unallocated zone — so these stay absent
    // rather than becoming a dash the vendor filter would then try to match.
    expect(view.vendorId).toBeUndefined();
    expect(view.vendorName).toBeUndefined();
  });

  it("counts the boundary points of a zone that has no boundary as zero", () => {
    expect(toZone(zone).boundaryPoints).toBe(0);
    expect(
      toZone({
        ...zone,
        boundary: { type: "Polygon", coordinates: [[[77.5, 12.9], [77.6, 12.9], [77.6, 13.0]]] },
      }).boundaryPoints,
    ).toBe(3);
  });

  it("sends only the fields the form actually touched", () => {
    // A partial edit has to stay a partial update. Sending the whole shape
    // would blank every field the officer did not open.
    const payload = toZonePayload({ name: "MG Road", capacity: 60 });

    expect(payload).toEqual({ name: "MG Road", capacity: 60 });
    expect("wardId" in payload).toBe(false);
  });

  it("splits a centre point back into the two columns the API stores", () => {
    const payload = toZonePayload({ center: { lat: 12.9716, lng: 77.5946 } });

    expect(payload).toEqual({ centerLat: 12.9716, centerLng: 77.5946 });
  });
});

describe("a shift", () => {
  const shift: ApiShift = {
    id: "shift-1",
    attendantId: "att-1",
    vendorId: "ven-1",
    startAt: "2026-02-01T04:00:00.000Z",
    sessionsCount: 14,
    cashExpected: 84_000,
    digitalTotal: 12_000,
    status: "OPEN",
  };

  it("keeps an undeclared cash deposit distinct from a declared zero", () => {
    /**
     * The whole reason this adapter exists. `cashDeposited: null` means the
     * attendant has not handed anything in yet and the screen shows "pending".
     * `cashDeposited: 0` means they declared an empty pocket, which is a
     * variance the supervisor has to sign off. Collapsing the two hides a
     * shortfall behind a shift that merely looks unfinished.
     */
    expect(toShift({ ...shift, cashDeposited: null }).cashDeposited).toBeUndefined();
    expect(toShift({ ...shift, cashDeposited: 0 }).cashDeposited).toBe(0);
  });

  it("keeps a null variance out of the totals for the same reason", () => {
    expect(toShift(shift).varianceAmount).toBeUndefined();
    expect(toShift({ ...shift, varianceAmount: 0 }).varianceAmount).toBe(0);
  });
});

describe("a parking session", () => {
  const session = {
    id: "sess-1",
    code: "S-0001",
    plateNumber: "KA01AB1234",
    zoneId: "zone-1",
    status: "ACTIVE",
    source: "ATTENDANT",
    startAt: "2026-02-01T05:00:00.000Z",
    discountAmount: 0,
    taxAmount: 0,
    penaltyAmount: 0,
  } as unknown as ApiSession;

  it("does not claim a session is unpaid when payment state is unknown", () => {
    const view = toSession(session);

    // `paymentMode` stays absent because the payments module does not report
    // one yet. `paid: false` is the one place this file states something it
    // cannot know — flagged rather than asserted; see the note in adapters.ts.
    expect(view.paymentMode).toBeUndefined();
  });

  it("prefers a finished duration over an elapsed one", () => {
    // An ended session reports `durationMinutes`; a running one only reports
    // `elapsedMinutes`. A row showing an elapsed time for a closed session
    // would keep ticking up in the operator's eyes.
    expect(toSession({ ...session, durationMinutes: 90, elapsedMinutes: 12 } as ApiSession)
      .durationMinutes).toBe(90);
    expect(toSession({ ...session, elapsedMinutes: 12 } as ApiSession).durationMinutes).toBe(12);
    expect(toSession(session).durationMinutes).toBeUndefined();
  });
});

describe("a tariff", () => {
  const tariff: ApiTariff = {
    id: "tar-1",
    name: "Standard",
    vehicleTypeId: "vt-1",
    baseAmount: 2000,
    baseMinutes: 60,
    incrementAmount: 1000,
    incrementMinutes: 30,
    gracePeriodMin: 10,
    taxPercent: 18,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    isPublished: true,
    version: 2,
    priority: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("reads a tariff with no zone as applying everywhere", () => {
    const view = toTariff(tariff);

    // Not a missing value — a city-wide tariff is the normal case, and "—"
    // would read as a configuration someone forgot to finish.
    expect(view.zoneId).toBeUndefined();
    expect(view.zoneName).toBe("All zones");
  });

  it("keeps an absent daily cap and an absent overstay penalty absent", () => {
    const view = toTariff(tariff);

    // Zero would mean "capped at nothing" and "no penalty" respectively; both
    // are pricing statements, and neither is what a null here means.
    expect(view.dailyCapAmount).toBeUndefined();
    expect(view.overstayPenalty).toBeUndefined();
  });
});

describe("a vendor", () => {
  const vendor = {
    id: "ven-1",
    orgName: "Sunrise Parking",
    contactName: "R. Rao",
    contactPhone: "9000000000",
    commissionPct: "12.50",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as ApiVendor;

  it("turns the Decimal the API sends as a string into a number", () => {
    // Prisma serialises Decimal as a string. Every arithmetic use of the
    // commission — a settlement preview, a payout line — needs the number, and
    // "12.50" * 100 is a silent NaN downstream.
    const view = toVendor(vendor);

    expect(view.commissionPct).toBe(12.5);
    expect(typeof view.commissionPct).toBe("number");
  });

  it("leaves the settlement figures undefined and the counts at zero", () => {
    const view = toVendor(vendor);

    // Money the settlement ledger has not computed yet.
    expect(view.revenueMonth).toBeUndefined();
    expect(view.pendingSettlement).toBeUndefined();
    // Counts are different: the API always knows them, and a vendor with no
    // zones really does have zero.
    expect(view.zoneCount).toBe(0);
    expect(view.attendantCount).toBe(0);
    // An absent rating is "not rated", never nought out of five.
    expect(view.rating).toBeUndefined();
  });
});

describe("a report schedule", () => {
  const schedule: ApiReportSchedule = {
    id: "sch_1",
    name: "Monday revenue review",
    type: "revenue",
    label: "Revenue report",
    frequency: "WEEKLY",
    hour: 8,
    minute: 0,
    weekday: 1,
    dayOfMonth: null,
    timezone: "Asia/Kolkata",
    cadence: "Every Monday at 08:00 (Asia/Kolkata)",
    zoneId: null,
    vendorId: null,
    paramsLabel: "The previous 7 days · All zones",
    channels: ["EMAIL"],
    ownerId: "usr_1",
    ownerName: "Rina Dasgupta",
    isActive: true,
    nextRunAt: "2026-09-07T02:30:00.000Z",
    lastRunAt: "2026-08-31T02:30:00.000Z",
    lastStatus: "COMPLETED",
    lastError: null,
    lastJobId: "rpt_9",
    failureCount: 0,
    failuresBeforePause: 3,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  it("keeps the API's wording of the cadence rather than rebuilding it", () => {
    // The portal composes a cadence string of its own for the live preview in
    // the form, and it would be easy to reuse that here. It must not: the saved
    // row's wording comes from the same place that computes the next run, and
    // two descriptions of one schedule would eventually disagree about a row
    // nobody had touched.
    expect(toReportSchedule(schedule).cadence).toBe("Every Monday at 08:00 (Asia/Kolkata)");
  });

  it("keeps the hour as a local wall time, not a UTC instant", () => {
    // 08:00 in Kolkata is 02:30Z. If these ever came back equal, something has
    // started converting the intent into an instant on the way through, and the
    // Monday morning summary is about to start arriving on Sunday afternoon.
    const row = toReportSchedule(schedule);
    expect(row.hour).toBe(8);
    expect(row.timezone).toBe("Asia/Kolkata");
    expect(row.nextRunAt).toBe("2026-09-07T02:30:00.000Z");
  });

  it("drops a last status it does not recognise instead of badging it", () => {
    // The column is a free-form string in the database. A value from a newer
    // API renders as an unrecognised badge otherwise, which reads like a state
    // the officer is supposed to act on.
    expect(toReportSchedule({ ...schedule, lastStatus: "SOMETHING_NEW" }).lastStatus).toBeUndefined();
    expect(toReportSchedule({ ...schedule, lastStatus: null }).lastStatus).toBeUndefined();
  });

  it("carries the failure cap the API applies, rather than assuming one", () => {
    // The screen says "2 of 3 failed runs". Hard-coding the 3 here would make
    // that sentence wrong the day the API changed its mind.
    expect(toReportSchedule({ ...schedule, failureCount: 2, failuresBeforePause: 5 })).toMatchObject({
      failureCount: 2,
      failuresBeforePause: 5,
    });
  });
});
