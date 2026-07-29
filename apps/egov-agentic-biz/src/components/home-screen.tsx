"use client";

import {
  BellSimpleIcon,
  BriefcaseIcon,
  FileTextIcon,
  HeartbeatIcon,
  type Icon as PhosphorIcon,
  IdentificationCardIcon,
  ReceiptIcon,
  ScalesIcon,
  StorefrontIcon,
} from "@phosphor-icons/react";
import { AccountDialog } from "@/components/account-dialog";
import { BrandLogo } from "@/components/brand-logo";
import { BottomNav, StatusBar } from "@/components/phone-chrome";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { cn, FOCUS_RING } from "@/lib/utils";

type ServiceTile = {
  Icon: PhosphorIcon;
  chip: string;
  label: string;
  business?: boolean;
};

// The tint marks the domain, not "this one works" — Business is still the only
// tile wired anywhere.
const services: ServiceTile[] = [
  { Icon: IdentificationCardIcon, chip: "bg-secondary text-primary", label: "National ID" },
  {
    business: true,
    chip: "bg-orange-soft text-orange-ink",
    Icon: BriefcaseIcon,
    label: "Business",
  },
  { chip: "bg-success-soft text-success", Icon: HeartbeatIcon, label: "Health" },
  { chip: "bg-destructive-soft text-[var(--flag-red)]", Icon: ScalesIcon, label: "Legal" },
];

// Both open the registration flow: the agent walks the DTI name search and BIR
// registration as steps of one plan, so neither has a screen of its own.
const popularServices = [
  {
    description: "Check and reserve your trade name",
    Icon: FileTextIcon,
    tone: "text-primary",
    title: "DTI name search",
  },
  {
    description: "Get your TIN and COR in-app",
    Icon: ReceiptIcon,
    tone: "text-[var(--egov-orange)]",
    title: "BIR registration",
  },
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
        // pb clears the QR orb, which is 52px at margin-top:-16px and so floats
        // 4px over this scroller's last line.
        className="h-[calc(100%-36px-76px)] overflow-y-auto overscroll-contain pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        id="app-content"
      >
        <header className="sticky top-0 z-12 flex h-[58px] items-center justify-between bg-white/94 px-5 py-2 backdrop-blur-[8px]">
          <BrandLogo height={23} priority />
          {/* Decoration, not a control: the app tracks no notification state, so
              the old labelled bell and its hardcoded unread dot claimed one. */}
          <span
            aria-hidden="true"
            className="inline-grid size-[38px] shrink-0 place-items-center rounded-full text-primary"
          >
            <BellSimpleIcon className="size-5" weight="fill" />
          </span>
        </header>

        <section className="mt-1.5 flex items-center gap-3 px-5">
          <AccountDialog onLogout={onLogout} profile={profile} />
          <div className="flex flex-col gap-0.5">
            {/* Down from --text-xl: the promo card is this screen's anchor, and a
                27px greeting competed with it. */}
            <strong className="text-lg -tracking-[.4px] text-primary">
              Hi, {profile.firstName}
            </strong>
            <span className="text-sm text-muted-foreground">Welcome back</span>
          </div>
        </section>

        {/* Wrapper padding plus w-full, not mx-5: `display: grid` on a <button>
            resolves `width: auto` to shrink-to-fit, which sized this card to its
            own text and pulled the orange disc in over the title. */}
        <div className="mt-[18px] px-5">
          <button
            className={cn(
              "relative grid w-full grid-cols-[46px_1fr] items-center gap-[13px] overflow-hidden rounded-[20px] bg-primary p-[18px] text-left text-primary-foreground",
              "transition-transform duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]",
              FOCUS_RING,
            )}
            data-cuelume-toggle="page"
            onClick={onBusiness}
            type="button"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-[58px] -right-[56px] size-[110px] rounded-full bg-[var(--egov-orange)]"
            />
            <span className="relative z-10 grid size-[46px] place-items-center rounded-[14px] bg-white text-primary">
              <StorefrontIcon className="size-[27px]" weight="duotone" />
            </span>
            <span className="relative z-10 flex flex-col gap-px">
              <small className="text-xs font-extrabold text-primary-border">NEW IN eGOVPH</small>
              <strong className="text-md -tracking-[.3px]">Register a business</strong>
            </span>
          </button>
        </div>

        <nav aria-label="eGovPH services" className="mt-5 grid grid-cols-4 gap-x-1 px-5">
          {services.map(({ Icon, business, chip, label }) => {
            const glyph = (
              <span
                className={cn(
                  "grid size-[56px] place-items-center rounded-[18px]",
                  chip,
                  business && "transition-transform group-active:scale-[.93]",
                )}
              >
                <Icon className="size-[27px]" weight="duotone" />
              </span>
            );
            const caption = <span className="text-sm font-bold">{label}</span>;
            // Plain content for the unwired tiles: a <button> that does nothing
            // reads as broken and announces three dead controls.
            return business ? (
              <button
                className={cn(
                  "group flex flex-col items-center gap-[7px] rounded-2xl text-center text-foreground",
                  FOCUS_RING,
                )}
                data-cuelume-toggle="page"
                key={label}
                onClick={onBusiness}
                type="button"
              >
                {glyph}
                {caption}
              </button>
            ) : (
              <div
                className="flex flex-col items-center gap-[7px] text-center text-foreground"
                key={label}
              >
                {glyph}
                {caption}
              </div>
            );
          })}
        </nav>

        <section aria-labelledby="popular-services" className="mt-6 px-5">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-md -tracking-[.3px]" id="popular-services">
              Popular services
            </h2>
            {/* Was a link-styled span attached to nothing; same destination as
                the two cards below, so now it actually goes there. */}
            <button
              className={cn("text-sm font-extrabold text-primary", FOCUS_RING)}
              data-cuelume-toggle="page"
              onClick={onBusiness}
              type="button"
            >
              See all
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {popularServices.map(({ description, Icon, title, tone }) => (
              <button
                className={cn(
                  "flex min-h-[120px] flex-col items-start gap-1.5 rounded-[17px] border border-border p-[15px] text-left",
                  "transition-transform duration-150 ease-[var(--ease-out)] active:scale-[var(--press-md)]",
                  FOCUS_RING,
                )}
                data-cuelume-toggle="page"
                key={title}
                onClick={onBusiness}
                type="button"
              >
                <Icon className={cn("size-[26px]", tone)} weight="duotone" />
                <strong className="text-base -tracking-[.2px]">{title}</strong>
                <span className="text-sm leading-[1.4] text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <BottomNav active="home" />
    </div>
  );
}
