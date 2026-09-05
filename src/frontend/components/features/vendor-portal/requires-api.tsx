"use client";

import * as React from "react";
import { PlugZap } from "lucide-react";

import { isLiveApi } from "@/config/env";
import { EmptyState } from "@/frontend/components/shared/empty-state";

/**
 * The vendor portal needs a real API, and says so rather than inventing one.
 *
 * Every other screen in this portal falls back to the bundled demo dataset when
 * `NEXT_PUBLIC_API_URL` is unset, which is right for a walkthrough of zones,
 * sessions and tariffs — the authority is being shown how the system behaves,
 * and sample data behaves correctly.
 *
 * These screens deliberately do not. Everything here is one operator's money:
 * what they collected, what KMC owes them, what they paid their staff. A
 * plausible-looking settlement balance on a screen with no backend behind it is
 * a specific false claim about somebody's money, and a vendor has no way to
 * tell it apart from the real thing. Saying "not connected" is the honest
 * answer and the useful one — it names the missing configuration instead of
 * showing a figure nobody should act on.
 */
export function RequiresApi({ children }: { children: React.ReactNode }) {
  if (isLiveApi) return <>{children}</>;

  return (
    <EmptyState
      icon={PlugZap}
      title="Not connected to an API"
      description={
        "This build has no backend configured, so there are no figures to show. The operator " +
        "portal deals in real money and will not stand in demo data for it. Set " +
        "NEXT_PUBLIC_API_URL to the API's full base URL — including the /api/v1 path — and " +
        "rebuild."
      }
    />
  );
}
