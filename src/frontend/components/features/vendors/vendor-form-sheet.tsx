"use client";

import * as React from "react";
import { FileUp, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Separator } from "@/frontend/components/ui/separator";
import { Slider } from "@/frontend/components/ui/slider";
import { Badge } from "@/frontend/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { KycUpload } from "./kyc-upload";
import type { Vendor } from "@/shared/types/domain.types";

const KYC_DOCS = [
  { type: "AGREEMENT", label: "Signed agreement", required: true },
  { type: "GST", label: "GST certificate", required: true },
  { type: "PAN", label: "PAN card", required: true },
  { type: "BANK_PROOF", label: "Cancelled cheque / bank proof", required: true },
  { type: "KYC", label: "Authorised signatory ID", required: false },
];

export function VendorFormSheet({
  open,
  onOpenChange,
  vendor,
  onSaved,
  onDocumentUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor | null;
  onSaved?: (draft: Partial<Vendor>) => void;
  /** Called after a KYC document is attached, so the caller can refetch. */
  onDocumentUploaded?: () => void;
}) {
  const editing = Boolean(vendor);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(() => defaults(vendor));

  const openKey = open ? (vendor?.id ?? "new") : "closed";
  const [lastKey, setLastKey] = React.useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    setForm(defaults(vendor));
  }

  async function save() {
    if (!form.orgName.trim() || !form.contactName.trim() || !form.contactPhone.trim()) {
      toast.error("Organisation, contact name and phone are required");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onOpenChange(false);
    onSaved?.(form as Partial<Vendor>);
    toast.success(editing ? "Vendor updated" : "Vendor registered", {
      description: editing
        ? form.orgName
        : `${form.orgName} is pending approval until KYC is verified.`,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${vendor?.orgName}` : "Register a vendor"}</SheetTitle>
          <SheetDescription>
            A vendor cannot be assigned kerb until KYC is verified and the agreement is on file.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="org" className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="org" className="flex-1">
              Organisation
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex-1">
              Finance
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex-1">
              KYC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="org" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Organisation name</Label>
              <Input
                id="org-name"
                value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                placeholder="Metro Parking Services Pvt Ltd"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Contact person</Label>
                <Input
                  id="contact-name"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Mobile</Label>
                <Input
                  id="contact-phone"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="+91 98300 00000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ops@vendor.in"
              />
              <p className="text-xs text-muted-foreground">
                Settlement statements and vendor-app credentials go to this address.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="finance" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="19AABCM1234C1ZP"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pan">PAN</Label>
                <Input
                  id="pan"
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                  placeholder="AABCM1234C"
                  className="font-mono"
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bank-account">Bank account number</Label>
                <Input
                  id="bank-account"
                  value={form.bankAccountNo}
                  onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-ifsc">IFSC</Label>
                <Input
                  id="bank-ifsc"
                  value={form.bankIfsc}
                  onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })}
                  placeholder="HDFC0000123"
                  className="font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Payouts are made to this account through RazorpayX. A mismatch between the account name
              and the PAN will fail the payout at the bank.
            </p>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Label>Commission rate</Label>
                <span className="text-lg font-semibold tabular">{form.commissionPct}%</span>
              </div>
              <Slider
                value={[form.commissionPct]}
                onValueChange={([v]) => setForm({ ...form, commissionPct: v })}
                min={5}
                max={40}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground">
                Deducted from gross collections at settlement. The deduction is the municipal share.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="kyc" className="mt-4 space-y-3">
            {KYC_DOCS.map((doc) => {
              const existing = vendor?.documents.find((d) => d.type === doc.type);
              return (
                <div
                  key={doc.type}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <FileUp className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{doc.label}</p>
                      {doc.required && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px]">
                          required
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {existing ? existing.fileName : "No file uploaded"}
                    </p>
                  </div>
                  {existing?.verified ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
                      Verified
                    </Badge>
                  ) : vendor ? (
                    /**
                     * The real upload: a presigned ticket from POST
                     * /media/uploads, the bytes PUT straight to object storage,
                     * a confirm, then POST /vendors/:id/documents with the media
                     * id. `KycUpload` owns that sequence — this passes it the
                     * one document type the row is about.
                     *
                     * If the storage credentials in this environment are
                     * placeholders the PUT fails, and it fails visibly: the
                     * error from storage is what the officer is shown, rather
                     * than a success toast over a document that was never
                     * stored.
                     */
                    <KycUpload
                      vendorId={vendor.id}
                      type={doc.type}
                      label="Upload"
                      onUploaded={onDocumentUploaded ?? (() => undefined)}
                    />
                  ) : (
                    /**
                     * A document belongs to a vendor, and this one does not
                     * exist yet — POST /vendors/:id/documents has no id to
                     * take. Registering first is a real ordering constraint,
                     * not a limitation of the form, so it is said rather than
                     * worked around.
                     */
                    <Button variant="outline" size="sm" className="h-8" disabled>
                      Register first
                    </Button>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Documents are stored in the evidence bucket and served only through short-lived signed
              URLs. Verification is recorded against the officer who performed it.
            </p>
          </TabsContent>
        </Tabs>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {editing ? "Save changes" : "Register vendor"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function defaults(vendor?: Vendor | null) {
  return {
    orgName: vendor?.orgName ?? "",
    contactName: vendor?.contactName ?? "",
    contactPhone: vendor?.contactPhone ?? "",
    email: vendor?.email ?? "",
    gstin: vendor?.gstin ?? "",
    pan: vendor?.pan ?? "",
    bankAccountNo: vendor?.bankAccountNo ?? "",
    bankIfsc: vendor?.bankIfsc ?? "",
    commissionPct: vendor?.commissionPct ?? 18,
  };
}
