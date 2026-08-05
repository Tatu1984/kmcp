---
title: "Scope of Work"
subtitle: "KMCP — Smart Street Parking Management System"
---

# Document Control

| Field | Detail |
|---|---|
| Product name | Smart Street Parking Management System |
| Project codename | **KMCP** |
| Document | Scope of Work (SoW) |
| Version | 1.0 |
| Status | For review and sign-off |
| Scope basis | *Feature List & Functional Scope* (`kmcpfl.docx`) |
| Delivery model | Single full-stack web platform + two lightweight mobile applications |
| Phase note | AI/ANPR automatic plate recognition is **deferred to Phase 2**. Phase 1 uses attendant photo capture with manual number entry. |

---

# 1. Purpose, Problem and Impact

## 1.1 Why we are building this

The KMCP Smart Street Parking Management System is being built to replace the paper-slip, cash-in-pocket reality of government-approved on-street parking with a single, auditable digital ecosystem that a municipal authority can actually see and control in real time. Today, a citizen parks on an authorised stretch of road, an attendant tears off a printed ticket, quotes a number, takes cash, and the transaction ends there — no record the municipality can verify, no evidence the vehicle was ever parked, no way to confirm that the rate charged was the rate approved. The intention behind this platform is to make every single parking event a first-class digital record: created the moment a vehicle arrives, priced automatically from a government-approved tariff that only an authorised officer can change, evidenced by a timestamped and geotagged photograph, paid for through a traceable channel, receipted to the citizen, reconciled against the attendant's shift at the end of the day, and settled to the vendor with the municipality's share computed and ledgered by the system rather than negotiated by hand. The problem it solves is threefold and each part is expensive today — **revenue leakage**, because unrecorded cash collection and under-quoted tariffs mean a material share of what citizens pay never reaches the municipal treasury; **zero operational visibility**, because authorities have no live view of which zones are full, which vendors are performing, or where demand actually is, and therefore plan parking capacity, contract renewals and tariff revisions on guesswork; and **citizen friction and disputes**, because drivers circle congested streets hunting for a space, cannot verify what they were charged, hold no receipt, and have no channel to escalate an overcharge or a damaged vehicle. The positive impact is direct and measurable on all three sides: the **municipality** gains a real-time revenue and occupancy picture, a complete audit trail that stands up to scrutiny, tariff enforcement that cannot be bypassed at the kerb, and demand data that turns parking policy into an evidence-based decision; the **vendor and attendant** gain a faster kerbside workflow that works even where the network does not, an end-of-shift cash reconciliation that protects them from accusation as much as it protects the authority, and settlements that arrive on a predictable, automated cycle instead of a disputed manual one; and the **citizen** gains the ability to find an available authorised space before setting out, see exactly what is being charged and why, pay digitally, hold a GST-compliant receipt, and find their own vehicle again — while the street itself benefits from the reduced circling, congestion and emissions that come from making legitimate parking easy to find and illegitimate parking easy to detect. Beyond the immediate operational win, the platform is deliberately built as the digital spine for everything the authority will want next — enforcement and e-challan, resident permits, FASTag and RFID passes, IoT slot sensors, ANPR gantries and smart-city command-centre integration — so that this investment becomes the foundation of the city's parking infrastructure rather than a standalone application that must be replaced to grow.

## 1.2 The problem, stated precisely

| # | Problem today | Consequence |
|---|---|---|
| P1 | Manual paper ticketing with no central record | Revenue leakage; no reconciliation possible |
| P2 | Tariffs applied at the discretion of the attendant | Citizens overcharged; approved rates unenforceable |
| P3 | Cash-dominant collection with no deposit trail | Disputes between vendor, attendant and authority |
| P4 | No evidence that a vehicle was parked, or for how long | Every dispute is one person's word against another's |
| P5 | No live occupancy data | Drivers circle; authorities cannot plan capacity |
| P6 | Vendor settlement computed manually on spreadsheets | Delayed payouts, commission errors, audit exposure |
| P7 | No citizen-facing channel | No receipts, no complaints route, no transparency |
| P8 | Fragmented, non-existent reporting | Policy and contract decisions made without data |

## 1.3 The impact we expect

| Stakeholder | Impact |
|---|---|
| Municipal authority | Real-time revenue and occupancy visibility; enforced tariffs; complete audit trail; automated government-share computation; data-driven parking policy |
| Parking vendor | Faster kerbside workflow; works offline; automated commission and settlement; transparent performance record |
| Parking attendant | Under-3-second vehicle registration; no arithmetic at the kerb; protected by evidence and shift reconciliation |
| Citizen | Find authorised parking before setting out; transparent pricing; digital payment; GST receipt; complaint channel; vehicle locator |
| City / public | Less circling and congestion, lower emissions, orderly kerbside, foundation for future smart-city services |

---

# 2. Solution Overview

The platform is delivered as **one backend and three clients**, all speaking to the same versioned REST API.

| # | Platform | Users | Form factor |
|---|---|---|---|
| 1 | **Admin Portal** | Municipal / corporation officers, auditors, zone officers | Web application (Next.js) |
| 2 | **Vendor Mobile Application** | Parking operators and their attendants | Android + iOS (React Native / Expo) |
| 3 | **Citizen Mobile Application** | Vehicle owners | Android + iOS (React Native / Expo) |

