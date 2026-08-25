"use client";

import { useState } from "react";
import type { CitizenProfile } from "@/lib/citizen-profile";

export function ProfileAvatar({
  className,
  profile,
}: {
  className?: string;
  profile: CitizenProfile;
}) {
  const [failed, setFailed] = useState(false);
  // The failure belongs to the URL that failed, so a new photo gets a fresh
  // attempt. Compared during render rather than cleared in an effect: the
  // effect would paint the initials for one frame over a URL nothing has tried
  // yet. Kept here rather than pushed onto callers as a `key`.
  const [triedUrl, setTriedUrl] = useState(profile.avatarUrl);
  if (triedUrl !== profile.avatarUrl) {
    setTriedUrl(profile.avatarUrl);
    setFailed(false);
  }

  if (!profile.avatarUrl || failed) {
    return (
      <span className={`profile-avatar-fallback ${className ?? ""}`} aria-hidden="true">
        {profile.firstName.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // The source is a same-origin, authenticated proxy for the eGov profile photo.
    // oxlint-disable-next-line next/no-img-element
    <img
      alt={`${profile.fullName} profile`}
      className={className}
      decoding="async"
      onError={() => setFailed(true)}
      src={profile.avatarUrl}
    />
  );
}
