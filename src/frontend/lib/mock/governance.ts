// Demo data for screens not yet wired to the API.
//
// Audit, sign-in, device and sync data are deliberately absent. Those screens
// read the real trail from the API — an audit view showing invented entries is
// worse than one showing nothing at all.

import type {
  Citizen,
  NotificationItem,
  CmsPage,
  Faq,
  Banner,
  User,
} from "@/shared/types/domain.types";
import { makeRng, daysAgo, minutesAgo } from "./rng";

const rng = makeRng(424242);

export const CURRENT_USER: User = {
  id: "usr_001",
  name: "Sudipta Banerjee",
  email: "sudipta.banerjee@kmc.gov.in",
  phone: "+91 98300 11223",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  lastLoginAt: minutesAgo(12),
  createdAt: daysAgo(420),
  twoFactorEnabled: true,
};

export const PORTAL_USERS: User[] = [
  CURRENT_USER,
  { id: "usr_002", name: "Rina Dasgupta", email: "rina.dasgupta@kmc.gov.in", role: "ADMIN", status: "ACTIVE", lastLoginAt: minutesAgo(140), createdAt: daysAgo(300), twoFactorEnabled: true },
  { id: "usr_003", name: "Prabir Chatterjee", email: "prabir.c@kmc.gov.in", role: "ZONE_OFFICER", status: "ACTIVE", lastLoginAt: minutesAgo(56), createdAt: daysAgo(210), twoFactorEnabled: false },
  { id: "usr_004", name: "Nasreen Alam", email: "nasreen.alam@kmc.gov.in", role: "ZONE_OFFICER", status: "ACTIVE", lastLoginAt: minutesAgo(320), createdAt: daysAgo(180), twoFactorEnabled: false },
  { id: "usr_005", name: "Audit Cell", email: "audit@kmc.gov.in", role: "AUDITOR", status: "ACTIVE", lastLoginAt: minutesAgo(1400), createdAt: daysAgo(400), twoFactorEnabled: true },
  { id: "usr_006", name: "Kamal Hossain", email: "kamal.h@kmc.gov.in", role: "ZONE_OFFICER", status: "SUSPENDED", lastLoginAt: daysAgo(34), createdAt: daysAgo(260), twoFactorEnabled: false },
];

const CITIZEN_NAMES = [
  "Ananya Bose", "Rohit Sharma", "Priya Nandi", "Imtiaz Ali", "Sneha Kar", "Vikram Sinha",
  "Meghna Roy", "Arjun Pillai", "Farhan Qureshi", "Deepa Iyer", "Suman Ghatak", "Nabanita Sen",
  "Joydeep Saha", "Ruma Chowdhury", "Aakash Verma", "Tanisha Jain", "Mrinal Kanti Pal",
  "Zoya Rahman", "Harsh Agarwal", "Paromita Dey", "Sourav Tewari", "Ishita Basu",
  "Nikhil Menon", "Rehana Begum", "Debjani Mukherjee", "Ayan Chakraborty", "Pooja Shaw",
  "Sameer Kulkarni", "Trisha Sanyal", "Manoj Yadav",
];

export const CITIZENS: Citizen[] = CITIZEN_NAMES.map((name, i) => {
  const sessions = rng.int(1, 240);
  return {
    id: `ctz_${String(i + 1).padStart(3, "0")}`,
    name,
    phone: `+91 9${rng.int(100000, 999999)}${rng.int(10, 99)}`,
    email: rng.bool(0.6) ? `${name.split(" ")[0].toLowerCase()}${rng.int(10, 99)}@gmail.com` : undefined,
    vehicleCount: rng.int(1, 4),
    sessionsCount: sessions,
    totalSpent: sessions * rng.int(2000, 9000),
    status: rng.weighted([
      ["ACTIVE", 88],
      ["INACTIVE", 8],
      ["BLACKLISTED", 4],
    ]),
    hasActivePass: rng.bool(0.22),
    joinedAt: daysAgo(rng.int(5, 500)),
    lastSeenAt: minutesAgo(rng.int(4, 20000)),
  };
});




