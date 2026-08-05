"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BadgeCheck,
  ChevronDown,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  Moon,
  ScrollText,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Avatar, AvatarFallback } from "@/frontend/components/ui/avatar";
import { Badge } from "@/frontend/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { CURRENT_USER } from "@/frontend/lib/mock";
import { ROLE_LABELS } from "@/shared/constants/roles";
import { initials, relativeTime } from "@/shared/utils/common.util";
import { ROUTES } from "@/shared/constants/routes";

export function UserMenu() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [signOutOpen, setSignOutOpen] = React.useState(false);

  function signOut() {
    document.cookie = "kmcp_session=; path=/; max-age=0";
    toast.success("Signed out", { description: "Your session has been ended on this device." });
    router.push(ROUTES.login);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/12 text-[11px] font-semibold text-primary">
                {initials(CURRENT_USER.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-28 truncate text-sm font-medium lg:inline">
              {CURRENT_USER.name.split(" ")[0]}
            </span>
            <ChevronDown className="hidden size-3.5 text-muted-foreground lg:inline" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2.5 px-1 py-1.5">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/12 text-xs font-semibold text-primary">
                  {initials(CURRENT_USER.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{CURRENT_USER.name}</p>
                <p className="truncate text-xs text-muted-foreground">{CURRENT_USER.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5">
              <Badge variant="secondary" className="h-5 text-[10px]">
                {ROLE_LABELS[CURRENT_USER.role]}
              </Badge>
              {CURRENT_USER.twoFactorEnabled && (
                <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                  <BadgeCheck className="size-3 text-emerald-500" /> 2FA on
                </Badge>
              )}
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`${ROUTES.settings}?tab=profile`}>
                <UserRound className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${ROUTES.settings}?tab=security`}>
                <KeyRound className="size-4" /> Password &amp; 2FA
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${ROUTES.settings}?tab=security`}>
                <Laptop className="size-4" /> Signed-in devices
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={ROUTES.audit}>
                <ScrollText className="size-4" /> My activity
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {theme === "dark" ? (
                <Moon className="size-4" />
              ) : theme === "light" ? (
                <Sun className="size-4" />
              ) : (
                <Monitor className="size-4" />
              )}
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun className="size-4" /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="size-4" /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor className="size-4" /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem asChild>
            <Link href={ROUTES.settings}>
              <Settings className="size-4" /> System settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="px-2 py-1">
            <p className="text-[11px] text-muted-foreground">
              Last signed in {relativeTime(CURRENT_USER.lastLoginAt ?? CURRENT_USER.createdAt)}
            </p>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={() => setSignOutOpen(true)}>
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out of the portal?"
        description="You will need your password and a fresh authenticator code to get back in."
        confirmLabel="Sign out"
        onConfirm={signOut}
      />
    </>
  );
}