**Mobile design principle — deliberately thin.** Both mobile applications are API-driven shells. They render server-supplied data and capture input; they do **not** hold business logic. Fare computation, tariff resolution, zone geo-fencing, duplicate detection, commission splitting and every other rule lives on the server. This keeps both apps small, fast on low-end Android devices, cheap to update (a tariff change ships without an app release), and consistent across the three clients — a rule can never drift between the vendor app, the citizen app and the portal because there is only one copy of it.

---

# 3. Feature List

Legend: **P1** = Phase 1, in scope now. **P2** = Phase 2, deferred (AI / advanced automation).

## 3.1 Core Platform Features

### 3.1.1 Vehicle Capture and Identification

| # | Feature | Phase |
|---|---|---|
| 1 | Capture vehicle number plate photograph using the device camera | P1 |
| 2 | Manual entry of the vehicle registration number with format assistance | P1 |
| 3 | Indian registration format validation and auto-formatting (e.g. `WB 02 AB 1234`) | P1 |
| 4 | Recent / repeat vehicle suggestions to speed up entry | P1 |
| 5 | Automatic duplicate active-session detection for the same plate | P1 |
| 6 | Vehicle image stored as tamper-evident, timestamped, geotagged evidence | P1 |
| 7 | Offline capture with deferred synchronisation | P1 |
| 8 | Capture-to-session-started in under 3 seconds on a mid-range Android device | P1 |
| 9 | AI-powered OCR / ANPR automatic plate recognition | **P2** |
| 10 | Multi-regional plate format recognition, image enhancement, blur reduction | **P2** |

### 3.1.2 Parking Timer Engine

| # | Feature | Phase |
|---|---|---|
| 1 | Timer starts automatically on vehicle registration | P1 |
| 2 | Automatic tariff calculation at end of session | P1 |
| 3 | Multi-tier / slab pricing | P1 |
| 4 | Per-minute, half-hourly and hourly billing units | P1 |
| 5 | Grace period support | P1 |
| 6 | Daily maximum charge cap | P1 |
| 7 | Night parking pricing | P1 |
| 8 | Weekend pricing | P1 |
| 9 | Public holiday pricing | P1 |
| 10 | Special event pricing | P1 |
| 11 | Government tax (GST) computation | P1 |
| 12 | Overstay penalty computation | P1 |
| 13 | Live running-charge display to citizen and attendant | P1 |

### 3.1.3 Dynamic Pricing Engine

Administrator-configurable pricing dimensions, all **P1**:

| # | Pricing dimension |
|---|---|
| 1 | Vehicle type |
| 2 | Parking zone |
| 3 | Time of day |
| 4 | Peak hours |
| 5 | Weekdays |
| 6 | Weekends |
| 7 | Public holidays |
| 8 | Commercial vehicles |
| 9 | VIP zones |
| 10 | Event pricing |
| 11 | Subscription users |
| 12 | Monthly pass holders |

Occupancy-responsive dynamic pricing (rate reacting automatically to live utilisation) is **P2**.

## 3.2 Module 1 — Admin Portal

### 3.2.1 Dashboard

| # | Feature | Phase |
|---|---|---|
| 1 | Live parking occupancy across all zones | P1 |
| 2 | Active vehicles count | P1 |
| 3 | Available slots | P1 |
| 4 | Total daily revenue | P1 |
| 5 | Monthly revenue | P1 |
| 6 | Vendor collection | P1 |
| 7 | Pending vendor payments | P1 |
| 8 | Cash vs digital collection split | P1 |
| 9 | UPI collection | P1 |
| 10 | QR payment collection | P1 |
| 11 | Parking heat map | P1 |
| 12 | Top performing zones | P1 |
| 13 | Low occupancy zones | P1 |
| 14 | Live activity feed | P1 |

### 3.2.2 Parking Zone Management

| # | Feature | Phase |
|---|---|---|
| 1 | Create and manage parking zones | P1 |
| 2 | Streets and roads registry | P1 |
| 3 | Wards and municipal divisions hierarchy | P1 |
| 4 | Geo-fenced parking areas with GPS boundary polygons | P1 |
| 5 | Zone GPS coordinates and centre point | P1 |
| 6 | Parking capacity and per-vehicle-type limits | P1 |
| 7 | Parking timings / working hours | P1 |
| 8 | Zone status: open / closed | P1 |
| 9 | Temporary closures | P1 |
| 10 | Maintenance closures | P1 |
| 11 | Event closures | P1 |
| 12 | Per-zone attributes: name, code, boundary, capacity, permitted vehicle types, charges, vendor assignment, working hours | P1 |

### 3.2.3 Parking Slot Management

| # | Feature | Phase |
|---|---|---|
| 1 | Total slot definition per zone | P1 |
| 2 | Reserved slots | P1 |
| 3 | Accessible / disabled parking slots | P1 |
| 4 | EV charging slots | P1 |
| 5 | VIP slots | P1 |
| 6 | Government reserved slots | P1 |
| 7 | Commercial parking slots | P1 |
| 8 | Bus parking slots | P1 |
| 9 | Two-wheeler slots | P1 |
| 10 | Car slots | P1 |

### 3.2.4 Vendor Management

