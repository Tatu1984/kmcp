import * as React from "react";
import { cn } from "@/lib/utils";
import { APP } from "@/config/app.config";

/** The KMCP mark: a kerbstone bay with a parked marker. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="url(#kmcp-g)" />
      <path
        d="M11 23V9h6.4a4.6 4.6 0 0 1 0 9.2H14.4"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.2" cy="22.4" r="1.9" fill="white" fillOpacity="0.9" />
      <defs>
        <linearGradient id="kmcp-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--chart-1)" />
          <stop offset="1" stopColor="var(--chart-2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
  subtitle,
}: {
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight">{APP.name}</span>
          <span className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {subtitle ?? "Parking Authority"}
          </span>
        </span>
      )}
    </span>
  );
}
