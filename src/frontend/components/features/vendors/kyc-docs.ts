/**
 * The five documents KYC asks a vendor for, and which of them gate approval.
 *
 * Both the registration form and the vendor detail page (KYC completeness bar,
 * the Approve button) read this one list — it used to be a literal `4` typed
 * separately in each place, and the two were free to disagree about what
 * "complete" meant. This has to match `REQUIRED_DOCS` in the backend's
 * `vendors.service.ts`: that is what actually decides whether POST
 * /vendors/:id/status accepts an approval, and a mismatch here only means the
 * portal disables Approve at a different moment than the API would refuse it.
 */
export const KYC_DOCS = [
  { type: "AGREEMENT", label: "Signed agreement", required: true },
  { type: "GST", label: "GST certificate", required: true },
  { type: "PAN", label: "PAN card", required: true },
  { type: "BANK_PROOF", label: "Cancelled cheque / bank proof", required: true },
  { type: "KYC", label: "Authorised signatory ID", required: true },
] as const;

export const REQUIRED_KYC_DOC_TYPES = KYC_DOCS.filter((d) => d.required).map((d) => d.type);