| # | Feature | Phase |
|---|---|---|
| 1 | Vendor registration | P1 |
| 2 | Vendor approval workflow | P1 |
| 3 | Vendor KYC capture and verification | P1 |
| 4 | Agreement document upload | P1 |
| 5 | GST details | P1 |
| 6 | PAN details | P1 |
| 7 | Bank account details (for settlement payout) | P1 |
| 8 | Assign parking zones to vendor | P1 |
| 9 | Multiple zone assignment | P1 |
| 10 | Vendor performance metrics | P1 |
| 11 | Vendor rating | P1 |
| 12 | Vendor revenue view | P1 |
| 13 | Vendor commission configuration | P1 |
| 14 | Suspend vendor | P1 |
| 15 | Block vendor | P1 |
| 16 | Vendor login and device management | P1 |

### 3.2.5 Parking Attendant Management

| # | Feature | Phase |
|---|---|---|
| 1 | Create attendant / staff records | P1 |
| 2 | Assign attendant to vendor | P1 |
| 3 | Assign attendant to parking zone | P1 |
| 4 | Attendance register | P1 |
| 5 | GPS tracking of check-in / check-out | P1 |
| 6 | Login history | P1 |
| 7 | Performance metrics | P1 |
| 8 | Vehicles parked count | P1 |
| 9 | Daily collection per attendant | P1 |
| 10 | Shift management | P1 |

### 3.2.6 Tariff Management

| # | Feature | Phase |
|---|---|---|
| 1 | Base rate configuration | P1 |
| 2 | Hourly rate | P1 |
| 3 | Per-minute rate | P1 |
| 4 | Daily maximum | P1 |
| 5 | Monthly pass definition | P1 |
| 6 | Season pass definition | P1 |
| 7 | Commercial vehicle pricing | P1 |
| 8 | Festival pricing | P1 |
| 9 | VIP pricing | P1 |
| 10 | Discount rules | P1 |
| 11 | Effective-dated tariff versions with approval trail | P1 |
| 12 | Tariff preview / quote calculator before publishing | P1 |

### 3.2.7 Revenue Management

| # | Feature | Phase |
|---|---|---|
| 1 | Daily revenue | P1 |
| 2 | Weekly revenue | P1 |
| 3 | Monthly revenue | P1 |
| 4 | Annual revenue | P1 |
| 5 | Zone-wise revenue | P1 |
| 6 | Vendor-wise revenue | P1 |
| 7 | Cash collection | P1 |
| 8 | UPI collection | P1 |
| 9 | Wallet collection | P1 |
| 10 | Outstanding payments | P1 |
| 11 | Government share | P1 |
| 12 | Vendor share | P1 |
| 13 | Commission reports | P1 |

### 3.2.8 Vendor Settlement System

| # | Feature | Phase |
|---|---|---|
| 1 | Daily settlement cycle | P1 |
| 2 | Weekly settlement cycle | P1 |
| 3 | Monthly settlement cycle | P1 |
| 4 | Automatic commission deduction | P1 |
| 5 | Settlement approval workflow | P1 |
| 6 | Bank transfer / payout status tracking | P1 |
| 7 | Settlement history | P1 |
| 8 | Settlement reports | P1 |
| 9 | Downloadable statements (PDF / Excel) | P1 |
| 10 | Double-entry settlement ledger | P1 |

### 3.2.9 User Management

| # | Feature | Phase |
|---|---|---|
| 1 | Citizen registration records | P1 |
| 2 | Optional user approval | P1 |
| 3 | Blacklisted users | P1 |
| 4 | Vehicle history per user | P1 |
| 5 | Parking history per user | P1 |
| 6 | Subscription management | P1 |
| 7 | Monthly pass management | P1 |

### 3.2.10 Reports and Analytics

| # | Feature | Phase |
|---|---|---|
| 1 | Report by date / date range | P1 |
| 2 | Report by vendor | P1 |
| 3 | Report by zone | P1 |
| 4 | Report by street | P1 |
| 5 | Report by parking type | P1 |
| 6 | Report by vehicle type | P1 |
| 7 | Revenue reports | P1 |
| 8 | Occupancy reports | P1 |
| 9 | Violation reports | P1 |
| 10 | Cash collection reports | P1 |
| 11 | Digital collection reports | P1 |
| 12 | Export to PDF | P1 |
| 13 | Export to Excel | P1 |
| 14 | Export to CSV | P1 |
| 15 | Scheduled / recurring report delivery | P1 |

### 3.2.11 Notifications (Admin)

| # | Feature | Phase |
|---|---|---|
| 1 | Zone full alerts | P1 |
| 2 | Vendor alerts | P1 |
| 3 | Parking violation alerts | P1 |
| 4 | Revenue threshold alerts | P1 |
| 5 | Payment failure alerts | P1 |
| 6 | Vehicle overstay alerts | P1 |
| 7 | Emergency broadcast notifications | P1 |

### 3.2.12 Audit and Compliance

| # | Feature | Phase |
|---|---|---|
| 1 | Complete audit trail (before/after on every mutation) | P1 |
| 2 | Login logs | P1 |
| 3 | Transaction logs | P1 |
| 4 | Activity logs | P1 |
| 5 | Device logs | P1 |
| 6 | GPS logs | P1 |
| 7 | Immutable evidence store for captured images | P1 |

### 3.2.13 Content Management (CMS)

