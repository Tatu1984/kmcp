import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RowActions, type RowAction } from "@/frontend/components/shared/row-actions";
import { NOT_PERMITTED } from "@/frontend/components/shared/can";
import type { PermissionKey } from "@/shared/constants/roles";

/**
 * The "⋯" menu on every table row, and the twenty-seven places it is used.
 *
 * Gating lives in this component rather than at each call site precisely so it
 * cannot be forgotten in one menu out of twenty-seven — which makes this the
 * single place where that gating can silently break for all of them at once.
 *
 * The behaviour it has to keep is a deliberate choice, not an accident: a
 * denied action is shown *disabled and explained*, not removed. An officer
 * should be able to see that settlement approval exists and is not theirs,
 * rather than compare menus with a colleague and wonder what happened. Only
 * `hideWhenDenied` opts out of that.
 */

const held = new Set<string>();
const state = { isReady: true };

vi.mock("@/frontend/hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: (permission: PermissionKey) => state.isReady && held.has(permission),
    canAny: (...permissions: PermissionKey[]) =>
      state.isReady && permissions.some((p) => held.has(p)),
    canAll: (...permissions: PermissionKey[]) =>
      state.isReady && permissions.every((p) => held.has(p)),
    isReady: state.isReady,
    isZoneScoped: false,
    zoneIds: [],
    granted: [...held],
  }),
}));

beforeEach(() => {
  held.clear();
  state.isReady = true;
});

async function openMenu(actions: RowAction[]) {
  render(<RowActions actions={actions} />);
  await userEvent.click(screen.getByRole("button", { name: "Open row actions" }));
}

describe("an action the account may not perform", () => {
  it("is offered, disabled, and says why", async () => {
    await openMenu([{ label: "Approve settlement", permission: "settlement.approve" }]);

    const item = await screen.findByRole("menuitem", { name: /Approve settlement/ });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    // The reason is appended to the label rather than hidden in a tooltip: on a
    // touch screen there is no hover, and "Forbidden" from the API is not what
    // an officer should be told.
    expect(item.textContent).toContain(NOT_PERMITTED);
  });

  it("is disabled but not yet explained while the principal is loading", async () => {
    /**
     * `can()` answers false during loading, so every permissioned action is
     * briefly denied. Appending "your role does not permit this" then would be
     * telling someone something untrue about their own account — the portal
     * does not know yet. Disabled without a reason is the honest state.
     */
    state.isReady = false;
    held.add("settlement.approve");

    await openMenu([{ label: "Approve settlement", permission: "settlement.approve" }]);

    const item = await screen.findByRole("menuitem", { name: "Approve settlement" });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.textContent).not.toContain(NOT_PERMITTED);
  });

  it("disappears when the caller asked for that explicitly", async () => {
    await openMenu([
      { label: "View", permission: "zone.read", hideWhenDenied: true },
      { label: "Rename", permission: "zone.write" },
    ]);

    await screen.findByRole("menuitem", { name: /Rename/ });
    expect(screen.queryByRole("menuitem", { name: /View/ })).toBeNull();
  });
});

describe("an action the account may perform", () => {
  it("is left exactly as it was passed in", async () => {
    held.add("zone.write");
    const onSelect = vi.fn();

    await openMenu([{ label: "Rename zone", permission: "zone.write", onSelect }]);

    const item = await screen.findByRole("menuitem", { name: "Rename zone" });
    expect(item.getAttribute("aria-disabled")).toBeNull();
    expect(item.textContent).toBe("Rename zone");

    await userEvent.click(item);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("leaves an action with no permission alone regardless of the principal", async () => {
    // Omitting `permission` is the only way to opt out of gating, and it is
    // meant to be visible in review. It must therefore actually opt out — even
    // for an account holding nothing at all.
    const onSelect = vi.fn();

    await openMenu([{ label: "Copy id", onSelect }]);

    const item = await screen.findByRole("menuitem", { name: "Copy id" });
    expect(item.getAttribute("aria-disabled")).toBeNull();

    await userEvent.click(item);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("still honours a `disabled` the caller set for its own reasons", async () => {
    // Permission is not the only reason to disable something — a settlement
    // already approved cannot be approved twice. Granting the permission must
    // not re-enable it.
    held.add("settlement.approve");

    await openMenu([{ label: "Approve", permission: "settlement.approve", disabled: true }]);

    const item = await screen.findByRole("menuitem", { name: "Approve" });
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("the menu as a whole", () => {
  it("renders nothing when every action has been hidden", async () => {
    /**
     * An empty "⋯" that opens onto nothing is worse than no button: it reads as
     * a broken menu rather than as an account with nothing to do on this row.
     */
    render(
      <RowActions
        actions={[
          { label: "View", permission: "zone.read", hideWhenDenied: true },
          { label: "Delete", permission: "zone.write", hideWhenDenied: true },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Open row actions" })).toBeNull();
  });

  it("gates the items inside a submenu too", async () => {
    // A nested menu is the easy place for a gate to be forgotten, because it
    // takes a second pass over `resolve` to reach it.
    held.add("zone.status");

    await openMenu([
      {
        label: "Change status",
        children: [
          { label: "Open zone", permission: "zone.status" },
          { label: "Close zone", permission: "config.write" },
        ],
      },
    ]);

    await userEvent.click(await screen.findByRole("menuitem", { name: "Change status" }));

    expect((await screen.findByRole("menuitem", { name: "Open zone" })).getAttribute("aria-disabled"))
      .toBeNull();
    expect(
      (await screen.findByRole("menuitem", { name: /Close zone/ })).getAttribute("aria-disabled"),
    ).toBe("true");
  });
});
