# Personal data breach — response runbook

**Platform:** KMCP Smart Street Parking Management System
**Applies to:** Kolkata Municipal Corporation (the **Data Fiduciary**) and the platform operator (the **Data Processor**)
**Statutes:** Digital Personal Data Protection Act 2023 and the rules made under it; the CERT‑In Directions of 28 April 2022 issued under section 70B(6) of the Information Technology Act 2000
**Owner:** the authority's designated data protection officer
**Review:** annually, and after every invocation

---

## 0. Read this first

Two obligations run in parallel from the same moment and they are **not** the same obligation. Confusing them is the most common way an organisation misses a deadline it was otherwise ready for.

| | CERT‑In | DPDP Board and individuals |
|---|---|---|
| Triggered by | a *cyber incident* of a specified kind | a *personal data breach* |
| Clock | **6 hours** from noticing, or from being told | **without delay**, then a fuller report |
| Reported to | CERT‑In | the Data Protection Board of India, **and** every affected individual |
| Threshold | the incident types listed in the Directions | none — see §3 |

An event can be one, the other, or both. A ransomware attack on the database is both. A misdirected receipt SMS containing another citizen's registration number is a personal data breach and is not a CERT‑In incident. An unsuccessful port scan is neither.

**There is no severity threshold under the DPDP Act.** Unlike the GDPR, the Act does not permit the fiduciary to decide that a breach is unlikely to result in risk and therefore need not be notified. Section 8(6) requires intimation to the Board *and* to each affected Data Principal for every personal data breach. Any instinct to triage a small breach out of scope is wrong here, and the instinct is strong — plan for it.

---

## 1. What counts as a personal data breach here

The Act defines it as any unauthorised processing, or accidental disclosure, acquisition, sharing, use, alteration, destruction or loss of access, that compromises the **confidentiality, integrity or availability** of personal data.

Read against what this platform actually holds:

| Category | Held where | Why a breach of it matters |
|---|---|---|
| Registration numbers | `Vehicle`, `ParkingSession.plateNumber` | Resolvable to an individual through the RTO register. Treat as identifying. |
| Mobile numbers, email | `User` | The primary contact identifier and the login credential. |
| Timestamped photographs of vehicles at kerbs | object storage, `Media` | Places a named person at a place and time. The most sensitive thing here. |
| GPS traces | `ParkingSession.start/endLat/Lng`, `AuthEvent.gps*` | A movement pattern. Home and workplace are trivially inferable from a month of it. |
| Sign‑in records | `AuthEvent`, `LoginSession` | IP, city, ISP, device fingerprint. |
| Payment records | `Payment`, `Receipt` | Gateway references, not card numbers — the platform never stores card data. |
| Vendor KYC | `VendorDocument` → `Media` | PAN, GST, bank proof. Personal data of the vendor's officers. |

Three cases that are breaches and are easy to miss:

1. **Availability.** Data the authority can no longer reach is a breach of availability. A ransomware event, an irrecoverable database loss, or a bucket deleted in error all qualify.
2. **Accidental destruction.** A retention period set wrongly — 9 days where 90 was intended — destroys data ahead of its schedule. That is accidental destruction of personal data and is reportable. This is precisely why `retention.dryRun` ships enabled and why every purge writes an audit row; see §6.
3. **Excess disclosure inside the platform.** A permission change that lets a vendor read another vendor's sessions is unauthorised processing even though nothing left the system.

---

## 2. Decision tree

Start the moment anyone — an officer, an attendant, the operator's on‑call engineer, a citizen, a researcher — reports something. **Start the clock at that moment, not when it is confirmed.** The six‑hour CERT‑In window runs from "noticing the incident or being brought to notice", not from the conclusion of the investigation.