| # | Feature | Phase |
|---|---|---|
| 1 | FAQs | P1 |
| 2 | Terms and conditions | P1 |
| 3 | Privacy policy | P1 |
| 4 | About us | P1 |
| 5 | Contact details | P1 |
| 6 | Announcement banner | P1 |

### 3.2.14 System Configuration

| # | Feature | Phase |
|---|---|---|
| 1 | Tax configuration | P1 |
| 2 | QR payment settings | P1 |
| 3 | SMS gateway configuration | P1 |
| 4 | Email gateway configuration | P1 |
| 5 | Push notification configuration | P1 |
| 6 | Language configuration | P1 |
| 7 | Time zone | P1 |
| 8 | Currency | P1 |
| 9 | Backup settings | P1 |
| 10 | Role-based access control matrix | P1 |

## 3.3 Module 2 — Vendor Mobile Application

### 3.3.1 Dashboard

| # | Feature | Phase |
|---|---|---|
| 1 | Today's revenue | P1 |
| 2 | Vehicles parked today | P1 |
| 3 | Active parking sessions | P1 |
| 4 | Completed parking sessions | P1 |
| 5 | Pending payments | P1 |
| 6 | Collection summary | P1 |
| 7 | Wallet balance | P1 |
| 8 | Settlement due | P1 |

### 3.3.2 Start Parking

| # | Feature | Phase |
|---|---|---|
| 1 | Camera opens directly on the start screen | P1 |
| 2 | Capture number plate photograph | P1 |
| 3 | Type / correct the registration number | P1 |
| 4 | Vehicle type selection | P1 |
| 5 | Parking zone auto-detection from GPS | P1 |
| 6 | Optional parking slot assignment | P1 |
| 7 | Start parking with server-side duplicate check | P1 |
| 8 | Automatic OCR pre-fill of the plate number | **P2** |

### 3.3.3 End Parking

| # | Feature | Phase |
|---|---|---|
| 1 | Search vehicle by plate / mobile / parking ID | P1 |
| 2 | Re-capture plate photograph at exit | P1 |
| 3 | Automatic charge calculation (server-side) | P1 |
| 4 | Display total amount with breakdown | P1 |
| 5 | Payment collection | P1 |

### 3.3.4 Vehicle Categories

Two-wheeler, four-wheeler, three-wheeler, commercial vehicle, bus, truck, government vehicle, EV, VIP — all **P1**, admin-configurable.

### 3.3.5 Payment Collection

| # | Feature | Phase |
|---|---|---|
| 1 | Cash | P1 |
| 2 | UPI dynamic QR | P1 |
| 3 | Payment via customer app | P1 |
| 4 | Wallet | P1 |
| 5 | Corporate account | P1 |
| 6 | Monthly pass redemption | P1 |
| 7 | Digital receipt generation | P1 |
| 8 | SMS receipt | P1 |
| 9 | WhatsApp receipt | P1 |
| 10 | Email receipt | P1 |

### 3.3.6 Parking Search, History and Shift

| # | Feature | Phase |
|---|---|---|
| 1 | Search by number plate | P1 |
| 2 | Search by mobile number | P1 |
| 3 | Search by parking ID | P1 |
| 4 | Search by date | P1 |
| 5 | Search by vehicle type | P1 |
| 6 | Previous parking history for a vehicle | P1 |
| 7 | Outstanding amount against a vehicle | P1 |
| 8 | Repeat customer indicator | P1 |
| 9 | Monthly pass user indicator | P1 |
| 10 | Shift closing — cash summary | P1 |
| 11 | Shift closing — digital summary | P1 |
| 12 | Shift closing — total collection | P1 |
| 13 | Shift closing — pending collection | P1 |
| 14 | Deposit confirmation | P1 |

### 3.3.7 Vendor Accounts

| # | Feature | Phase |
|---|---|---|
| 1 | Today's earnings | P1 |
| 2 | Weekly earnings | P1 |
| 3 | Monthly earnings | P1 |
| 4 | Settlement pending | P1 |
| 5 | Settlement received | P1 |
| 6 | Commission view | P1 |
| 7 | Download statements | P1 |

### 3.3.8 Attendance, Incidents and Assistance

| # | Feature | Phase |
|---|---|---|
| 1 | Shift start | P1 |
| 2 | Shift end | P1 |
| 3 | GPS check-in | P1 |
| 4 | GPS check-out | P1 |
| 5 | Report illegal parking | P1 |
| 6 | Report accident | P1 |
| 7 | Report vehicle damage | P1 |
| 8 | Report parking dispute | P1 |
| 9 | Report wrong vehicle | P1 |
| 10 | Incident image upload | P1 |
| 11 | Incident notes | P1 |
| 12 | Call customer | P1 |
| 13 | SMS customer | P1 |
| 14 | Share parking location | P1 |
| 15 | Extend parking | P1 |
| 16 | Resolve payment issue | P1 |

### 3.3.9 Offline Mode

| # | Feature | Phase |
|---|---|---|
| 1 | Start parking while offline | P1 |
| 2 | End parking while offline | P1 |
| 3 | Store transactions locally in an encrypted queue | P1 |
| 4 | Automatic idempotent synchronisation on reconnect | P1 |
| 5 | Server-side conflict resolution and sync audit log | P1 |

