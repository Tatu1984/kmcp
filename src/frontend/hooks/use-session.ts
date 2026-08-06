"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { isLiveApi } from "@/config/env";
import { authApi } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { endSession, storedPrincipal, toSessionUser, type SessionUser } from "@/frontend/lib/session";
import { CURRENT_USER } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";

const DEMO_USER: SessionUser = {
  id: CURRENT_USER.id,
  name: CURRENT_USER.name,
  email: CURRENT_USER.email,
  phone: CURRENT_USER.phone,
  role: CURRENT_USER.role,
  twoFactorEnabled: CURRENT_USER.twoFactorEnabled ?? false,
  lastLoginAt: CURRENT_USER.lastLoginAt,
  createdAt: CURRENT_USER.createdAt,
};

/**
 * Who is signed in, and how to stop being signed in.
 *
 * Against a live API this is whatever /auth/me says, seeded from the copy kept at
 * sign-in so the header does not flash an empty avatar on every navigation.
 * With no API configured it is the demo account the mock dataset is built around.
 */
export function useSession(): {
  /** Null only while a live /auth/me is still in flight with nothing cached. */
  user: SessionUser | null;
  isLoading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
} {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [seed] = React.useState<SessionUser | null>(() => (isLiveApi ? storedPrincipal() : null));

  const me = useApiQuery(["auth", "me"], async () => toSessionUser(await authApi.me().then((r) => r.data)), {
    staleTime: 5 * 60_000,
  });

  const signOut = React.useCallback(async () => {
    if (isLiveApi) await authApi.logout().catch(() => undefined);
    endSession();
    // The cache holds this user's data — the next person to sign in on this
    // browser must not see any of it.
    queryClient.clear();
    router.push(ROUTES.login);
  }, [queryClient, router]);

  return {
    // Never fall back to the demo account on a live deployment — showing someone
    // else's name in the header is worse than showing none.
    user: isLiveApi ? (me.data ?? seed) : DEMO_USER,
    isLoading: isLiveApi && me.isLoading && !seed,
    isDemo: !isLiveApi,
    signOut,
  };
}
