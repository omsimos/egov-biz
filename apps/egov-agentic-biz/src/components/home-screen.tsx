"use client";

import {
  AirplaneIcon,
  ArrowRightIcon,
  BankIcon,
  BuildingsIcon,
  CloudWarningIcon,
  HeartbeatIcon,
  type Icon as PhosphorIcon,
  MegaphoneIcon,
  StorefrontIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { EGovLogo } from "@/components/egov-logo";
import { BottomNav, StatusBar } from "@/components/phone-chrome";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { cn } from "@/lib/utils";

const FOCUS_RING =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2";

type ServiceTile = {
  Icon: PhosphorIcon;
  label: string;
  badge?: string;
  business?: boolean;
};

const services: ServiceTile[] = [
  { Icon: BankIcon, label: "NGAs" },
  { Icon: BuildingsIcon, label: "LGUs" },
  { Icon: StorefrontIcon, label: "Business", badge: "New", business: true },
  { Icon: AirplaneIcon, label: "Travel" },
  { Icon: HeartbeatIcon, label: "Health" },
  { Icon: MegaphoneIcon, label: "Report", badge: "New" },
];

function Mascot() {
  return (
    <svg
      aria-hidden="true"
      className="absolute right-1.5 -bottom-0.5 w-[66px] h-[74px]"
      viewBox="0 0 64 72"
    >
      <rect fill="#5fc887" height="10" rx="3" width="10" x="3" y="13" />
      <path
        d="M6.4 17.2l1.6 1.8 3-3.4"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="42" fill="#ffd23e" r="4" />
      <path
        d="M18 23c0-9 6-14.5 14-14.5S46 14 46 23l-.8 3.6C43 20.8 40 18.6 32 18.6s-11 2.2-13.2 8z"
        fill="#23262e"
      />
      <circle cx="32" cy="27" fill="#f7c092" r="11.2" />
      <path
        d="M21.4 23.2c1-5.8 4.8-8.8 10.6-8.8s9.6 3 10.6 8.8c-2.9-2.9-5.8-3.9-10.6-3.9s-7.7 1-10.6 3.9z"
        fill="#23262e"
      />
      <circle cx="27.6" cy="27" fill="#232323" r="1.6" />
      <circle cx="36.4" cy="27" fill="#232323" r="1.6" />
      <path
        d="M28.6 31.6c2 1.9 4.8 1.9 6.8 0"
        fill="none"
        stroke="#b26b45"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path d="M17.5 63c0-11.6 5.8-18.6 14.5-18.6S46.5 51.4 46.5 63z" fill="#f4f6f8" />
      <path d="M32 45v10.5" stroke="#d7dde3" strokeWidth="1.6" />
      <path d="M28 45l4 4.6 4-4.6" fill="none" stroke="#c3ccd4" strokeWidth="1.6" />
      <path
        d="M40 51.5c2.4 1.8 4.4 2 6 1"
        fill="none"
        stroke="#f7c092"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <rect fill="#1553e0" height="19" rx="3.5" width="11.5" x="45" y="44" />
      <rect fill="#fff" height="11.5" rx="1.5" width="7.5" x="47" y="47" />
      <circle cx="50.75" cy="60.5" fill="#fff" r="1" />
    </svg>
  );
}

function formatToday() {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} - ${month} ${now.getDate()}, ${now.getFullYear()}`;
}

export function HomeScreen({
  profile,
  onBusiness,
  onLogout,
}: {
  profile: CitizenProfile;
  onBusiness: () => void;
  onLogout: () => void;
}) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(formatToday()), []);

  return (
    <div className="screen">
      <StatusBar />
      <div
        className="h-[calc(100%-36px-76px)] overflow-y-auto overscroll-contain pb-[30px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        id="app-content"
      >
        <header className="flex items-center gap-3 px-5 pt-3.5 pb-3">
          <button
            className={cn("shrink-0 rounded-full", FOCUS_RING)}
            data-cuelume-toggle="tick"
            onClick={() => {
              if (window.confirm("Sign out of eGovPH?")) onLogout();
            }}
            title="Sign out"
            type="button"
          >
            <Avatar size="lg">
              {profile.avatarUrl && (
                <AvatarImage alt={`${profile.fullName} profile`} src={profile.avatarUrl} />
              )}
              <AvatarFallback>{profile.firstName.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-lg font-extrabold -tracking-[.2px] text-primary">
              Hi, {profile.firstName}
            </span>
            <span className="text-xs font-medium text-muted-foreground">Welcome to eGovPH</span>
          </div>
          <EGovLogo size={25} />
        </header>

        <div className="mx-5 mt-0.5 mb-3 flex min-h-[42px] items-center gap-2 rounded-xl bg-[var(--warning-soft)] px-3.5">
          <SunIcon
            aria-hidden
            className="size-5 shrink-0 text-[var(--egov-orange)]"
            weight="duotone"
          />
          <span className="text-sm font-semibold text-muted-foreground" suppressHydrationWarning>
            {today ?? formatToday()}
          </span>
        </div>

        <nav aria-label="eGovPH services" className="grid grid-cols-4 gap-x-2 gap-y-5 px-5 pb-6">
          {services.map(({ Icon, badge, business, label }) => (
            <button
              className={cn(
                "group flex flex-col items-center gap-2 text-[12.5px] font-medium text-foreground",
                FOCUS_RING,
                "rounded-2xl",
              )}
              data-cuelume-toggle={business ? "page" : "tick"}
              key={label}
              onClick={business ? onBusiness : undefined}
              type="button"
            >
              <span
                className={cn(
                  "relative grid size-[62px] place-items-center rounded-full transition-transform group-active:scale-[.93]",
                  business
                    ? "bg-primary text-primary-foreground shadow-primary"
                    : "bg-secondary text-primary",
                )}
              >
                <Icon className="size-8" weight="duotone" />
                {badge && (
                  <Badge className="absolute -top-1 -right-2 bg-[var(--egov-orange)] text-white">
                    {badge}
                  </Badge>
                )}
              </span>
              {label}
            </button>
          ))}
        </nav>

        <button
          className={cn(
            "relative mx-5 mb-6 block overflow-hidden rounded-xl bg-primary px-5 py-6 text-left text-primary-foreground shadow-primary",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          onClick={onBusiness}
          type="button"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-9 -right-9 size-28 rounded-full bg-[var(--egov-orange)]"
          />
          <StorefrontIcon
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-4 right-3 size-24 text-white opacity-25"
            weight="duotone"
          />
          <div className="relative z-10 flex max-w-[230px] flex-col gap-1.5">
            <strong className="text-md font-extrabold leading-snug -tracking-[.3px]">
              Start and grow your business
            </strong>
            <span className="text-xs font-medium opacity-[.85]">
              DTI, BIR &amp; LGU permits in one guided flow
            </span>
            <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-primary">
              Get started <ArrowRightIcon className="size-3.5" weight="bold" />
            </span>
          </div>
        </button>

        <section aria-label="Featured for you" className="px-5">
          <h2 className="mb-3 text-base font-extrabold -tracking-[.2px]">Featured for you</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 bg-muted shadow-none">
              <CardContent className="flex h-full flex-col justify-end gap-1 p-4">
                <CloudWarningIcon className="mb-auto size-9 text-primary" weight="duotone" />
                <strong className="text-[22px] font-extrabold -tracking-[.5px]">-°C</strong>
                <span className="text-xs font-semibold">Not available</span>
                <small className="text-2xs text-muted-foreground">Enable Location</small>
              </CardContent>
            </Card>
            <button
              className={cn("block text-left", FOCUS_RING, "rounded-xl")}
              data-cuelume-toggle="page"
              onClick={onBusiness}
              type="button"
            >
              <Card className="relative h-full overflow-hidden border-0 bg-[#e3f4dd] shadow-none">
                <CardContent className="relative z-10 flex h-full flex-col justify-between p-4">
                  <span className="text-base font-extrabold -tracking-[.3px] text-[#1c3050]">
                    <span className="text-primary">e</span>Gov AI
                  </span>
                </CardContent>
                <Mascot />
              </Card>
            </button>
          </div>
        </section>
      </div>
      <BottomNav active="home" />
    </div>
  );
}