## 3.4 Module 3 — Citizen Mobile Application

### 3.4.1 Registration and Garage

| # | Feature | Phase |
|---|---|---|
| 1 | Mobile OTP registration and login | P1 |
| 2 | Email capture | P1 |
| 3 | Vehicle registration | P1 |
| 4 | Multiple vehicles per user ("My Garage") | P1 |
| 5 | Profile management | P1 |
| 6 | Vehicle categories: car, bike, commercial, EV | P1 |

### 3.4.2 Live Parking Map and Availability

| # | Feature | Phase |
|---|---|---|
| 1 | Interactive map of nearby parking zones | P1 |
| 2 | Available slots per zone | P1 |
| 3 | Total capacity per zone | P1 |
| 4 | Occupied slots per zone | P1 |
| 5 | Parking charges per zone | P1 |
| 6 | Distance from current location | P1 |
| 7 | Operating hours | P1 |
| 8 | EV charging availability | P1 |
| 9 | Availability colour coding — green / yellow / red | P1 |
| 10 | GPS navigation to zone | P1 |
| 11 | Google Maps integration | P1 |
| 12 | Apple Maps integration | P1 |
| 13 | Distance and ETA | P1 |

### 3.4.3 Live Session and Payment

| # | Feature | Phase |
|---|---|---|
| 1 | Live session: start time | P1 |
| 2 | Live session: elapsed time | P1 |
| 3 | Live session: current charges | P1 |
| 4 | Live session: parking zone | P1 |
| 5 | Live session: attendant identity | P1 |
| 6 | Live session: vehicle details | P1 |
| 7 | Pay by UPI | P1 |
| 8 | Pay by QR code | P1 |
| 9 | Pay by net banking | P1 |
| 10 | Pay by credit card | P1 |
| 11 | Pay by debit card | P1 |
| 12 | Pay by wallet | P1 |
| 13 | Cash payment marked by vendor and reflected in app | P1 |

### 3.4.4 Receipts, History and Passes

| # | Feature | Phase |
|---|---|---|
| 1 | PDF receipt | P1 |
| 2 | GST invoice where applicable | P1 |
| 3 | Download receipt | P1 |
| 4 | Share receipt | P1 |
| 5 | Complete parking log / history | P1 |
| 6 | Charges paid, zone, duration, payment method per entry | P1 |
| 7 | Receipt download from history | P1 |
| 8 | Favourite parking zones | P1 |
| 9 | Home parking shortcut | P1 |
| 10 | Office parking shortcut | P1 |
| 11 | Purchase monthly pass | P1 |
| 12 | Renew pass | P1 |
| 13 | Pass history | P1 |
| 14 | Pass QR verification at the kerb | P1 |

### 3.4.5 Notifications, Locator and Support

| # | Feature | Phase |
|---|---|---|
| 1 | Parking started notification | P1 |
| 2 | Parking ending soon notification (optional) | P1 |
| 3 | Payment reminder | P1 |
| 4 | Vehicle moved alert | P1 |
| 5 | Parking completed notification | P1 |
| 6 | Offers | P1 |
| 7 | Municipal announcements | P1 |
| 8 | Last parked location | P1 |
| 9 | Map view of parked vehicle | P1 |
| 10 | Walking directions to vehicle | P1 |
| 11 | Contact parking operator | P1 |
| 12 | Contact municipal helpline | P1 |
| 13 | Report an issue | P1 |
| 14 | Rate parking experience | P1 |
| 15 | Rate vendor | P1 |
| 16 | Submit complaint | P1 |
| 17 | Upload images with complaint | P1 |

## 3.5 Fraud Prevention and Analytics

| # | Feature | Phase |
|---|---|---|
| 1 | Duplicate active-session detection per plate | P1 |
| 2 | GPS validation — attendant must be inside the zone geo-fence | P1 |
| 3 | Time validation — implausible durations and back-dated events flagged | P1 |
| 4 | Image evidence verification (hash, timestamp, geotag) | P1 |
| 5 | Device binding — an attendant account works only on its registered device | P1 |
| 6 | Cash variance detection at shift close | P1 |
| 7 | Peak hour analytics | P1 |
| 8 | Occupancy trend analytics | P1 |
| 9 | Fake / invalid number plate detection | **P2** |
| 10 | Parking demand prediction | **P2** |
| 11 | Revenue forecasting | **P2** |

## 3.6 Payment Methods

UPI, Bharat QR, dynamic QR, cash, credit card, debit card, net banking, wallet, monthly pass, corporate billing — all **P1**, delivered through Razorpay (collections) and RazorpayX (vendor payouts).

## 3.7 Reports

Revenue, occupancy, vendor, user, parking duration, daily collection, monthly collection, government revenue, vendor settlement, tax and audit reports — all **P1**, each exportable to PDF, Excel and CSV.

## 3.8 Security

| # | Feature | Phase |
|---|---|---|
| 1 | Role-based access control (RBAC) | P1 |
| 2 | Two-factor authentication for admin users | P1 |
| 3 | Secure API authentication (short-lived JWT + rotating refresh tokens) | P1 |
| 4 | Device binding for vendor and attendant accounts | P1 |
| 5 | Encryption in transit (TLS 1.3) and at rest | P1 |
| 6 | Audit logs | P1 |
| 7 | Automated backup and point-in-time recovery | P1 |
| 8 | DPDP Act / GDPR-ready data handling, consent and retention | P1 |
| 9 | Rate limiting, request signing on webhooks, replay protection | P1 |

