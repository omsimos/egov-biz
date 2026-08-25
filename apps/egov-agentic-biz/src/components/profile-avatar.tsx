"use client";

import { useEffect, useState } from "react";
import type { CitizenProfile } from "@/lib/citizen-profile";

export function ProfileAvatar({
  className,
  profile,
}: {
  className?: string;
  profile: CitizenProfile;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [profile.avatarUrl]);

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
