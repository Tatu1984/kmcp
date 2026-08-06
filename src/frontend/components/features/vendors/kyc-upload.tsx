"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { vendorsApi, uploadFile } from "@/frontend/api";
import { isLiveApi } from "@/config/env";

/** The document types approval is gated on, in the order they are usually collected. */
const DOCUMENT_TYPES = [
  { value: "AGREEMENT", label: "Signed agreement" },
  { value: "GST", label: "GST certificate" },
  { value: "PAN", label: "PAN card" },
  { value: "BANK_PROOF", label: "Bank proof" },
  { value: "KYC", label: "Other KYC" },
] as const;

/**
 * Attaches a document to a vendor.
 *
 * The file goes browser → object storage directly on a presigned URL, and only
 * then is the resulting media id attached to the vendor. Nothing large travels
 * through the API, and a failed upload leaves no half-made document record.
 */
export function KycUpload({ vendorId, onUploaded }: { vendorId: string; onUploaded: () => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be chosen twice in a row — the browser suppresses the
    // change event otherwise.
    event.target.value = "";
    if (!file || !pendingType) return;

    if (!isLiveApi) {
      toast.info("Upload needs the API", {
        description: "Set NEXT_PUBLIC_API_URL to store documents.",
      });
      return;
    }

    setBusy(true);
    try {
      const media = await uploadFile(file, "KYC_DOCUMENT");
      await vendorsApi.addDocument(vendorId, pendingType, media.id);
      toast.success("Document attached", { description: file.name });
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That upload did not complete.");
    } finally {
      setBusy(false);
      setPendingType(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={onFile}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {busy ? "Uploading…" : "Add document"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {DOCUMENT_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.value}
              onSelect={() => {
                setPendingType(type.value);
                // Opened after the menu closes, or the dialog is dismissed with it.
                setTimeout(() => inputRef.current?.click(), 0);
              }}
            >
              {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