```
                      Something has been reported
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
     Does it involve any system,      No system involvement and
     account, credential, or          no personal data involved
     stored personal data of                    │
     the platform?                              ▼
                    │                    Log it. Close it.
                    ▼                    No notification.
     ┌──────────────┴───────────────┐
     ▼                              ▼
 CYBER INCIDENT?               PERSONAL DATA BREACH?
 (unauthorised access,         (confidentiality, integrity
  ransomware, data breach,      or availability of personal
  identity theft, phishing,     data compromised — including
  compromise of a critical      accidental destruction and
  system, malicious code,       loss of access)
  attacks on the API,                     │
  fake mobile app, …)                     │
     │                                    │
     ▼                                    ▼
 REPORT TO CERT-IN                  ┌─────┴──────┐
 within 6 HOURS of                  ▼            ▼
 noticing (§4)                    YES           NO
                                    │            │
                                    │            └─► No DPDP notification.
                                    │                Record the assessment
                                    │                and why. Keep it.
                                    ▼
                        ┌───────────────────────┐
                        │ Both limbs apply?     │
                        │ Then do both, in      │
                        │ parallel, from now.   │
                        └───────────┬───────────┘
                                    ▼
             1. INTIMATE THE BOARD — without delay (§5.1)
             2. INTIMATE EVERY AFFECTED INDIVIDUAL — without delay (§5.2)
             3. DETAILED REPORT TO THE BOARD — within 72 hours (§5.3)
             4. Contain, remediate, review (§7)
```

**Never** delay a notification while the investigation continues. Both regimes expect an initial intimation on incomplete facts, updated as more is known. An accurate report on day four is a late report.

---

## 3. Who decides what

| Decision | Who | Cannot be delegated to |
|---|---|---|
| Declare an incident open, start the clock | whoever receives the report, immediately | anyone — this is a duty on the receiver |
| Assess whether it is a personal data breach | the authority's data protection officer | the operator |
| Assess whether it is a CERT‑In reportable incident | the authority's IT security officer, advised by the operator | — |
| Sign the CERT‑In report | the authority's designated point of contact registered with CERT‑In | the operator |
| Sign the intimation to the Board | the data protection officer, on behalf of the Data Fiduciary | the operator |
| Approve the wording sent to affected individuals | the data protection officer | the operator's engineers |
| Decide to take a system offline | the authority's IT head, on the operator's recommendation | — |
| Preserve evidence and logs | the operator, on instruction, immediately | — |

The operator is the **Data Processor**. It investigates, preserves, supplies facts, drafts, and advises. It does not decide whether to notify and it does not notify anybody on its own account. Its obligation is to inform the authority immediately and completely, and to do nothing that would prejudice the authority's ability to meet its own deadlines — including **not** purging, rotating or overwriting anything.

**First action on any suspected breach: freeze destruction.** Set `retention.legalHold` to `true` (Settings → Backup & data → Retention, or `PUT /config/retention.legalHold`). The scheduled purge then counts and destroys nothing until the hold is lifted. Do this before the investigation starts, not after.

---

## 4. CERT‑In — the six-hour limb

**Deadline:** 6 hours from noticing the incident or being brought to notice of it.

**Reportable incident types** include, among others: targeted scanning or probing of critical systems; compromise of critical systems or information; unauthorised access to IT systems or data; defacement or intrusion into a website; malicious code attacks including ransomware; attacks on servers, network appliances, applications such as APIs, and databases; identity theft, spoofing and phishing attacks; data breach and data leak; attacks on Internet‑of‑Things devices; and fake mobile applications. Consult the current Directions and the annexure for the operative list.

**How to report:** email `incident@cert-in.org.in`, the CERT‑In incident reporting form, phone `1800‑11‑4949`, or fax `1800‑11‑6969`. Use the channel the authority has already registered; do not improvise one during an incident.

**What CERT‑In asks for:** when it was noticed and by whom; the affected systems and their addresses; the nature and scope of the incident; the impact; what has been done so far; and a point of contact.

**Two standing obligations the Directions place on the platform, which must already be true before an incident:**

- **ICT logs retained for 180 days in a rolling manner, within Indian jurisdiction.** The retention periods in §6 for `AuthEvent` and `LoginSession` are set to 180 days for exactly this reason. Shortening either below 180 days puts the authority in breach of the Directions, and the settings screen says so beside the field.
- **Clocks synchronised** to the NIC or NPL network time servers, so that the platform's timestamps and a third party's agree.

---

## 5. DPDP — the Board and the individuals

### 5.1 Intimation to the Data Protection Board — without delay

