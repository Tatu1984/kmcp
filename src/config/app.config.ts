export const APP = {
  name: "KMCP",
  fullName: "Smart Street Parking Management System",
  shortName: "KMCP Parking",
  authority: "Municipal Parking Authority",
  tagline: "Every kerb, accounted for.",
  supportEmail: "support@kmcp.gov.in",
  helpline: "1800 000 0000",
  currency: "INR",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  version: "1.0.0",
  phase: 1,
  /** Phase 1 captures the plate photo and the number is typed by the attendant. */
  anprEnabled: false,
} as const;

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TWO_WHEELER: "Two Wheeler",
  THREE_WHEELER: "Three Wheeler",
  CAR: "Car",
  COMMERCIAL: "Commercial",
  BUS: "Bus",
  TRUCK: "Truck",
  EV: "Electric Vehicle",
  VIP: "VIP",
  GOVERNMENT: "Government",
  ACCESSIBLE: "Accessible",
};

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI_QR: "UPI QR",
  UPI_INTENT: "UPI Intent",
  CARD: "Card",
  NETBANKING: "Net Banking",
  WALLET: "Wallet",
  PASS: "Monthly Pass",
  CORPORATE: "Corporate",
};

export const SETTLEMENT_CYCLES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
