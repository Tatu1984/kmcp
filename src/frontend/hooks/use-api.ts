"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { ApiError } from "@/frontend/api";
import { isLiveApi } from "@/config/env";

/**
 * Wraps TanStack Query with the two behaviours every screen in this portal
 * wants: don't fire when there is no backend configured, and don't retry a
 * request the server has already refused on its merits.
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, ApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: fetcher,
    enabled: isLiveApi && (options?.enabled ?? true),
    retry: (attempt, error) => {
      // A 4xx is an answer, not a failure to get one.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
      return attempt < 2;
    },
    ...options,
  });
}

/** Human-readable reason a screen has no data, or null when it does. */
export function emptyReason(error: ApiError | null, isLoading: boolean): string | null {
  if (!isLiveApi) {
    return "This screen reads from the KMCP API. Set NEXT_PUBLIC_API_URL and redeploy to see live data.";
  }
  if (isLoading) return null;
  if (!error) return null;
  if (error.code === "NETWORK_ERROR") {
    return "Could not reach the API. Check the backend is deployed and that CORS_ORIGINS allows this domain.";
  }
  if (error.isAuthError) return "Your session has expired. Sign in again.";
  if (error.code === "FORBIDDEN") return "Your role does not permit viewing this.";
  return error.message;
}