## 3.9 Integrations

| # | Integration | Phase |
|---|---|---|
| 1 | UPI / payment gateway — Razorpay | P1 |
| 2 | Vendor payouts — RazorpayX | P1 |
| 3 | SMS gateway | P1 |
| 4 | WhatsApp Business messaging | P1 |
| 5 | Email service | P1 |
| 6 | Push notifications (FCM / APNs) | P1 |
| 7 | Google Maps | P1 |
| 8 | Apple Maps | P1 |
| 9 | GPS / geo-fencing services | P1 |
| 10 | OCR / ANPR engine | **P2** |
| 11 | Municipal ERP | Optional |
| 12 | Accounting systems | Optional |

## 3.10 Future Enhancements (Roadmap — outside this SoW)

Automatic ANPR cameras at zone entry/exit; FASTag integration; RFID-enabled monthly passes; AI-based illegal parking detection; EV charging reservation and payment; occupancy-driven dynamic pricing; advance parking reservation; digital resident parking permits; corporate fleet parking management; enforcement officer module with e-challan issuance; IoT per-slot occupancy sensors; CCTV integration for dispute resolution; smart-city command centre integration; carbon emission and congestion analytics; public API ecosystem for third-party navigation and mobility apps.

---

# 4. Technology Stack

## 4.1 Application platform

| Layer | Technology | Rationale |
|---|---|---|
| Web framework | **Next.js 16 (App Router)**, React 19, TypeScript 5 | One codebase serves the Admin Portal UI and the REST API; server components keep the portal fast on municipal networks |
| Language / runtime | TypeScript on Node.js 22 | Single language across web, API and mobile; shared types between client and server |
| API style | REST over HTTPS, versioned at `/api/v1` | Simple, cacheable, trivially consumable by thin mobile clients and future third parties |
| Validation | **Zod** on every request boundary | One schema drives runtime validation and TypeScript types |
| ORM / database access | **Prisma 7** with `@prisma/adapter-pg` | Type-safe queries, migration history, serverless-friendly pooling |

## 4.2 Data and storage

| Layer | Technology | Purpose |
|---|---|---|
| Primary database | **PostgreSQL (Neon)** | Transactional store; serverless autoscaling; point-in-time recovery |
| Geospatial | PostGIS-style geometry columns / Turf.js | Zone boundary polygons, point-in-polygon geo-fencing, nearest-zone search |
| Cache and counters | **Upstash Redis** | Live occupancy counters, session cache, rate limiting, idempotency keys |
| Object storage | **Cloudflare R2 / AWS S3** | Plate evidence images, KYC documents, generated receipts and report exports — uploaded directly from the device via presigned URLs |
| Background jobs | Vercel Cron + queue workers | Settlement runs, overstay sweeps, report generation, pass expiry |

## 4.3 Admin Portal (web)

| Concern | Technology |
|---|---|
| UI components | **shadcn/ui** on Tailwind CSS v4 |
| Motion / micro-interactions | reactbits.dev components |
| Data fetching / caching | TanStack Query |
| Client state | Zustand |
| Forms | react-hook-form + Zod resolver |
| Charts and analytics | Recharts |
| Maps and heat map | Google Maps JavaScript API + deck.gl heat layer |
| Tables | TanStack Table (virtualised, server-side pagination) |
| Exports | ExcelJS (xlsx/csv), React-PDF (pdf) |

## 4.4 Mobile applications (Vendor and Citizen)

Both apps are intentionally light — a thin rendering and capture layer over the API.

| Concern | Technology |
|---|---|
| Framework | **React Native via Expo SDK** (managed workflow), TypeScript |
| Navigation | expo-router |
| Camera | expo-camera (plate photograph capture) |
| Location | expo-location (GPS zone detection, geo-fencing, check-in/out) |
| Secure storage | expo-secure-store (tokens, device binding key) |
| Offline queue | expo-sqlite + purpose-built idempotent sync queue (Vendor app only) |
| Server state | TanStack Query with persisted cache |
| Push | expo-notifications over FCM / APNs |
| Maps | react-native-maps (Google Maps on Android, Apple Maps on iOS) |
| Payments | Razorpay React Native SDK (Citizen app) |
| Build and release | EAS Build / EAS Submit / EAS Update (over-the-air fixes) |

**Why thin matters here.** Attendants use low-cost Android devices on patchy street-level connectivity. No tariff table, commission rule or tax logic is shipped to the device — the app posts events and renders server responses. A tariff revision, a new vehicle category or a changed commission percentage takes effect immediately for every device without an app store release.

## 4.5 Integrations and external services

| Capability | Provider |
|---|---|
| Payments — UPI, dynamic QR, cards, net banking, wallets | **Razorpay** |
| Vendor settlement payouts | **RazorpayX** |
| SMS and WhatsApp receipts / OTP | MSG91 (or equivalent DLT-registered Indian gateway) |
| Transactional email | Resend |
| Push notifications | Expo Push → FCM / APNs |
| Maps, geocoding, directions | Google Maps Platform; Apple MapKit on iOS |
| PDF / GST invoice generation | React-PDF, server-rendered |