On becoming aware, the Data Fiduciary intimates the Board with the facts then known: a description of the breach, its nature and extent, when and where it occurred, and the broad facts of how it happened.

### 5.2 Intimation to each affected Data Principal — without delay

Given to each affected individual, in clear and plain language, through the user account or whatever mode of communication was registered. It must set out:

- a description of the breach, its nature, extent and timing;
- the likely consequences for that person;
- the measures the Fiduciary has taken or is taking to mitigate risk;
- the safety measures that person may take to protect their own interests;
- the business contact details of a person able to answer questions on the Fiduciary's behalf.

**Every affected individual.** There is no threshold to fall below and no "high risk" test to fail. If the platform cannot enumerate the affected individuals, that is a finding, not an excuse — see §6 on the media access gap.

### 5.3 Detailed report to the Board — within 72 hours

Within 72 hours of becoming aware, or such longer period as the Board allows on request:

- updated and detailed information about the breach;
- the broad facts, circumstances and reasons leading to it;
- the mitigation measures implemented;
- findings on whoever caused it;
- remedial measures taken to prevent recurrence;
- **a report of the intimations given to affected Data Principals** — which is why the delivery log in §6 matters as evidence, not merely as operational plumbing.

> These timelines reflect the rules made under the Act. Confirm the operative wording of the notified rules with the authority's legal cell before the first invocation, and again at each annual review. The runbook is a procedure, not legal advice.

---

## 6. What the platform can supply

Everything in this section is available today. Named by table and by endpoint, so that during an incident nobody is searching for it.

### Who did what, and when

**`AuditLog`** — every business mutation, with the acting user, the entity, the before and after values, the IP, the user agent, the device id and the request id. Retained **seven years**.

`GET /audit` (`audit.read`), filterable by entity, entity id, actor and action. `POST /documents/audit-trail` renders a signed PDF extract suitable for attaching to a report.

This is the primary evidence for integrity breaches: who changed a permission, who published a tariff, who blacklisted an account.

### Who signed in, from where, and on what

**`AuthEvent`** — every sign-in, success and failure, with IP, city, region, country, ISP, ASN, VPN/proxy detection, browser, OS, device fingerprint, client time zone, an anomaly array and a risk score. Failures record the identifier that was tried even when no such account exists, which is what makes credential stuffing visible. Retained **180 days**, per the CERT‑In logging obligation.

**`LoginSession`** — live and historical sessions with the same context, and revocation timestamps and reasons.

**`TrustedLoginLocation`** — which (user, IP) pairs an officer has approved, and who approved them.

`GET /activity/events`, `GET /activity/timeline/:userId`, `GET /activity/sessions` (`audit.read`). `POST /activity/sessions/:id/revoke` ends a session immediately — the containment action for a compromised account.

### What was sent to whom

**`Notification`** — every message on every channel (push, SMS, WhatsApp, email, in-app) with the template, the payload, the provider reference, the delivery status and the send timestamp. Retained **180 days**.

This log does double duty. During the investigation it establishes what was disclosed to whom. Afterwards it is the **evidence that the §5.2 intimations were actually delivered**, which is a required element of the 72-hour report. Send the intimations through the platform's own messaging path, not from somebody's mail client, precisely so that this record exists.

`GET /messaging/deliveries` (`audit.read`).

### What one individual's exposure actually was

`GET /privacy/citizens/:id/export` (`user.manage`) assembles everything held about one citizen — profile, vehicles, sessions, payments, receipts, passes, feedback, incidents they raised, notification deliveries, consent history, and the media ids of evidence featuring their vehicles.

During a breach this answers the question the §5.2 intimation has to answer: *what of mine was involved.* Every invocation is itself audited against the officer who ran it.

### Consent, and the notice it was given against

**`ConsentRecord`** — an append-only ledger of every consent decision: the purpose, whether it was granted, withdrawn or denied, the CMS slug and version stamp of the privacy notice in force at that moment, the channel, the IP, the user agent and the request id.

`GET /privacy/citizens/:id/consents` (`user.manage`); `GET /privacy/consents/summary` (`config.write`).

