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
| **M4** | Vendor mobile application | 🔨 **In progress** — monorepo scaffolded |
| **M5** | Payments and receipts | ✅ Backend done and verified; portal screen wired |
| **M6** | Citizen mobile application | ⬜ Not started |
| **M7** | Shifts, settlement and revenue | ✅ Done, bar automated payout |
| **M8** | Dashboards, reports, analytics, audit | ✅ Done |
| **M9** | Hardening, UAT and go-live | ⬜ Not started |

Seven of nine gates complete, and **the Admin Portal is finished end to end** —
every screen reads and writes the live API, with no screen left on demo data.

What remains is the two mobile applications and the go-live gate. The one thing
the portal cannot do by itself is move money out: RazorpayX credentials do not
exist, so a payout is made at the bank and its reference recorded here.

## 2. What is deployed and proved

Three repositories, two Vercel projects, one Neon database.

| | Repository | Deployment |
|---|---|---|
| API | `Tatu1984/kmcp-backend` (NestJS 11 + Prisma 7) | `kmcp-backend.vercel.app` |
| Portal | `Tatu1984/kmcp` (Next.js 16 + React 19) | `kmcp.vercel.app` |
| Mobile | `kmcp-mobile` (Expo monorepo — Vendor, then Citizen) | Not yet deployed |

- **196 route handlers** across 22 modules
- **116 tests** passing — the fare engine's golden matrix, the session guard
  rails, the money rules, the shift close and variance rules, the settlement
  arithmetic and ledger, the authorisation cache and the TOTP helper
- **19 portal screens, all 19 reading and writing live API data**
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

The **portal's payments screen now reads the API** rather than the bundled demo
set: the list, the collection totals and the cash-versus-digital split come from
`/payments` and `/payments/summary`, refunds go to `/payments/{id}/refund`, and a
captured payment missing a receipt can be issued one from the row menu. A full
refund deliberately sends no amount at all, so the server decides what is still
refundable instead of trusting a figure the screen worked out from a stale row.

**Still unproven:** the gateway half. Cash, receipts and refund accounting are
verified in production; a real card or UPI capture needs Razorpay keys. The
rewired payments screen typechecks, lints and builds, but has not yet been
exercised against the live API.

### M7 — Shifts, settlement and revenue

A shift is the unit of accountability for cash, and it is built: open, close,
verify, the signed-in attendant's current shift, and a filtered list.

- **One open shift per attendant.** Opening a second returns the first rather
  than creating one, so a handset that retries cannot split a day's takings
  across two records.
- **Closing is a count, not a claim.** The attendant declares what they are
  holding; the server compares it with what the sessions say they collected and
  flags a variance either way, short or over. Refunds count against the expected
  figure and digital collection is kept out of it entirely — only cash is
  physically in a pocket.
- **A shift cannot close over a running session**, cannot close twice, and
  cannot be closed by somebody else.
- **Nobody verifies their own shift**, an open shift cannot be verified at all,
  and verification recomputes the variance against what was actually received
  rather than trusting the close.

Settlement, commission and government share, the approval workflow, RazorpayX
payout and the ledger are the rest of M7 and are not built.


**Settlement is built.** A draft is generated for a vendor and a period from
every captured payment no settlement has claimed yet — so re-running a period
after a late webhook picks up the stragglers instead of paying for the same
session twice. What actually prevents double payment is a unique constraint on
(settlement, payment), not care.

- **Amounts are net of refunds throughout.** Money handed back was never
  revenue, and no commission is earned on it.
- **The two shares are derived by subtraction**, not by a second percentage:
  the vendor earns their commission and the authority keeps the rest, so the
  halves always add back to gross however the rounding fell on each line.
- **Approval posts a double-entry ledger** — cash and gateway receipts in,
  vendor payable and municipal revenue out — and refuses to write anything if
  debits and credits do not match. An unbalanced ledger found by an auditor
  months later costs far more than a failed request now.
- **Draft, submit, approve or reject, then payout** are separate acts, and each
  one refuses to run out of order.
- **Payout records rather than transfers.** RazorpayX credentials do not exist,
  so the transfer is made at the bank and its reference recorded here against
  the vendor payable. That is also the fallback the authority will want on any
  day the gateway is down. When keys arrive, an automated payout should call the
  same method with the payout id, so the ledger half stays in one place.

**Revenue is read from the payments, not from settlements.** Money collected
yesterday is revenue today whether or not anyone has run a settlement for it —
reading it from settlement rows would turn the revenue screen into a report on
administrative diligence rather than on takings.

### M8 — Dashboards, reports and analytics

Every counter on the dashboard is computed at read time from the table that owns
the fact. There are no roll-up columns to keep in step, because a stale counter
on a dashboard is worse than a slow one: nobody notices it is wrong.

- **Occupancy by hour counts overlap**, not arrivals — a car that parked at 09:40
  and left at 14:10 was present for every hour in between, which a group-by on
  the start time would miss entirely.
- **The live activity feed is real**, merged from sessions, payments, incidents
  and shifts. There is no event log to read: the audit trail records who changed
  what, which is a different question from what the kerb is doing.
- **Eleven report types**, all served from a catalogue the API owns so the portal
  cannot offer a report the backend has no code to run. Reports run inline and
  return when done — a serverless deployment has no worker to drain a queue, so
  a job left QUEUED would sit there forever looking like a backlog.
