"use client";

import * as React from "react";
import { Loader2, Lock, Plug } from "lucide-react";
import { toast } from "sonner";

import {
  camerasApi,
  geographyApi,
  listAll,
  type ApiCamera,
  type ApiCameraConnection,
  type ApiStreet,
  type CameraWrite,
} from "@/frontend/api";
import { useApiQuery, describeApiError } from "@/frontend/hooks/use-api";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Switch } from "@/frontend/components/ui/switch";
import { Alert, AlertDescription } from "@/frontend/components/ui/alert";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";

/**
 * Registering a camera, and editing one.
 *
 * One form for both, because they ask the same questions and a second one
 * drifts. What changes is the credential fields: on a new camera they are
 * simply empty, and on an existing one they are already stored and cannot be
 * read back, so blank means "keep" and the form says so rather than looking
 * like a password that got lost.
 *
 * The four groups are the order somebody standing at the pole would answer
 * them in: where it is, what it is, how to reach it, and what it can do.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent for a new camera. */
  camera?: ApiCamera | null;
  onSaved: () => void;
}

interface FormState {
  streetId: string;
  code: string;
  label: string;
  makeModel: string;
  rtspUrl: string;
  onvifUrl: string;
  username: string;
  password: string;
  coverageSlots: string;
  hasIR: boolean;
  hasPTZ: boolean;
  isActive: boolean;
}

const EMPTY: FormState = {
  streetId: "",
  code: "",
  label: "",
  makeModel: "",
  rtspUrl: "",
  onvifUrl: "",
  username: "",
  password: "",
  coverageSlots: "",
  hasIR: false,
  hasPTZ: false,
  isActive: true,
};