Relevant to a breach in two ways: it establishes the lawful basis on which the compromised data was held at all, and it identifies the contact channel each individual actually agreed to be reached on.

### What was destroyed, and on whose schedule

**`AuditLog`** rows with action `RETENTION_SWEEP` and `RETENTION_PURGE` record every run of the retention engine: the class, the period applied, the cutoff, the number of rows destroyed, the number held back, and whether the run was a dry run. A summary row is written even on runs that destroyed nothing.

`GET /privacy/retention` (`config.write`) shows the schedule as it is actually running, including whether each period is the authority's own decision or still the seeded default.

Two uses. If the suspicion is that data was destroyed early, these rows establish what was destroyed and under which configured period. If the Board asks whether the authority enforces its own published retention commitment, these rows are the proof that it does.

### Known gaps — state them, do not discover them

1. **Reads of evidence files are not audited.** `MediaService.signedUrl` authorises every read through `MediaAccessService` and refuses correctly, but issuing a signed URL writes no audit row. A confidentiality breach involving evidence photographs therefore **cannot be scoped from the platform alone** — we can say who was *entitled* to read a file, not who did. If the scope of a breach turns on this, say so plainly in the report rather than implying a completeness the logs do not have. *Recommendation: add an audit row on signed-URL issuance for `SESSION_EVIDENCE_*` and `KYC_DOCUMENT`. Until then, object storage access logs at the provider are the only source, and they are outside this platform's retention guarantees.*
2. **Object storage lifecycle is not the platform's.** The retention engine deletes objects it knows about. Anything written to the bucket outside the `Media` table — a manual upload, a restored backup — is invisible to it.
3. **Backups are the database provider's.** Point-in-time recovery holds data that the purge has already destroyed in the live database, for the length of the provider's window. A restore can therefore resurrect records that were lawfully destroyed. **Any restore must be followed by an immediate purge run**, and that step belongs in the restore procedure, not only here.

---

## 7. The first two hours

A checklist, in order. Assign each line to a named person at the start, not as you reach it.

1. **Record the time** you were told, and by whom, verbatim. Both clocks start here.
2. **Freeze destruction.** Set `retention.legalHold` to `true`. Confirm from `GET /privacy/retention` that it reads back as true.
3. **Preserve.** No log rotation, no bucket cleanup, no redeploy that would cycle a container, no credential rotation until the credentials have been captured as evidence.
4. **Contain**, if containment is possible without destroying evidence: revoke the affected sessions (`POST /activity/sessions/:id/revoke`), suspend the account (`POST /citizens/:id/status`), rotate the exposed secret, close the public route.
5. **Notify internally**: the data protection officer and the IT security officer, by telephone, not by email alone.
6. **Classify** against §2. Write down the answer and the reasoning. If unsure whether it is a personal data breach, proceed as though it is.
7. **CERT‑In**, if reportable — draft immediately and send inside six hours, on the facts known. State plainly what is not yet known.
8. **Board and individuals**, if a personal data breach — intimate without delay on the facts known.
9. **Scope**: identify the affected individuals. Use the export endpoint per individual where the set is small; where it is large, the audit and delivery logs establish the boundary.
10. **72-hour report**: assemble from §6 and send.
11. **Lift the legal hold** only when the data protection officer confirms in writing that no further preservation is required. Expect a backlog to purge over the days that follow — that is the sweep working as designed.
12. **Post-incident review** within fourteen days: what happened, what the platform could and could not tell us, and what changes to §6's gap list.

---

## 8. Contacts

| Role | Name | Telephone | Email |
|---|---|---|---|
| Data protection officer (Data Fiduciary) | *to be completed by the authority* | | |
| IT security officer | *to be completed by the authority* | | |
| CERT‑In registered point of contact | *to be completed by the authority* | | |
| Platform operator, on-call | *to be completed by the operator* | | |
| Legal cell | *to be completed by the authority* | | |

CERT‑In incident reporting: `incident@cert-in.org.in` · `1800‑11‑4949` · fax `1800‑11‑6969`

**This table is the part of the document that stops working first.** Verify it at every annual review, and after any change of officer. A runbook with a wrong telephone number in it costs hours that the six-hour clock does not have.
