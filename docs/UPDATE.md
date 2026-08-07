# KMCP — build status

**As at 7 August 2026.** Milestones are the M0–M9 gates defined in
[the Scope of Work](sow/KMCP_Scope_of_Work.md) §5. This document tracks what has
been built against them, what has been proved to work, and what has not.

A gate is only "done" when its exit criterion can actually be demonstrated —
not when the code for it exists.

---

## 1. Where things stand

| Gate | Scope | State |
|---|---|---|
| **M0** | Foundation — repos, database, auth, RBAC, CI/CD | ✅ Done |
| **M1** | Master data + Admin Portal core | ✅ Done (backend and portal) |
| **M2** | Tariff and pricing engine | ✅ Done |
| **M3** | Parking session lifecycle | ✅ Backend done, portal wired |
| **M4** | Vendor mobile application | ⬜ Not started |
| **M5** | Payments and receipts | ⬜ Not started — **next** |
| **M6** | Citizen mobile application | ⬜ Not started |
| **M7** | Shifts, settlement and revenue | ⬜ Not started |
| **M8** | Dashboards, reports, analytics, audit | 🟡 Audit and sign-in activity done; dashboards and reports not |
| **M9** | Hardening, UAT and go-live | ⬜ Not started |

Four of nine gates complete. The three hardest server-side problems — pricing,
the session lifecycle, and authorisation — are behind us.

## 2. What is deployed and proved

Two repositories, two Vercel projects, one Neon database.

| | Repository | Deployment |
|---|---|---|
| API | `Tatu1984/kmcp-backend` (NestJS 11 + Prisma 7) | `kmcp-backend.vercel.app` |
| Portal | `Tatu1984/kmcp` (Next.js 16 + React 19) | `kmcp.vercel.app` |

- **147 API routes** across 14 modules
- **51 tests** passing — the fare engine's golden matrix (22 cases) and the
  session guard rails (18 cases)
- **19 portal screens**, 10 of them reading and writing live API data

Verified against production, not assumed:

- Sign-in returns real tokens for a seeded administrator
- `/auth/me`, `/audit/summary`, `/activity/overview` return real data
- The RBAC matrix is served from the constants the guards actually enforce
- `/sessions/start` refuses an unknown zone with a correct, readable error
- **File storage round trip**: presign → browser PUT straight to storage →
  confirm → signed read returns the exact bytes → replaying the confirm returns
  the same media record rather than a duplicate

## 3. What is done, in detail

### M0 — Foundation

Both repositories, Neon Postgres, a 42-model Prisma schema with migrations,
JWT access and refresh tokens with rotation and reuse detection, TOTP
two-factor, device binding, RBAC, the `{ success, data, meta }` response
envelope, and seed data for staff, vehicle types and system configuration.

### M1 — Master data and Admin Portal core

**Backend:** geography (wards, streets), vehicle types, slots, attendants,
portal users, settings and CMS, vendors with KYC, and media uploads.

**Portal:** zones, slots, attendants, vendors, users and settings, CMS — all
reading and writing the API.

Rules worth knowing, because they are deliberate and will look like bugs if you
do not expect them:

- **Nothing carrying history is deleted.** A ward with zones refuses to go; a
  bay that has held a session is retired, not removed; a vehicle category still
  referenced by a tariff is deactivated. A report signed off last quarter must
  still read the same next year.
- **Operational locks.** A bay cannot be taken out of service while a vehicle
  is parked in it. An attendant cannot be deactivated or transferred mid-shift —
  that shift is holding cash nobody has counted.
- **The portal cannot lock the authority out.** Nobody may change their own role
  or status, and the last active Super Admin cannot be suspended or demoted.
  Role changes, suspensions and password resets end live sessions immediately.
- **The permissions matrix is read-only.** It is code — reviewed, versioned,
  deployed — and is served from the same constants the guards enforce. It was
  briefly editable in the portal and saved nowhere, which was worse than not
  having the screen.
- **Uploads never pass through the API.** The client asks for a presigned URL,
  PUTs the bytes straight to object storage, then confirms. Keys are
  server-generated. Session evidence is written immutable and refuses deletion.

### M2 — Tariff and pricing engine

Tariff versions, slabs, per-minute and hourly rates, daily caps, grace periods,
peak/weekend/holiday/event/VIP rules, discounts, tax, and a quote preview API —
covered by a 22-case golden matrix.

**One authority on price.** Nothing else in the codebase, and nothing on any
device, computes a fare. A tariff change therefore takes effect everywhere on
the next request, with no app release and no risk of two clients disagreeing.

A published version is never edited in place: the API forks a new draft, which
is what keeps a historic session re-priceable at the rate it was actually
charged.

### M3 — Parking session lifecycle

Start, end, cancel, search, plate lookup and live occupancy.