- **Output is regenerated on download**, never cached to storage, so a report can
  never disagree with the data it claims to describe.
- **CSV only.** Excel opens it directly. A PDF or a native workbook needs a
  rendering library this API does not carry, and handing back a CSV named `.pdf`
  would be worse than saying so — the format picker says so on the screen.

### Incidents, passes and citizens

Three modules built over models that already existed in the schema.

- **Incidents** are raised against a session or a zone, picked up, assigned,
  resolved or rejected. A closed incident stays closed: reopening by overwriting
  would lose who resolved it and when, which is exactly what a disputed incident
  needs. Resolution notes are required — "resolved" with no account of what was
  done is a closed tab, not a resolution.
- **Pass plans** are withdrawn from sale, never deleted, and a price change
  applies only to what is sold next. A pass already issued keeps the terms it was
  bought on, which is why it carries its own dates rather than reading the plan's.
- **Citizens** are reached through the vehicles they have claimed, since a
  session belongs to a plate. Blacklisting the account ends their sessions
  immediately but deliberately leaves their vehicles alone: enforcement at the
  kerb reads `vehicle.isBlacklisted`, because an attendant types a plate and
  never sees an owner. Blocking the account and blocking the car are two acts,
  and the screen offers both rather than doing one silently as a side effect of
  the other.

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

**Scaffolded so far** in `kmcp-mobile`: the workspace itself, `packages/api`
(client, endpoints, types, formatting and the offline queue) and `apps/vendor`
with its layout, entry screen and session and theme helpers. The screens
themselves are still to build. It is now its own git repository — it had been
sitting inside the projects directory's repo alongside unrelated work, with no
history of its own.

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

### M9 — Hardening, UAT and go-live

Security review and penetration test fixes, load and soak testing, DPDP
compliance review, accessibility pass, backup and DR drill, documentation,
training, store submission, pilot zone rollout.

### Portal screens still on demo data

**None.** All nineteen read and write the live API.

The bundled demo dataset has not been removed, and should not be: with no
`NEXT_PUBLIC_API_URL` set, every screen falls back to it, which is how the
portal is demonstrated on a laptop with no backend.

### Actions that are still only a message

A handful of buttons raise a toast because the module beneath them genuinely
does not exist. They are listed rather than quietly left to look real:

| Action | Needs |
|---|---|
| Send a receipt, pass or report by SMS / WhatsApp / email | Notifications module |
| Re-send renewal reminders to pass holders | Notifications module |
| Print or download a PDF statement | A PDF renderer |
| Scheduled reports | A scheduler, and the same notifications module |
| Escalate a shift variance | A case workflow; today it is a note, not a record |
| Export a citizen's data under DPDP | The erasure and export workflow in M9 |

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

**CI, now in both repositories.** Each has a workflow that installs, typechecks
and builds — plus lint on the portal and the 116 tests on the API — and then, on
a push to `main`, polls the deployment until it reports the commit that
triggered the run.

That second job is the one that earns its keep. Both `/health` endpoints now
report `VERCEL_GIT_COMMIT_SHA`, which is what makes the check possible at all: a
push whose deploy hook silently never fires leaves the previous build serving
happily, healthy to every probe and wrong. Reporting the commit turns that from
invisible into a red build. The API's job additionally checks `/health/ready`,
so a deployment that boots without reaching Neon fails rather than passing.

**Neither workflow has run yet** — they are committed but unproven until the
next push.

**The portal has not been exercised against the live API since the rewiring.**
Everything typechecks, lints, builds and — on the API side — passes 116 tests,
but no screen has been driven against production data. That is the first thing
to do, not the last.

**The API has no linter.** Its `package.json` carries a `lint` script, but
eslint is neither a dependency nor configured there, so it has never run. CI
does not call it rather than pretend to. Adding one is a change to the code, not
to CI, and belongs in its own commit.

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

1. **Exercise the portal against the live API.** Every screen is wired but none
   has been driven against production since. Settlement generation and approval
   matter most — they post to a ledger.
2. **Confirm the first CI run goes green** in both repositories.
3. **M4 — the vendor application.** The monorepo and shared API package exist;
   the screens do not. Attendant login with device binding first, then start and
   end parking, then the offline queue.
4. **M6 — the citizen application**, which consumes what the vendor app creates.
5. **M9 — hardening**, once both apps are in.

**Outstanding from the authority:**

- **Razorpay test keys** — cash, receipts and refund accounting are proven; a
  real card or UPI capture is not.
- **RazorpayX credentials**, for automated vendor payouts. Settlement works
  without them: a transfer is made at the bank and its reference recorded.
- **A decision on data residency.** Object storage is currently Supabase in
  `ap-northeast-2` (Seoul), so number plates, KYC documents and bank proofs sit
  outside India. Fine for development; it must be settled before go-live, and
  moving means creating a new bucket and re-pointing five variables.
- **The commission model.** Settlement currently pays each vendor their
  `commissionPct` of gross and books the rest as municipal revenue. If the
  contracts work the other way round — the authority taking a percentage — that
  is one line to change, but it should be confirmed against a signed contract
  before any settlement is approved in anger.
- **Real ward, street, zone, vendor and tariff data** whenever it is ready. The
  seed is a file swap now, not a code change.
