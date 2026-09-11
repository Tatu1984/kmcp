"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Plus, RefreshCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { camerasApi, type EdgeAgentConfig } from "@/frontend/api/endpoints/cameras.api";
import { ApiError } from "@/frontend/api/client";

/**
 * Register a camera and, on success, reveal the one-time Edge Agent credentials.
 * The ingest token is shown here and never again — only its hash is stored — so
 * the panel makes copying it the obvious next step and warns before it closes.
 */
export function AddCameraDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [issued, setIssued] = React.useState<EdgeAgentConfig | null>(null);

  const reset = () => {
    setName("");
    setGroup("");
    setIssued(null);
    setBusy(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data } = await camerasApi.create({ name: name.trim(), group: group.trim() || undefined });
      setIssued(data.edgeAgent);
      onCreated();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not register the camera";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Add camera
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {issued ? (
          <IssuedPanel config={issued} onDone={() => setOpen(false)} />
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Register a camera</DialogTitle>
              <DialogDescription>
                Give it a name. You&apos;ll get an ingest URL and a one-time token to paste into the
                Edge Agent.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="camera-name">Name</Label>
                <Input
                  id="camera-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Gate 2 — north approach"
                  autoFocus
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="camera-group">Group (optional)</Label>
                <Input
                  id="camera-group"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="Main building"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Registering…" : "Register"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{value}</code>
        <Button type="button" size="icon" variant="outline" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function IssuedPanel({ config, onDone }: { config: EdgeAgentConfig; onDone: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Camera registered</DialogTitle>
        <DialogDescription className="text-amber-600 dark:text-amber-500">
          Copy the token now — it is shown only once and cannot be recovered. If you lose it, rotate
          the token to issue a new one.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-4">
        <CopyRow label="Ingest URL" value={config.ingestUrl} />
        <CopyRow label="Token" value={config.ingestToken} />
        <CopyRow label="Camera ID" value={config.cameraId} />
        <CopyRow label="Publish URL" value={config.publishUrl} />
      </div>
      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

/** A standalone control to rotate a camera's token, reusing the reveal panel. */
export function RotateTokenButton({ id, onRotated }: { id: string; onRotated?: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [issued, setIssued] = React.useState<EdgeAgentConfig | null>(null);

  const rotate = async () => {
    setBusy(true);
    try {
      const { data } = await camerasApi.rotateToken(id);
      setIssued(data);
      onRotated?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not rotate the token");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setIssued(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 size-3.5" />
          Rotate token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {issued ? (
          <IssuedPanel config={issued} onDone={() => setOpen(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rotate ingest token?</DialogTitle>
              <DialogDescription>
                The current token stops working immediately. The Edge Agent must be updated with the
                new one before this camera can publish again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={rotate} disabled={busy}>
                {busy ? "Rotating…" : "Rotate token"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
