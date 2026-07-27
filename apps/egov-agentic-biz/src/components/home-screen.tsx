"use client";

import {
  AirplaneIcon,
  ArrowRightIcon,
  BankIcon,
  BellSimpleIcon,
  BriefcaseIcon,
  BuildingsIcon,
  DotsThreeIcon,
  HeartbeatIcon,
  type Icon as PhosphorIcon,
  MapPinIcon,
  MegaphoneIcon,
  StorefrontIcon,
} from "@phosphor-icons/react";
import { AccountDialog } from "@/components/account-dialog";
import { BrandLogo } from "@/components/brand-logo";
import { FlagSunrise } from "@/components/flag-sunrise";
import { BottomNav, StatusBar } from "@/components/phone-chrome";
import { Card, CardContent } from "@/components/ui/card";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { cn, FOCUS_RING } from "@/lib/utils";

type ServiceTile = {
  Icon: PhosphorIcon;
  label: string;
  business?: boolean;
};

// No `badge` field any more. Jobs carried a red "New" badge over a tile wired
// to nothing — an advertisement for a screen that does not exist — and
// Business no longer needs one: the promo card below already says NEW IN
// eGOVPH, and two shouts for one destination is the duplication this screen
// was suffering from.
const services: ServiceTile[] = [
  { Icon: BankIcon, label: "NGAs" },
  { Icon: BuildingsIcon, label: "LGUs" },
  { Icon: BriefcaseIcon, label: "Jobs" },
  { Icon: StorefrontIcon, label: "Business", business: true },
  { Icon: AirplaneIcon, label: "Travel" },
  { Icon: HeartbeatIcon, label: "Health" },
  { Icon: MegaphoneIcon, label: "Report" },
  { Icon: DotsThreeIcon, label: "More" },
];

