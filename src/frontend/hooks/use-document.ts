"use client";

import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/frontend/api";
import {
  printDocument,
  saveDocument,
  type IssuedDocument,
} from "@/frontend/api/endpoints/documents.api";
import { isLiveApi } from "@/config/env";

interface RunOptions {
  /**
   * What the control does with no backend behind it — usually the toast the
   * screen has always fired. Demo mode keeps behaving exactly as it did.
   */
  demo: () => void;
  /** Save the file, or open it in a viewer with a print dialogue. */
  mode?: "save" | "print";
  success: string;
  description?: string;
}

/**
 * Asks the API to render a document, then hands it to the browser.
 *
 * Every document control on the portal goes through here, for three reasons.
 * The demo build has no API and must keep doing what it does today, and a
 * branch repeated in nine files is a branch that will be forgotten in one of
 * them. Rendering is not instant — a settlement with four hundred payment lines
 * takes a moment — so the control has to be able to say it is working. And the
 * failure that actually matters is a refusal with something to say: the API
 * declines to produce a statement whose figures do not reconcile, and that
 * message needs to reach the officer rather than being flattened into "that did
 * not go through".
 */
export function useDocument() {
  const [pending, setPending] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (
      key: string,
      request: () => Promise<{ data: IssuedDocument }>,
      options: RunOptions,
    ): Promise<void> => {
      if (!isLiveApi) {
        options.demo();
        return;
      }

      setPending(key);
      const dismiss = toast.loading("Preparing the document…");
      try {
        const { data } = await request();
        if (options.mode === "print") printDocument(data);
        else await saveDocument(data);

        toast.success(options.success, {
          id: dismiss,
          description: options.description ?? data.filename,
        });
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "The document could not be produced.",
          {
            id: dismiss,
            description:
              error instanceof ApiError && error.details?.length
                ? error.details.map((detail) => detail.issue).join("; ")
                : undefined,
          },
        );
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return { run, pending, isBusy: pending !== null };
}