## 4.6 Security, quality and operations

| Concern | Technology / practice |
|---|---|
| Authentication | JWT access tokens (short TTL) + rotating refresh tokens, `jose` |
| Authorisation | Central RBAC policy layer enforced in middleware and re-checked in services |
| Admin 2FA | TOTP (authenticator app) |
| Device binding | Attendant sessions bound to a registered device fingerprint |
| Transport / at rest | TLS 1.3; AES-256 at rest; signed, expiring URLs for all evidence media |
| Secrets | Environment-scoped secret management, no secrets in the repository |
| Error and performance monitoring | Sentry (web, API, mobile) |
| Logging | Structured JSON logs shipped to Axiom / Better Stack |
| Testing | Vitest (unit), Supertest (API integration), Playwright (portal E2E), Maestro (mobile E2E) |
| CI/CD | GitHub Actions → Vercel (web/API), EAS (mobile) |
| Hosting | Vercel (application), Neon (database), Cloudflare R2 (media) |

## 4.7 Phase 2 (AI) stack — for reference only

ANPR/OCR engine (Plate Recognizer / Google Cloud Vision / self-hosted PaddleOCR), on-device pre-processing for image enhancement, and a forecasting service for demand prediction and revenue projection. Phase 2 attaches at the capture step only; no downstream flow changes.

---

# 5. Milestones and Deliverables

Milestones are expressed as sequenced, independently verifiable delivery gates rather than calendar dates. Indicative effort is given for planning and staffing only.

| # | Milestone | Scope delivered | Exit criteria | Indicative effort |
|---|---|---|---|---|
| **M0** | Foundation | Repository, folder architecture, CI/CD, environments, Neon database, Prisma schema v1, auth (JWT + refresh + RBAC), design system, API conventions, seed data | A protected endpoint returns data for a seeded admin user in the staging environment; CI green | 2 weeks |
| **M1** | Master data and Admin Portal core | Wards, streets, zones with geo-fence boundaries, slots, vehicle types, vendors + KYC + zone assignment, attendants, admin user management, RBAC matrix, CMS, system configuration | An officer can configure a complete zone with capacity, timings, permitted vehicle types and an assigned vendor, end to end in the portal | 3 weeks |
| **M2** | Tariff and pricing engine | Tariff versions, slabs, per-minute/hourly rates, daily cap, grace period, peak/weekend/holiday/event/VIP/commercial rules, discounts, tax, quote preview API | The quote API returns the correct payable amount for a documented matrix of test cases covering every pricing dimension | 2.5 weeks |
| **M3** | Parking session lifecycle | Start/end session, evidence capture and upload, GPS geo-fence validation, duplicate detection, live timer, occupancy counters, overstay detection, session search | A session can be started and ended against a real zone with evidence stored and the correct fare computed | 2.5 weeks |
| **M4** | Vendor Mobile Application | Attendant login + device binding, dashboard, start parking (photo + manual plate entry), end parking, vehicle search, vehicle history, incidents, customer assistance, offline queue with idempotent sync | An attendant completes a full park-in / park-out cycle on a physical device, including one cycle performed entirely offline and later synced | 4 weeks |
| **M5** | Payments and receipts | Razorpay orders, UPI dynamic QR, cards/net banking/wallet, cash marking, webhook verification and idempotency, receipt and GST invoice generation, SMS/WhatsApp/email delivery, refunds | A live-mode test transaction settles, the webhook reconciles, and the citizen receives a valid receipt on all three channels | 3 weeks |
| **M6** | Citizen Mobile Application | OTP registration, My Garage, live parking map and availability, navigation, live session view, in-app payment, receipts, parking history, favourites, monthly passes, notifications, vehicle locator, feedback and complaints | A citizen finds a zone, views a live session, pays in-app and downloads a GST receipt on both Android and iOS | 4 weeks |
| **M7** | Shifts, settlement and revenue | Shift start/close with GPS, cash vs digital reconciliation, deposit confirmation and admin verification, settlement generation, commission and government share, approval workflow, RazorpayX payout, settlement ledger and statements | A full daily cycle reconciles: sessions → collections → shift close → settlement → approved payout, with a downloadable statement | 3 weeks |
| **M8** | Dashboards, reports, analytics and audit | Live dashboard, heat map, activity feed, all report types with PDF/Excel/CSV export, scheduled reports, complete audit trail and log viewers, alerting | Every report in §3.7 generates against seeded production-scale data and exports in all three formats | 2.5 weeks |
| **M9** | Hardening, UAT and go-live | Security review and penetration test fixes, load and soak testing, DPDP compliance review, accessibility pass, backup/DR drill, documentation, training, store submission, pilot zone rollout | UAT sign-off by the authority; apps live on Play Store and App Store; pilot zone operating on the platform | 3 weeks |
| **P2** | Phase 2 — AI / ANPR | Automatic plate recognition, image enhancement, fake plate detection, demand prediction, revenue forecasting, occupancy-driven dynamic pricing | Separately scoped and quoted | — |

**Deliverables at every milestone:** working software deployed to staging, updated API documentation, updated database migrations, test suite additions, and a demonstration to the authority.

