"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { cn, FOCUS_RING } from "@/lib/utils";

// The avatar used to sign you out on a single tap, warned only by a title
// tooltip. An irreversible action must not sit on the most-tapped affordance
// on the screen, so it now opens this sheet and sign-out is an explicit,
// labelled item inside it.
export function AccountDialog({
  avatarClassName,
  onLogout,
  profile,
  size = "lg",
}: {
  // The trigger is the same control on every screen but not the same mark: the
  // launcher draws a 38px solid-blue initial, the Business header a tinted one.
  avatarClassName?: string;
  onLogout: () => void;
  profile: CitizenProfile;
  size?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        aria-label="Account"
        className={cn("shrink-0 rounded-full", FOCUS_RING)}
        data-cuelume-toggle="tick"
      >
        <Avatar className={avatarClassName} size={size}>
          {profile.avatarUrl && (
            <AvatarImage alt={`${profile.fullName} profile`} src={profile.avatarUrl} />
          )}
          <AvatarFallback>{profile.firstName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DialogTrigger>
      <DialogContent>
        {/* Who you are signed in as, on the same 46px-tile-and-two-lines row the
            record screen's assistant card uses, so the two sheets in the app
            introduce themselves the same way. */}
        <div className="mt-4 grid grid-cols-[46px_minmax(0,1fr)] items-center gap-[13px]">
          <Avatar className="size-[46px] text-md" size="lg">
            {profile.avatarUrl && (
              <AvatarImage alt={`${profile.fullName} profile`} src={profile.avatarUrl} />
            )}
            <AvatarFallback>{profile.firstName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col gap-px">
            <DialogTitle className="truncate text-[19px] leading-[1.3] font-extrabold -tracking-[.3px]">
              {profile.fullName}
            </DialogTitle>
            <span className="truncate text-sm text-muted-foreground">
              {profile.mobile || profile.email}
            </span>
          </span>
        </div>
        <Button
          block
          className="mt-5 h-[52px] rounded-[14px] text-[17px]"
          onClick={() => {
            setOpen(false);
            onLogout();
          }}
          variant="destructive"
        >
          <SignOutIcon className="size-[17px]" weight="bold" /> Sign out
        </Button>
      </DialogContent>
    </Dialog>
  );
}