export function CameraFormDialog({ open, onOpenChange, camera, onSaved }: Props) {
  const editing = Boolean(camera);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clearCredentials, setClearCredentials] = React.useState(false);

  /**
   * Every road, paged.
   *
   * `pageSize: 200` was refused with a 400 — the API caps a page at 100 — and
   * the refusal was invisible on this screen: the dropdown simply had nothing
   * in it, which reads as "this city has no roads" rather than as an error.
   * `listAll` walks the pages, as the camera list itself does.
   */
  const streets = useApiQuery(["geography", "streets", "all"], () =>
    listAll<ApiStreet>((page, pageSize) => geographyApi.streets({ page, pageSize })),
  );

  /**
   * The connection half is fetched, not passed in.
   *
   * The list this dialog opens from carries no RTSP address — the list runs on
   * `camera.view`, and where a camera is plumbed in is `camera.manage`. So the
   * form asks for it separately, and only when it is opened on an existing
   * camera.
   */
  const connection = useApiQuery(
    ["camera", camera?.id, "connection"],
    () => camerasApi.connection(camera!.id).then((r) => r.data),
    { enabled: open && Boolean(camera?.id) },
  );

  /**
   * Filled in during render rather than from an effect.
   *
   * This is state derived from props — which camera the dialog was opened on,
   * and what the connection request came back with — and React's own answer to
   * that is to adjust it while rendering, keyed on what it was derived from.
   * An effect would render the previous camera's details for a frame first,
   * and the compiler's lint rejects it for exactly that reason.
   * `ConfirmDialog` resets itself the same way.
   */
  const target = camera?.id ?? "new";
  const loaded: ApiCameraConnection | undefined = camera ? connection.data : undefined;
  const readyToFill = camera ? Boolean(loaded) : true;

  const [filledFor, setFilledFor] = React.useState<string | null>(null);

  if (!open && filledFor !== null) {
    // Next opening re-reads, so a camera edited, closed and reopened does not
    // show what was typed last time.
    setFilledFor(null);
  } else if (open && readyToFill && filledFor !== target) {
    setFilledFor(target);
    setForm(
      loaded
        ? {
            streetId: loaded.streetId,
            code: loaded.code,
            label: loaded.label,
            makeModel: loaded.makeModel ?? "",
            rtspUrl: loaded.rtspUrl ?? "",
            onvifUrl: loaded.onvifUrl ?? "",
            // Never prefilled: the API does not return them, and a box that
            // looks full but is not would be worse than an empty one.
            username: "",
            password: "",
            coverageSlots: loaded.coverageSlots == null ? "" : String(loaded.coverageSlots),
            hasIR: loaded.hasIR,
            hasPTZ: loaded.hasPTZ,
            isActive: loaded.isActive,
          }
        : EMPTY,
    );
    setClearCredentials(false);
    setError(null);
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSave =
    form.streetId.trim().length > 0 &&
    form.code.trim().length >= 2 &&
    form.label.trim().length >= 3 &&
    !busy;

  async function save() {
    setError(null);
    setBusy(true);

    /**
     * Only what was filled in.
     *
     * An empty string and an absent field mean different things to the API —
     * absent keeps what is stored, which is exactly what a blank password box
     * on an edit form should do. Sending `""` everywhere would wipe a
     * camera's credentials every time somebody corrected its label.
     */
    const body: CameraWrite = {
      code: form.code.trim().toUpperCase(),
      label: form.label.trim(),
      isActive: form.isActive,
      hasIR: form.hasIR,
      hasPTZ: form.hasPTZ,
      ...(editing ? {} : { streetId: form.streetId }),
      ...(form.makeModel.trim() ? { makeModel: form.makeModel.trim() } : {}),
      ...(form.rtspUrl.trim() ? { rtspUrl: form.rtspUrl.trim() } : {}),
      ...(form.onvifUrl.trim() ? { onvifUrl: form.onvifUrl.trim() } : {}),
      ...(form.username.trim() ? { username: form.username.trim() } : {}),
      ...(form.password ? { password: form.password } : {}),
      ...(form.coverageSlots.trim() ? { coverageSlots: Number(form.coverageSlots) } : {}),
      ...(clearCredentials ? { clearCredentials: true } : {}),
    };

    try {
      if (camera) {
        await camerasApi.update(camera.id, body);
        toast.success("Camera saved", { description: `${body.code} updated.` });
      } else {
        await camerasApi.create(body);
        toast.success("Camera registered", {
          description: form.rtspUrl.trim()
            ? "Test it from the camera's panel to confirm it answers."
            : "Add an RTSP address when you have one and it will start streaming.",
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (cause) {
      setError(describeApiError(cause));
    } finally {
      setBusy(false);
    }
  }

  const loading = editing && connection.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit camera" : "Register a camera"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "The stored username and password are not shown. Leave them blank to keep them."
              : "A camera is filed against the road it is bolted to. Everything below the road can be filled in later."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5 py-1">
            <Section title="Where it is">
              <div className="space-y-2">
                <Label htmlFor="camera-street">Road</Label>
                <Select
                  value={form.streetId}
                  onValueChange={(v) => set("streetId", v)}
                  disabled={editing || busy}
                >
                  <SelectTrigger id="camera-street" className="w-full">
                    <SelectValue placeholder="Choose the road" />
                  </SelectTrigger>
                  <SelectContent>
                    {(streets.data ?? []).map((street) => (
                      <SelectItem key={street.id} value={street.id}>
                        {street.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editing ? (
                  <p className="text-xs text-muted-foreground">
                    A camera that has moved to another road is a different installation —
                    register it there and remove this one.
                  </p>
                ) : null}
              </div>

              <Two>
                <div className="space-y-2">
                  <Label htmlFor="camera-code">Code</Label>
                  <Input
                    id="camera-code"
                    value={form.code}
                    onChange={(e) => set("code", e.target.value.toUpperCase())}
                    placeholder="CAM-CAMAC-03"
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    Stencilled on the housing, so a fault report names something findable.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camera-make">Make and model</Label>
                  <Input
                    id="camera-make"
                    value={form.makeModel}
                    onChange={(e) => set("makeModel", e.target.value)}
                    placeholder="Hikvision DS-2CD2143G2"
                    disabled={busy}
                  />
                </div>
              </Two>

              <div className="space-y-2">
                <Label htmlFor="camera-label">Where it points</Label>
                <Input
                  id="camera-label"
                  value={form.label}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="North end, facing the Camac Street junction"
                  disabled={busy}
                />
              </div>
            </Section>

            <Section
              title="How to reach it"
              hint="Held by the server and given to the streaming gateway. None of it is ever sent to a browser."
            >
              <div className="space-y-2">
                <Label htmlFor="camera-rtsp">RTSP address</Label>
                <Input
                  id="camera-rtsp"
                  value={form.rtspUrl}
                  onChange={(e) => set("rtspUrl", e.target.value)}
                  placeholder="rtsp://10.20.0.4:554/Streaming/Channels/101"
                  className="font-mono text-xs"
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="camera-onvif">ONVIF address</Label>
                <Input
                  id="camera-onvif"
                  value={form.onvifUrl}
                  onChange={(e) => set("onvifUrl", e.target.value)}
                  placeholder="http://10.20.0.4/onvif/device_service"
                  className="font-mono text-xs"
                  disabled={busy}
                />
              </div>

              <Two>
                <div className="space-y-2">
                  <Label htmlFor="camera-user">Username</Label>
                  <Input
                    id="camera-user"
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                    autoComplete="off"
                    placeholder={
                      connection.data?.hasCredentials ? "Stored — leave blank to keep" : "admin"
                    }
                    disabled={busy || clearCredentials}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camera-pass">Password</Label>
                  <Input
                    id="camera-pass"
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    autoComplete="new-password"
                    placeholder={
                      connection.data?.hasCredentials ? "Stored — leave blank to keep" : ""
                    }
                    disabled={busy || clearCredentials}
                  />
                </div>
              </Two>

              {connection.data?.hasCredentials ? (
                <label className="flex items-start gap-3 rounded-lg border p-3">
                  <Switch
                    checked={clearCredentials}
                    onCheckedChange={setClearCredentials}
                    disabled={busy}
                  />
                  <span className="text-sm">
                    <span className="font-medium">Remove the stored credentials</span>
                    <span className="block text-xs text-muted-foreground">
                      For a camera that no longer needs a password. Blank fields keep what is
                      stored, so this is the only way to say it.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Encrypted before it is written, decrypted only to hand the gateway a source
                  address, and absent from every response this API can produce.
                </p>
              )}
            </Section>

            <Section title="What it can do">
              <Two>
                <div className="space-y-2">
                  <Label htmlFor="camera-slots">Bays in view</Label>
                  <Input
                    id="camera-slots"
                    type="number"
                    min={0}
                    max={500}
                    value={form.coverageSlots}
                    onChange={(e) => set("coverageSlots", e.target.value)}
                    placeholder="10"
                    disabled={busy}
                  />
                </div>
                <div className="flex flex-col justify-end gap-3 pb-1">
                  <Toggle
                    label="Infra-red"
                    hint="Gives a picture at night"
                    checked={form.hasIR}
                    onChange={(v) => set("hasIR", v)}
                    disabled={busy}
                  />
                  <Toggle
                    label="Pan, tilt, zoom"
                    hint="The view can be moved"
                    checked={form.hasPTZ}
                    onChange={(v) => set("hasPTZ", v)}
                    disabled={busy}
                  />
                </div>
              </Two>

              <Toggle
                label="In service"
                hint="Turn off for one still on the pole but not to be watched. Its history is kept."
                checked={form.isActive}
                onChange={(v) => set("isActive", v)}
                disabled={busy}
              />
            </Section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                <Plug className="size-4" aria-hidden />
                {editing ? "Save changes" : "Register camera"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Two({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <span className="text-sm leading-tight">
        <span className="font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}