**Cross-cutting deliverables at go-live:** source code repositories, deployment runbook, database schema and migration history, API reference, admin user manual, vendor/attendant field guide, citizen app help content, security and DPDP compliance documentation, and a 30-day post-launch support window.

---

# 6. Developer Head Count

## 6.1 Core team

| # | Role | Count | Responsibility |
|---|---|---|---|
| 1 | Technical Lead / Solution Architect | 1 | Architecture, schema and API design, code review, release ownership, technical liaison with the authority |
| 2 | Backend Engineer (Node.js / Next.js / Prisma) | 2 | API routes, services, repositories, tariff engine, settlement engine, payments, jobs, integrations |
| 3 | Frontend Engineer (Next.js / React) | 2 | Admin Portal — dashboards, master data, tariffs, revenue, settlements, reports, CMS, audit |
| 4 | Mobile Engineer (React Native / Expo) | 2 | Vendor app and Citizen app; one engineer leads each, sharing a common API client and component layer |
| 5 | UI/UX Designer | 1 | Design system, portal screens, both mobile apps, field-usability of the attendant flow |
| 6 | QA Engineer | 1 | Test plans, API/integration/E2E automation, device-lab testing, UAT support |
| 7 | DevOps / Cloud Engineer | 0.5 | CI/CD, environments, Neon and Redis operations, monitoring, backup/DR, store release pipelines |
| 8 | Project Manager / Business Analyst | 1 | Requirements, municipal stakeholder management, sprint planning, UAT coordination, documentation |
| | **Total core team** | **10.5 FTE** | |

## 6.2 Effort concentration by milestone

| Milestone | Primary load |
|---|---|
| M0 | Tech Lead, DevOps, 1 Backend |
| M1–M3 | 2 Backend + 2 Frontend + Designer |
| M4 | 2 Mobile + 1 Backend + QA |
| M5 | 2 Backend + 1 Mobile + QA |
| M6 | 2 Mobile + 1 Backend + Designer |
| M7–M8 | 2 Backend + 2 Frontend + QA |
| M9 | Full team + external security reviewer |

## 6.3 Specialist and part-time roles

| # | Role | Engagement | Purpose |
|---|---|---|---|
| 1 | Security reviewer / penetration tester | Engagement-based at M9 | Independent security assessment before go-live |
| 2 | Chartered accountant / GST advisor | Advisory | Validate tax computation, invoice format and settlement treatment |
| 3 | Technical writer | Part-time at M9 | Admin manual, field guide, help content |
| 4 | Field trainer | M9 and pilot | Attendant and vendor onboarding at the kerb |
| 5 | ML Engineer (ANPR) | **Phase 2 only** | OCR model selection, tuning, accuracy benchmarking |

## 6.4 Post-launch operations

| # | Role | Count | Purpose |
|---|---|---|---|
| 1 | Support / L1 engineer | 1 | Vendor and citizen support desk, incident triage |
| 2 | Maintenance developer | 1 | Bug fixes, tariff/config changes, minor enhancements |
| 3 | DevOps (retained) | 0.25 | Monitoring, patching, cost and capacity management |

---

# 7. Assumptions, Dependencies and Exclusions

## 7.1 Assumptions

1. Phase 1 records the vehicle registration number through attendant photo capture plus manual entry; automatic recognition is Phase 2 and is not part of this scope.
2. Zone boundaries, capacities, permitted vehicle types and the approved tariff schedule are supplied by the municipal authority as source data.
3. The authority provides a legal entity for the payment gateway account, GST registration, and the settlement bank account.
4. Attendants operate Android devices with a working camera and GPS; the vendor app supports Android 9 and above.
5. Citizen app supports Android 9+ and iOS 15+.
6. SMS and WhatsApp templates will be DLT-registered by the authority or vendor before go-live.

## 7.2 Dependencies on the client / authority

| # | Dependency | Needed by |
|---|---|---|
| 1 | Approved tariff schedule and tax treatment | M2 |
| 2 | Zone, street and ward master data with GPS boundaries | M1 |
| 3 | Razorpay / RazorpayX account activation and KYC | M5 |
| 4 | DLT-registered SMS and WhatsApp templates | M5 |
| 5 | Google Maps Platform billing account | M1 |
| 6 | Apple Developer and Google Play developer accounts | M9 |
| 7 | Nominated officers for UAT and sign-off | Every milestone |
| 8 | Pilot zone and vendor for rollout | M9 |

## 7.3 Exclusions

1. AI/ANPR automatic number plate recognition and all Phase 2 AI features.
2. Hardware — ANPR cameras, IoT slot sensors, boom barriers, handheld printers, CCTV.
3. Physical signage, road marking and on-street civil work.
4. Migration of historical parking data from any legacy system, unless separately scoped.
5. Municipal ERP and third-party accounting integrations (available as optional add-ons).
6. Ongoing third-party costs — gateway fees, SMS/WhatsApp charges, map API usage, cloud hosting, store fees — which are billed to the authority at actuals.

---

# 8. Acceptance and Sign-off

Each milestone is accepted on demonstration against its stated exit criteria in the staging environment. Final acceptance follows successful UAT, security review closure, and the pilot zone operating on the platform for a full settlement cycle.

| Role | Name | Signature | Date |
|---|---|---|---|
| For the Authority | | | |
| For the Vendor / Development Partner | | | |
| Technical Lead | | | |