export function HomeScreen({
  profile,
  onBusiness,
  onLogout,
}: {
  profile: CitizenProfile;
  onBusiness: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="screen">
      <StatusBar />
      <div
        // pb clears the Digital ID orb, which is 54px at margin-top:-27px and so
        // floats 27px over this scroller. At the old pb-[30px] the last card
        // stopped 3px short of it.
        className="h-[calc(100%-36px-76px)] overflow-y-auto overscroll-contain pb-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        id="app-content"
      >
        <header className="sticky top-0 z-12 flex h-[58px] items-center justify-between bg-white/94 px-5 py-2 backdrop-blur-[8px]">
          <BrandLogo height={23} priority />
          {/* Deliberately not an IconButton: there is no notifications screen to
              open, and a focusable <button> with no handler is a control that
              fails on contact — worse than the inert service tiles below, which
              are plain elements for exactly this reason. It stays as the status
              indicator it actually is until there is something to open. */}
          <span
            aria-label="You have unread notifications"
            className="relative inline-grid size-10 shrink-0 place-items-center rounded-full"
            role="img"
          >
            <BellSimpleIcon className="size-6" weight="fill" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full border-2 border-white bg-[var(--egov-red)]" />
          </span>
        </header>

        <section className="flex items-center justify-between px-5 py-2">
          <div className="flex items-center gap-3">
            <AccountDialog onLogout={onLogout} profile={profile} />
            <div className="flex flex-col gap-0.5">
              {/* --text-xl, defined at 27px and used once in the whole app. The
                  greeting was the largest type on Home at 20px, which left the
                  screen with no anchor; the mobile number sat beneath it at 15px
                  competing for the same attention nobody came here to give it. */}
              <strong className="text-xl -tracking-[.6px] text-primary">
                Hi, {profile.firstName}
              </strong>
              <span className="text-sm text-muted-foreground">{profile.mobile}</span>
            </div>
          </div>
          <FlagSunrise />
        </section>

        <nav
          aria-label="eGovPH services"
          className="grid grid-cols-4 gap-x-1.5 gap-y-4 px-3.5 pb-6"
        >
          {services.map(({ Icon, business, label }) => {
            // Business is the only tile with a destination. It used to be the
            // only *filled* one too, which read as "featured" rather than "this
            // is the one that works" — so seven identical-looking neighbours
            // failed silently on tap. The seven now recede and Business takes
            // the standard tint, leaving the promo card as the single blue block.
            const chip = (
              <span
                className={cn(
                  "relative grid size-[62px] place-items-center rounded-full",
                  business
                    ? "bg-secondary text-primary transition-transform group-active:scale-[.93]"
                    : "bg-gray-100 text-gray-500",
                )}
              >
                <Icon className="size-[31px]" weight="duotone" />
              </span>
            );
            const caption = (
              <span className={business ? "font-black" : "font-normal text-gray-600"}>{label}</span>
            );
            // Only Business is wired to anything. The rest are a service
            // directory, so they render as plain content — a <button> that
            // does nothing reads as broken and makes screen readers announce
            // seven dead controls.
            return business ? (
              <button
                className={cn(
                  "group flex flex-col items-center gap-[7px] rounded-2xl text-sm text-foreground",
                  FOCUS_RING,
                )}
                data-cuelume-toggle="page"
                key={label}
                onClick={onBusiness}
                type="button"
              >
                {chip}
                {caption}
              </button>
            ) : (
              <div
                className="flex flex-col items-center gap-[7px] text-sm text-foreground"
                key={label}
              >
                {chip}
                {caption}
              </div>
            );
          })}
        </nav>

        <button
          className={cn(
            "relative mx-[18px] mb-[27px] grid grid-cols-[50px_1fr_22px] items-center gap-3 overflow-hidden rounded-xl bg-primary px-[15px] py-[17px] text-left text-primary-foreground shadow-[0_12px_25px_rgba(7,85,233,.18)]",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          onClick={onBusiness}
          type="button"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-[60px] -right-[58px] size-[100px] rounded-full bg-[var(--egov-orange)]"
          />
          <span className="grid size-12 place-items-center rounded-lg bg-white text-primary">
            <StorefrontIcon className="size-[29px]" weight="duotone" />
          </span>
          <span className="relative z-10 flex flex-col">
            <small className="text-2xs font-extrabold tracking-[1.2px] text-primary-border">
              NEW IN eGOVPH
            </small>
            <strong className="my-0.5 text-base">Start and grow your business</strong>
            <span className="text-sm text-primary-border">
              One guided path across government services
            </span>
          </span>
          <ArrowRightIcon className="relative z-10 size-[18px]" weight="bold" />
        </button>

        <section aria-label="Featured for you" className="px-[18px]">
          <div className="mb-[13px] flex items-end justify-between">
            <div>
              <small className="mb-0.5 block text-2xs font-extrabold tracking-[1.3px] text-primary">
                CONNECTED SERVICES
              </small>
              <h2 className="text-lg -tracking-[.5px]">Featured for you</h2>
            </div>
            {/* Styled as a link, wired to nothing — so it stops looking like one. */}
            <span className="text-base text-gray-600">See all</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                Icon: BuildingsIcon,
                kicker: "National documents",
                title: "National Government Services",
              },
              {
                Icon: MapPinIcon,
                kicker: "Near your address",
                title: `${profile.city} City Services`,
              },
            ].map(({ Icon, kicker, title }) => (
              <Card className="relative min-h-[150px] overflow-hidden" key={kicker}>
                <CardContent>
                  <span className="text-sm text-muted-foreground">{kicker}</span>
                  <strong className="mt-1 block max-w-[125px] text-base leading-[1.25]">
                    {title}
                  </strong>
                </CardContent>
                <div
                  aria-hidden="true"
                  className="absolute -right-2.5 -bottom-4 grid h-[93px] w-[105px] place-items-center rounded-[55%_0_0_0] bg-gray-50 text-primary"
                >
                  <Icon className="size-[55px]" weight="duotone" />
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
      <BottomNav active="home" />
    </div>
  );
}
