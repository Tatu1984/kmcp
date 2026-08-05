import type { Paise } from "../types/common.types";

/** Money is stored and transported as integer paise. Format only at the edge. */
export function formatMoney(paise: Paise | undefined | null, opts?: { compact?: boolean; decimals?: boolean }): string {
  if (paise === undefined || paise === null) return "—";
  const rupees = paise / 100;
  if (opts?.compact) {
    if (Math.abs(rupees) >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
    if (Math.abs(rupees) >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
    if (Math.abs(rupees) >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}K`;
  }
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: opts?.decimals === false ? 0 : 2,
    maximumFractionDigits: opts?.decimals === false ? 0 : 2,
  })}`;
}

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

/** Plates are transported normalised (WB02AB1234) and displayed spaced (WB 02 AB 1234). */
export function formatPlate(plate: string): string {
  const p = plate.replace(/\s+/g, "").toUpperCase();
  const m = p.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ") : plate;
}

export function normalisePlate(plate: string): string {
  return plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function formatDuration(minutes?: number): string {
  if (minutes === undefined || minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function occupancyBand(occupied: number, capacity: number): "low" | "medium" | "full" {
  if (capacity <= 0) return "low";
  const pct = occupied / capacity;
  if (pct >= 0.95) return "full";
  if (pct >= 0.7) return "medium";
  return "low";
}

export function percent(a: number, b: number): number {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}