- **Start is refused** when the zone is closed, the vehicle type is not
  permitted, every bay is taken, the plate already has a live session anywhere,
  the device is outside the geo-fence, or the vehicle is blacklisted.
- **Start and end are idempotent** on the client's own event id. The vendor app
  will queue events offline and flush them later, sometimes more than once; a
  replay must return the original session and the original fare, never a second
  charge.
- **Ending stores the full fare breakdown** on the row rather than recomputing
  later, so a receipt reprinted next year shows the lines actually charged.
- **A completed session cannot be cancelled** — money has changed hands and the
  payment would be left pointing at nothing. Refund it instead.

---

## 4. What is left

### Next: M5 — Payments and receipts

Chosen ahead of the vendor app, deviating from the SoW order, so that the
mobile payment screens are written against an API that already exists rather
than one being built underneath them.

- Razorpay orders, UPI dynamic QR, cards, net banking, wallets
- Cash marking and attribution to a shift
- Webhook signature verification and idempotency
- Receipt and GST invoice generation
- Delivery by SMS, WhatsApp and email
- Refunds

**Needs from the authority:** Razorpay and RazorpayX keys. Test-mode keys are
enough to build and verify against; live keys only at go-live.

### M4 — Vendor mobile application

Attendant login with device binding, dashboard, start and end parking with
photograph and manual plate entry, vehicle search and history, incidents,
customer assistance, and an offline queue with idempotent sync.

Decided: **one Expo monorepo** with a shared package (API client, types, design
tokens) for the Vendor and Citizen apps, rather than two repositories.

The server-side groundwork is already in place — session start and end accept a
client event id precisely so the offline queue can be safe.

### M6 — Citizen mobile application

OTP registration, My Garage, live parking map and availability, navigation,
live session view, in-app payment, receipts, history, favourites, monthly
passes, notifications, vehicle locator, feedback and complaints.

### M7 — Shifts, settlement and revenue

Shift start and close with GPS, cash against digital reconciliation, deposit
confirmation and admin verification, settlement generation, commission and
government share, approval workflow, RazorpayX payout, ledger and statements.

Sessions already attach to an attendant's open shift and increment its count,
so reconciliation will have something to check against.

### M8 — Dashboards, reports, analytics

Audit and sign-in activity are done. Still to build: the live dashboard, the
heat map, every report type with PDF/Excel/CSV export, scheduled reports, and
alerting.

### M9 — Hardening, UAT and go-live

Security review and penetration test fixes, load and soak testing, DPDP
compliance review, accessibility pass, backup and DR drill, documentation,
training, store submission, pilot zone rollout.

### Portal screens still on demo data

Nine of nineteen. Each is waiting on the backend module beneath it, not on UI
work — the screens themselves are built.

| Screen | Waiting on |
|---|---|
| Dashboard | M8 |
| Payments | M5 |
| Revenue | M5 + M7 |
| Settlements | M7 |
| Shifts | M7 |
| Reports | M8 |
| Incidents | Incidents module |
| Passes | Pass plans module |
| Citizens | Citizen module |

---

## 5. Known gaps and decisions to make

**No real data.** The database holds staff logins, vehicle types and system
configuration — no wards, streets, zones or bays. Every wired screen therefore
renders an empty state. The wiring has been verified by contract, typecheck and
build, **not by behaviour with realistic volume**. Demo seed data can be
generated at any time; real KMC geography is expected from the authority later.

**No CI.** Neither repository has a GitHub Actions workflow. Both have real test
suites. A workflow running typecheck, build and test on push would have caught
the deployment failure that cost an afternoon in early August, when everything
passed locally and the deployed function could not boot.

**Storage region.** Object storage is Supabase in `ap-northeast-2` (Seoul).
Number plates, KYC documents and bank proofs will sit outside India. Fine for
development; **must be confirmed against the authority's data-residency
requirements before go-live.** Moving means creating a new project and
re-pointing five environment variables — cheap now, disruptive later.

**Storage capacity.** The free tier is roughly 1 GB and pauses after a week of
inactivity. Adequate for development and a small pilot, not for production
volumes of photographs.

**Overstay sweep.** Overstay is derived correctly on every read. The scheduled
job that promotes the stored status only runs where a process stays alive, which
a serverless deployment does not — it will eventually need to be driven by a
scheduled call to an endpoint.

**Effort.** The SoW's indicative total for M0–M9 is ~29.5 weeks at 10.5 FTE. The
gates remain valid; the calendar does not.

---

## 6. Immediate next steps

1. Seed realistic demo data so the built screens can be judged with content
2. Build M5 payments — Razorpay orders, webhooks, receipts, refunds
3. Add CI to both repositories
4. Wire the payments and revenue screens as M5 lands
5. Start the Expo monorepo for M4

**Outstanding from the authority:** Razorpay test keys; real ward, street and
zone data; a decision on data residency.
