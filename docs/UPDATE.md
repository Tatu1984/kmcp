# KMCP — build status

**As at 8 August 2026.** Milestones are the M0–M9 gates defined in
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
| **M3** | Parking session lifecycle | ✅ Done |
| **M4** | Vendor mobile application | 🔨 **In progress** |
| **M5** | Payments and receipts | ✅ Backend done, verified in production |
| **M6** | Citizen mobile application | ⬜ Not started |
| **M7** | Shifts, settlement and revenue | ⬜ Not started |
| **M8** | Dashboards, reports, analytics, audit | 🟡 Audit and sign-in activity done; dashboards and reports not |
| **M9** | Hardening, UAT and go-live | ⬜ Not started |

Five of nine gates complete. The hardest server-side problems — pricing, the
session lifecycle, payments and authorisation — are behind us. What remains is
mostly surface: two mobile applications, the settlement engine, and reporting.

## 2. What is deployed and proved

Two repositories, two Vercel projects, one Neon database.

| | Repository | Deployment |
|---|---|---|
| API | `Tatu1984/kmcp-backend` (NestJS 11 + Prisma 7) | `kmcp-backend.vercel.app` |
| Portal | `Tatu1984/kmcp` (Next.js 16 + React 19) | `kmcp.vercel.app` |

- **158 API routes** across 15 modules
- **84 tests** passing — the fare engine's golden matrix (22), the session guard
  rails (19), the money rules (23) and the authorisation cache (9)
- **19 portal screens**, 9 of them reading and writing live API data
- **Demonstration data loaded**: five wards, eleven streets, ten zones at real
  Kolkata coordinates with geo-fence boundaries, 105 bays, three operators, six
  attendants, five published tariffs

Verified against production, not assumed:

- Sign-in returns real tokens for a seeded administrator
- `/auth/me`, `/audit/summary`, `/activity/overview` return real data
- The RBAC matrix is served from the constants the guards actually enforce
- `/sessions/start` refuses an unknown zone with a correct, readable error
- **File storage round trip**: presign → browser PUT straight to storage →
  confirm → signed read returns the exact bytes → replaying the confirm returns
  the same media record rather than a duplicate
- **A parking session, priced and paid**: started inside the geo-fence, replayed
  safely, ended at ₹64.90 against the Park Street zone tariff, collected in cash,
  receipt `RCPT/26-27/000001` issued, replay returned the same payment, and a
  second payment was refused as already settled
- **Roles edited live**: a custom role created, granted permissions and deleted;
  editing the superuser and deleting a system role both correctly refused

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
- **The permissions matrix is editable and real.** Roles are rows now, not
  constants; the guard reads them through a short-lived cache that clears on any
  write. Super Admin cannot be restricted, a system role cannot be deleted, and
  a role somebody still holds cannot be removed. Saving signs out everyone
  holding that role, so a revoked permission stops working at once.
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

### M5 — Payments and receipts

Cash, UPI, cards, net banking and wallets through Razorpay, plus receipts and
refunds. Built against Razorpay's REST API rather than its npm package, because
two ESM-only dependencies had already stopped this API booting on Vercel.

- **The amount always comes from the session's fare.** There is no amount field
  anywhere in the request schemas, so a modified client cannot name its own
  price. Part payments net off; a second payment against a settled session is
  refused; a session with no fare cannot be paid at all.
- **Every write is idempotent on a key.** An attendant tapping "collect" twice on
  a failing connection produces one payment. The client callback and the webhook
  race on every gateway payment and both must be able to arrive.
- **The webhook is the authority**, authenticated by signature over the exact
  bytes received — which proves the payload came from Razorpay rather than
  merely that the caller holds a credential. It refuses to capture when the
  reported amount differs from the order.
- **Cash captures immediately** and moves the shift's expected float, because
  that is money someone is physically holding. Cash refunds are recorded but
  never sent to the gateway.
- **Receipts are numbered within the Indian financial year** and never reissued.

**Still unproven:** the gateway half. Cash, receipts and refund accounting are
verified in production; a real card or UPI capture needs Razorpay keys.

### RBAC — roles in the database

Not a numbered gate, but a change worth recording. `User.role` stopped being a
database enum and became a foreign key to a `Role` table, which is what makes a
custom role possible. The seven system roles were seeded with exactly the grants
already in force, and every existing user kept their role through the migration.

The guard reads grants through a cached service rather than a compiled constant.
The cache is not an optimisation: this sits in front of every authenticated
request, and an uncached lookup would put a round trip to Neon ahead of every
call an attendant's handset makes.

---

## 4. What is left

### Next: M4 — Vendor mobile application

Attendant login with device binding, dashboard, start and end parking with
photograph and manual plate entry, vehicle search and history, incidents,
customer assistance, and an offline queue with idempotent sync.

Decided: **one Expo monorepo** with a shared package (API client, types, design
tokens) for the Vendor and Citizen apps, rather than two repositories.

The server-side groundwork is in place: session start and end accept a client
event id precisely so the offline queue can be safe, cash collection is
idempotent on its own key, evidence uploads go straight to storage without
passing through the API, and attendant logins are bound to a handset.

Chosen ahead of the citizen app because nothing enters this system until an
attendant starts a session at the kerb — the citizen app consumes data the
vendor app creates.

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
| Payments | Wiring only — the API exists |
| Revenue | Wiring + M7 for settlement figures |
| Settlements | M7 |
| Shifts | M7 |
| Reports | M8 |
| Incidents | Incidents module |
| Passes | Pass plans module |
| Citizens | Citizen module |

---

## 5. Known gaps and decisions to make

**Demonstration data, not real data.** The database now holds a realistic slice
of Kolkata — real coordinates, plausible kerb — loaded from `prisma/data/*.json`.
Nothing in the seed is hard-coded, so when the authority supplies its ward list,
street register, vendor contracts and approved tariff card, those become a file
swap that anyone can review in a diff. Upserts key on natural business keys, so
real data can arrive alongside the demonstration set without colliding.

Loading it immediately earned its keep: running the fare engine against real
rows exposed the session row storing `Math.round` of a duration the engine had
rounded up, so a 95½-minute stay was recorded as 95 minutes and charged as 96.
Invisible to typechecks, builds and mocked unit tests.

**No CI.** Neither repository has a GitHub Actions workflow, despite 84 tests
between them. Two deployment incidents would have been caught by one: a boot
failure where everything passed locally, and a push where Vercel's hook silently
never fired and the code sat undeployed while appearing healthy. A workflow
running typecheck, build and test — plus a check that the deployed commit is the
one that was pushed — is half an hour of work.

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

1. **M4 — the vendor application.** One Expo monorepo with a shared package, so
   the citizen app can reuse the API client, types and design tokens.
2. Wire the payments screen; the API is already there.
3. Add CI to both repositories.
4. **M7 — shifts and settlement.** Note the dependency: the attendant app's
   shift open and close needs this, and until it exists cash collected at the
   kerb has no shift to be reconciled against. Expect to build the shift half of
   M7 alongside M4 rather than strictly after it.
5. M8 dashboards and reports, then M6 the citizen application.

**Outstanding from the authority:**

- **Razorpay test keys** — cash, receipts and refund accounting are proven; a
  real card or UPI capture is not.
- **A decision on data residency.** Object storage is currently Supabase in
  `ap-northeast-2` (Seoul), so number plates, KYC documents and bank proofs sit
  outside India. Fine for development; it must be settled before go-live, and
  moving means creating a new bucket and re-pointing five variables.
- **Real ward, street, zone, vendor and tariff data** whenever it is ready. The
  seed is a file swap now, not a code change.
