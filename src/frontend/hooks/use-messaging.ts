"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError, describeDispatch, type DispatchSummary } from "@/frontend/api";
import { isLiveApi } from "@/config/env";

/**
 * Sending a message from a portal control.
 *
 * The sibling of `useResource`'s `apply`, for the writes that change nothing in
 * the list on screen. It exists for the same reason `apply` does: fifteen "send"
 * controls across seven screens must branch on demo mode, report failure and
 * word a partial success identically, and fifteen copies of that would not stay
 * identical for a week.
 *
 * The important difference from `apply` is what counts as success. A bulk
 * re-send of forty receipts can be partly delivered, so this never reports a
 * flat "sent" from an HTTP 200 — it reads the server's own count of what
 * actually left the building, via `describeDispatch`. A control that said
 * "Receipts re-sent" while eleven citizens heard nothing is precisely the lie
 * these screens used to tell.
 */
export function useMessaging() {
  const [isSending, setIsSending] = React.useState(false);

  /**
   * Returns whether anything was sent, so a caller can close its dialog on
   * success and leave it open — with the fields still filled in — on failure.
   */
  const send = React.useCallback(
    async (
      call: () => Promise<{ data: DispatchSummary }>,
      demo: { success: string; description?: string },
    ): Promise<boolean> => {
      // Demo mode behaves exactly as it did before any of this was wired: a
      // local toast and no network call. The walkthrough has no API to send
      // through, and pretending otherwise would break the one thing that works
      // without a backend.
      if (!isLiveApi) {
        toast.success(demo.success, { description: demo.description });
        return true;
      }

      setIsSending(true);
      try {
        const { data } = await call();
        const outcome = describeDispatch(data);
        if (outcome.ok) toast.success(outcome.title, { description: outcome.description });
        else toast.error(outcome.title, { description: outcome.description });
        return outcome.ok;
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "That did not go through. Please try again.",
        );
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [],
  );

  return { send, isSending };
}
