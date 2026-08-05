"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/frontend/components/ui/alert-dialog";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Input } from "@/frontend/components/ui/input";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Ask for a typed reason before the action can be confirmed. */
  reason?: { label: string; placeholder?: string; required?: boolean };
  /** Require the operator to type this exact string — used for irreversible actions. */
  typeToConfirm?: string;
  onConfirm: (reason?: string) => unknown | Promise<unknown>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  reason,
  typeToConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  const [value, setValue] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue("");
      setTyped("");
      setBusy(false);
    }
  }

  const reasonOk = !reason?.required || value.trim().length > 2;
  const typedOk = !typeToConfirm || typed.trim() === typeToConfirm;
  const canConfirm = reasonOk && typedOk && !busy;

  async function handleConfirm() {
    setBusy(true);
    await onConfirm(value.trim() || undefined);
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>

        {reason && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">
              {reason.label}
              {reason.required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            <Textarea
              id="confirm-reason"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={reason.placeholder}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This reason is written to the audit trail against your name.
            </p>
          </div>
        )}

        {typeToConfirm && (
          <div className="space-y-1.5">
            <Label htmlFor="type-to-confirm">
              Type <span className="font-mono font-semibold">{typeToConfirm}</span> to confirm
            </Label>
            <Input
              id="type-to-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (canConfirm) void handleConfirm();
            }}
            disabled={!canConfirm}
            className={cn(
              destructive && "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Small hook so pages can drive a confirm dialog without local boilerplate. */
export function useConfirm() {
  const [state, setState] = React.useState<Omit<ConfirmDialogProps, "open" | "onOpenChange"> | null>(null);

  const confirm = React.useCallback((props: Omit<ConfirmDialogProps, "open" | "onOpenChange">) => {
    setState(props);
  }, []);

  const dialog = state ? (
    <ConfirmDialog {...state} open onOpenChange={(o) => !o && setState(null)} />
  ) : null;

  return { confirm, dialog };
}
