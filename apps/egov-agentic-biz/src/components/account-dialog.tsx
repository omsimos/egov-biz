"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
        <DialogHeader>
          <DialogTitle>{profile.fullName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{profile.mobile}</p>
        <Button
          block
          className="mt-5 justify-start"
          onClick={() => {
            setOpen(false);
            onLogout();
          }}
          variant="destructive"
        >
          <SignOutIcon weight="bold" /> Sign out
        </Button>
      </DialogContent>
    </Dialog>
  );
}