export const NOTIFICATIONS: NotificationItem[] = [
  { id: "ntf_1", title: "Gariahat Market is at 97% capacity", body: "136 of 140 bays occupied. Consider diverting to Hindustan Park.", kind: "warning", href: "/zones", createdAt: minutesAgo(4), read: false },
  { id: "ntf_2", title: "Settlement STL/2026/1206 awaiting approval", body: "Orbit Kerbside Management · ₹4,82,100 for 29 Jul – 05 Aug.", kind: "info", href: "/settlements", createdAt: minutesAgo(22), read: false },
  { id: "ntf_3", title: "Cash variance flagged", body: "Shift shf_014 closed ₹2,400 short at Burrabazar Wholesale.", kind: "alert", href: "/shifts", createdAt: minutesAgo(48), read: false },
  { id: "ntf_4", title: "12 sessions past expected duration", body: "Overstay sweep found 12 vehicles across 5 zones.", kind: "warning", href: "/sessions?status=OVERSTAY", createdAt: minutesAgo(75), read: true },
  { id: "ntf_5", title: "Payment gateway healthy", body: "Razorpay webhook latency back under 400 ms.", kind: "success", createdAt: minutesAgo(180), read: true },
  { id: "ntf_6", title: "New vendor application", body: "Uday Kerb Solutions LLP submitted KYC documents.", kind: "info", href: "/vendors", createdAt: minutesAgo(320), read: true },
];

export const CMS_PAGES: CmsPage[] = [
  { slug: "about", title: "About the parking programme", updatedAt: daysAgo(12), published: true, words: 640 },
  { slug: "terms", title: "Terms and conditions", updatedAt: daysAgo(40), published: true, words: 2_180 },
  { slug: "privacy-policy", title: "Privacy policy (DPDP)", updatedAt: daysAgo(3), published: true, words: 1_860 },
  { slug: "contact", title: "Contact and helpline", updatedAt: daysAgo(28), published: true, words: 210 },
  { slug: "refund-policy", title: "Refund and cancellation", updatedAt: daysAgo(70), published: false, words: 480 },
];

export const FAQS: Faq[] = [
  { id: "faq_1", question: "How is my parking fee calculated?", answer: "The fee is calculated from the approved tariff for the zone and your vehicle type, from the moment the attendant starts the session to the moment it ends, after any grace period.", category: "Charges", isActive: true },
  { id: "faq_2", question: "What if I do not have cash?", answer: "Every attendant can show a UPI QR code, and you can also pay from the citizen app by card, net banking or wallet.", category: "Payment", isActive: true },
  { id: "faq_3", question: "How do I get a GST invoice?", answer: "Open the session in your parking history and tap Download receipt. A GST invoice is issued where applicable.", category: "Receipts", isActive: true },
  { id: "faq_4", question: "Can I buy a monthly pass?", answer: "Yes. Open Passes in the citizen app, choose a plan for your vehicle and zone, and pay online.", category: "Passes", isActive: true },
  { id: "faq_5", question: "I was overcharged. What do I do?", answer: "Raise a complaint from the session in your history. Attach a photo if you have one. The zone officer responds within two working days.", category: "Disputes", isActive: true },
  { id: "faq_6", question: "Is my vehicle photograph stored?", answer: "Yes. A timestamped photograph of the number plate is stored as evidence of the session and is retained per the published retention policy.", category: "Privacy", isActive: false },
];

export const BANNERS: Banner[] = [
  { id: "bnr_1", title: "Durga Puja parking advisory", body: "Deshapriya Park and surrounding zones are closed to parking from 17–21 October.", audience: "ALL", startAt: daysAgo(2), endAt: daysAgo(-70), isActive: true },
  { id: "bnr_2", title: "Monsoon discount is live", body: "Flat ₹10 off every session at off-peak hours until the end of the month.", audience: "CITIZEN", startAt: daysAgo(9), endAt: daysAgo(-14), isActive: true },
  { id: "bnr_3", title: "Mandatory app update", body: "Vendor app 1.0.3 is required from 15 August. Older builds will stop syncing.", audience: "VENDOR", startAt: daysAgo(1), endAt: daysAgo(-10), isActive: true },
  { id: "bnr_4", title: "Republic Day free parking", body: "No parking charges on 26 January across all municipal zones.", audience: "ALL", startAt: daysAgo(190), endAt: daysAgo(188), isActive: false },
];
