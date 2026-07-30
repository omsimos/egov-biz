"use client";

import {
  AirplaneTiltIcon,
  BankIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CloudSunIcon,
  HeartbeatIcon,
  type Icon as PhosphorIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  StorefrontIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { AccountDialog } from "@/components/account-dialog";
import { EGovLogo } from "@/components/egov-logo";
import { BottomNav, StatusBar } from "@/components/phone-chrome";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { cn, FOCUS_RING } from "@/lib/utils";

// Business is the one service this app builds, so it is the one tile that is a
// control. The other four are the real eGovPH launcher's neighbours, recessed
// rather than omitted: without them the row loses the context that makes
// Business read as one service among many. Plain content, not disabled
// <button>s — a control that does nothing reads as broken and announces four
// dead destinations.
const services: { Icon: PhosphorIcon; label: string }[] = [
  { Icon: BuildingsIcon, label: "NGAs" },
  { Icon: BankIcon, label: "LGUs" },
  { Icon: AirplaneTiltIcon, label: "Travel" },
  { Icon: HeartbeatIcon, label: "Health" },
];

function useLauncherDate() {
  // Rendered on the client only: the server and the phone are rarely in the
  // same timezone, and a greeting strip that changes on hydration is worse
  // than one that arrives a frame late (same reason as StatusBar's clock).
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    const parts = (options: Intl.DateTimeFormatOptions) =>
      now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", ...options });
    setDate(
      `${parts({ weekday: "short" })} · ${parts({ day: "numeric", month: "short", year: "numeric" })}`,
    );
  }, []);
  return date;
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
  const date = useLauncherDate();
  return (
    <div className="screen">
      <StatusBar />
      <div
        // pb clears the QR orb, which is 52px at margin-top:-16px and so floats
        // 4px over this scroller's last line.
        className="h-[calc(100%-var(--status-bar-h)-76px)] overflow-y-auto overscroll-contain px-[18px] pt-3.5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        id="app-content"
      >
        <header className="flex items-center justify-between gap-3">
          <EGovLogo priority size={26} />
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex flex-col items-end gap-px">
              <strong className="text-base font-extrabold -tracking-[.3px] text-primary">
                Mabuhay, {profile.firstName.toUpperCase()}
              </strong>
              <span className="text-meta text-gray-800">Welcome to eGovPH</span>
            </span>
            <AccountDialog
              avatarClassName="size-[38px] bg-primary text-base font-black text-white"
              onLogout={onLogout}
              profile={profile}
              size="md"
            />
          </div>
        </header>

        <div className="mt-3.5 flex items-center justify-between gap-2.5 rounded-lg bg-gray-100 px-3.5 py-[11px]">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <MoonIcon className="size-4 text-gray-800" />
            {profile.city || "Metro Manila"}
          </span>
          {/* Reserved rather than conditional: the strip is one row and letting
              it collapse to a single item for a frame moves the city label. */}
          <span className="text-sm font-semibold text-gray-800">{date ?? " "}</span>
        </div>

        {/* Search belongs to the eGovPH shell, which this app does not build.
            Drawn because the row above and the tiles below only read as the
            launcher with it there, and hidden from AT because there is nothing
            to search. */}
        <div
          aria-hidden="true"
          className="mt-2.5 flex items-center justify-between gap-2.5 rounded-lg border border-border px-[15px] py-[13px]"
        >
          <span className="text-copy text-gray-600">
            Search Services like <strong className="text-gray-800">Philhealth</strong>
          </span>
          <MagnifyingGlassIcon className="size-[17px] text-primary" weight="bold" />
        </div>

        <nav aria-label="eGovPH services" className="mt-5 grid grid-cols-5 gap-1">
          {services.map(({ Icon, label }) => (
            <span className="flex flex-col items-center gap-[7px]" key={label}>
              <span className="grid size-[52px] place-items-center rounded-full bg-muted text-gray-400">
                <Icon className="size-[25px]" weight="duotone" />
              </span>
              <span className="text-meta font-bold text-gray-500">{label}</span>
            </span>
          ))}
          <button
            className={cn("group flex flex-col items-center gap-[7px] rounded-2xl", FOCUS_RING)}
            data-cuelume-toggle="page"
            onClick={onBusiness}
            type="button"
          >
            <span className="relative grid size-[52px] place-items-center rounded-full bg-secondary text-primary transition-transform duration-150 ease-[var(--ease-out)] group-active:scale-[var(--press-sm)]">
              <BriefcaseIcon className="size-[25px]" weight="duotone" />
              <span className="absolute -top-[7px] -right-[9px] rounded-[7px] border-2 border-white bg-destructive px-1.5 py-0.5 text-2xs font-black text-destructive-foreground">
                New
              </span>
            </span>
            <span className="text-meta font-extrabold">Business</span>
          </button>
        </nav>

        {/* The launcher's promoted slide. w-full and a wrapper-free grid, not
            mx-auto: `display: grid` on a <button> resolves `width: auto` to
            shrink-to-fit, which sizes the card to its own longest line. */}
        <button
          className={cn(
            "mt-[22px] grid w-full grid-cols-[1fr_78px] items-center gap-3 rounded-xl bg-[linear-gradient(140deg,var(--primary-lift)_0%,var(--primary-deep)_60%,var(--primary-deeper)_100%)] p-[18px] text-left text-white",
            "transition-transform duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          onClick={onBusiness}
          type="button"
        >
          <span className="flex min-w-0 flex-col gap-[9px]">
            <span className="self-start rounded-[6px] bg-gold-soft px-2 py-[3px] text-xs font-black text-primary-ink">
              New in eGovPH
            </span>
            <strong className="text-[18px] leading-[1.35] font-extrabold -tracking-[.3px]">
              Register a business without leaving the app
            </strong>
            <span className="text-sm leading-[1.6] text-primary-border">
              DTI, barangay, mayor’s permit and BIR in one guided plan.
            </span>
          </span>

          <span className="grid size-[78px] place-items-center justify-self-end rounded-[20px] bg-white/16">
            <StorefrontIcon className="size-10" weight="duotone" />
          </span>
        </button>

        {/* Position within the launcher's carousel, which has one real slide. */}
        <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-[5px]">
          <span className="h-1.5 w-[18px] rounded-full bg-primary" />
          {[0, 1, 2, 3].map((dot) => (
            <span className="size-1.5 rounded-full bg-gray-300" key={dot} />
          ))}
        </div>

        {/* Placeholders for the launcher's PAGASA, eTrabaho and eGov AI slots.
            Greyed because none of the three is wired here, and drawn at all
            because the promoted card above needs something below it to be
            promoted over. */}
        <div aria-hidden="true" className="mt-[18px] grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5 rounded-xl bg-gray-100 p-[15px] text-gray-600">
            <CloudSunIcon className="size-[26px] text-gray-400" weight="duotone" />
            <strong className="text-[26px] leading-none -tracking-[1px]">25°C</strong>
            <span className="text-copy font-bold">Taguig</span>
            <span className="text-meta text-gray-500">Partly cloudy</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {["eTrabaho", "eGov AI"].map((tile) => (
              <div
                className="grid flex-1 place-items-center rounded-xl bg-gray-100 p-[15px] text-base font-extrabold text-gray-500"
                key={tile}
              >
                {tile}
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav active="home" />
    </div>
  );
}
