"use client";

import * as React from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/frontend/api";
import { isLiveApi } from "@/config/env";

/**
 * What went wrong, in words that name the field.
 *
 * The API answers a rejected write with `VALIDATION_FAILED`, a generic message
 * — "Some fields need attention." — and a `details` array saying exactly which
 * field and why. The portal was showing the generic half and discarding the
 * useful one, so a mistyped mobile number and a malformed GSTIN produced the
 * same five words. Every rejected save read as "nothing works".
 */
export function describeApiError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "That did not go through. Please try again.";
  }
  if (!error.details?.length) return error.message;

  const humanise = (field: string) =>
    field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  return error.details.map((d) => `${humanise(d.field)}: ${d.issue}`).join(" · ");
}

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

/**
 * One list of records, from the API when there is one and from the bundled demo
 * dataset when there is not.
 *
 * Both modes have to keep working: the portal is demonstrated to the authority
 * on a laptop with no backend, and runs against the real API in the field. Every
 * screen would otherwise grow its own copy of that branch, so it lives here.
 *
 * `apply` is the write path. Against the API it performs the call and refetches;
 * in demo mode it edits the local copy so the walkthrough still behaves like a
 * working system. Errors surface as a toast and are re-thrown, so a caller can
 * keep a dialog open on failure.
 */
export function useResource<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T[]>,
  demoData: T[],
  options?: { enabled?: boolean },
) {
  const query = useApiQuery<T[]>(key, fetcher, { enabled: options?.enabled });
  const [demo, setDemo] = React.useState<T[]>(demoData);
  const [busy, setBusy] = React.useState(false);

  const items = isLiveApi ? (query.data ?? []) : demo;

  const apply = React.useCallback(
    async (
      live: () => Promise<unknown>,
      demoUpdate: (current: T[]) => T[],
      messages?: { success?: string; description?: string },
    ) => {
      if (!isLiveApi) {
        setDemo(demoUpdate);
        if (messages?.success) toast.success(messages.success, { description: messages.description });
        return;
      }
      setBusy(true);
      try {
        await live();
        const reloaded = await query.refetch();
        if (reloaded.error) {
          /**
           * The write went through; only the reload after it did not. Reporting
           * plain success here is what makes a good save look like a lost one —
           * the toast says "created" and the row is nowhere in the table.
           */
          toast.warning(messages?.success ?? "Saved", {
            description: "The list could not be reloaded. Refresh the page to see the change.",
          });
        } else if (messages?.success) {
          toast.success(messages.success, { description: messages.description });
        }
      } catch (error) {
        toast.error(describeApiError(error));
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [query],
  );

  return {
    items,
    isLoading: isLiveApi && query.isLoading,
    // True for a manual refetch too, not just the first load — a Refresh
    // button reads this to spin for exactly as long as the request takes.
    isRefreshing: isLiveApi && query.isFetching,
    isBusy: busy,
    error: query.error ?? null,
    emptyReason: emptyReason(query.error ?? null, query.isLoading),
    refresh: query.refetch,
    apply,
  };
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
