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

// Four domain tiles, from the Landing design. The eight-tile directory this
// replaces (NGAs, LGUs, Jobs, Travel, Report, More alongside these) spent a
// second row on labels with nothing behind them; a tinted chip per domain does
// the same orienting job in one row. Business is still the only tile wired
// anywhere, and no longer the only coloured one — the tint is the domain, not a
// "this one works" marker.
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

// Both open the registration flow, which is where these two tasks are actually
// carried out — the agent walks the DTI name search and the BIR registration as
// steps of one plan, so neither needs (or has) a screen of its own to land on.
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
          {/* aria-hidden now, where this was a labelled status indicator. The
              red unread dot it carried was hardcoded — the app tracks no
              notification state and has no notifications screen — so the label
              announced a claim nothing backed. The design draws the bell
              without the dot, which leaves it as the decoration it always was.
              Still not a <button>: there is nothing to open. */}
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
            {/* text-lg (20px), down from --text-xl's 27px. The promo card below
                is this screen's anchor in the new design and a 27px greeting was
                competing with it for that job. The mobile number that used to
                sit underneath is gone from the screen entirely — it is one tap
                away in the account sheet the avatar opens, which is where you
                go when you want to check which account you are in. */}
            <strong className="text-lg -tracking-[.4px] text-primary">
              Hi, {profile.firstName}
            </strong>
            <span className="text-sm text-muted-foreground">Welcome back</span>
          </div>
        </section>

        {/* No trailing arrow and no drop shadow, both dropped to match the
            design: flat brand blue against a white screen, with the orange disc
            bleeding out of the corner, is already the loudest object here. The
            press response stays — it is the one control on Home that leads
            anywhere, and cuelume plays a click on it.

            The gutter is the wrapper's padding rather than a margin on the
            button, and w-full is not decoration: `display: grid` on a <button>
            still resolves `width: auto` to shrink-to-fit, not stretch, so as a
            bare `mx-5 grid` element this card sized itself to its own text —
            which pulled the orange disc in over the title. */}
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
            // Only Business is wired to anything. The rest are a service
            // directory, so they render as plain content — a <button> that does
            // nothing reads as broken and makes screen readers announce three
            // dead controls.
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
            {/* Wired, where this was a blue span styled as a link and attached
                to nothing. Now that both cards below open the registration
                flow, so does this — it is the same destination, so it can look
                like the link it is. */}
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
