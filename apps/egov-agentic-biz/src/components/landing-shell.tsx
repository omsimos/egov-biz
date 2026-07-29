"use client";

import {
  ArrowRightIcon,
  BuildingsIcon,
  ClockIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { Ref } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LANDING } from "@/lib/motion";
import { cn, FOCUS_RING } from "@/lib/utils";

// The three claims under the copy. Each colour is the design's, and each maps to
// a brand token rather than the literal hex.
const trustPoints = [
  { Icon: ShieldCheckIcon, label: "PhilSys verified", tone: "text-success" },
  { Icon: ClockIcon, label: "Under 15 minutes", tone: "text-primary" },
  { Icon: BuildingsIcon, label: "4 agencies, one flow", tone: "text-[var(--egov-orange)]" },
];

// "How it works", "Services" and "Support" are the design's header nav. This
// landing is one viewport with no sections beneath it, so the design's own
// `#how` / `#services` / `#support` targets do not exist here either. They
// render as text, not links: a nav item that looks like a link and resolves to
// nothing is the failure this codebase already refuses on Home's service tiles.
const navItems = ["How it works", "Services", "Support"];

const HEADER_BUTTON = "font-extrabold text-base transition-colors duration-150 disabled:opacity-60";

// Two exports rather than one shell, because the header and the copy do not sit
// in the same box: the header spans the stage, while the copy is the phone's
// flex sibling inside .landing-main. Returning both from one component put the
// copy outside that row, which stacked it above the phone instead of beside it.
export function LandingHeader({ onStart }: { onStart: () => void }) {
  return (
    // z-1, not z-5: above .landing-blobs (z-0, and positioned, so it would
    // otherwise paint over this header's text) but below .landing-main (z-2), so
    // nothing in the header — least of all the blue Get started button, which sits
    // nearest the phone at narrow widths — can ever paint over the device.
    <header className="relative z-1 hidden flex-none items-center justify-between gap-8 px-[clamp(20px,4vw,56px)] py-[22px] min-[760px]:flex">
      <BrandLogo height={30} priority />
      <nav aria-label="About eGOVbusiness" className="flex items-center gap-[34px]">
        {navItems.map((item) => (
          <span className="text-base font-bold text-gray-800" key={item}>
            {item}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-3.5">
        <button
          className={cn(HEADER_BUTTON, "px-1.5 py-[11px] hover:text-primary", FOCUS_RING)}
          data-cuelume-toggle="page"
          onClick={onStart}
          type="button"
        >
          Log in
        </button>
        <button
          className={cn(
            HEADER_BUTTON,
            "rounded-xl bg-primary px-6 py-[13px] text-primary-foreground shadow-[0_10px_24px_-10px_rgba(7,85,233,.7)]",
            "hover:bg-primary-hover hover:shadow-[0_10px_24px_-10px_rgba(7,85,233,.9)]",
            "duration-150 ease-[var(--ease-out)] active:scale-[var(--press-md)] motion-reduce:transition-none",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          onClick={onStart}
          type="button"
        >
          Get started
        </button>
      </div>
    </header>
  );
}

export function LandingCopy({
  collapsed,
  onStart,
  ref,
  slide,
}: {
  collapsed: boolean;
  onStart: () => void;
  // Measured by the stage, which needs this column's width for the phone's own
  // offset anyway. Reusing it here keeps one measurement behind both slides.
  ref: Ref<HTMLDivElement>;
  slide: number;
}) {
  return (
    // aria-hidden and disabled while collapsed, not just off-screen: a translated
    // element is still in the accessibility tree and in the tab order, so a
    // keyboard user would otherwise tab into a headline and two buttons that have
    // left the viewport. `inert` is the one-attribute version of this once its
    // support is safe to assume in the browsers this has to run in.
    <motion.div
      animate={{ x: collapsed ? -slide : 0 }}
      aria-hidden={collapsed}
      className="landing-copy hidden min-[760px]:block"
      // The copy is already in place on arrival; only leaving is an animation.
      initial={false}
      ref={ref}
      transition={LANDING}
    >
      <span className="inline-flex items-center gap-[9px] rounded-full bg-secondary py-2 pr-4 pl-2.5 text-sm font-extrabold text-primary">
        <span className="grid size-[22px] place-items-center rounded-full bg-primary text-primary-foreground">
          <SparkleIcon className="size-[13px]" weight="bold" />
        </span>
        New in eGovPH
      </span>
      {/* The design's own type spec: 900 weight, near-solid leading, and −2.2px
            tracking, which only holds together at display sizes — hence the
            clamp floor of 38px rather than a smaller step. */}
      <h1 className="mt-[22px] text-[clamp(38px,5.2vw,70px)] leading-[1.02] font-black tracking-[-2.2px] text-balance">
        Register your business in one conversation.
      </h1>
      <p className="mt-5 max-w-[520px] text-[clamp(17px,1.6vw,21px)] leading-[1.55] text-pretty text-gray-800">
        eGOVbusiness handles DTI, BIR, and local permits for you. Answer a few questions, pay once,
        and get your certificates in the app.
      </p>
      <div className="mt-[30px] flex flex-wrap items-center gap-3.5">
        <button
          className={cn(
            "flex items-center gap-[11px] rounded-[14px] bg-primary px-8 py-[18px] text-lg font-extrabold text-primary-foreground shadow-[0_16px_34px_-14px_rgba(7,85,233,.8)]",
            "transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-primary-hover active:scale-[var(--press-md)] motion-reduce:transition-none",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          disabled={collapsed}
          onClick={onStart}
          type="button"
        >
          Get started <ArrowRightIcon className="size-[18px]" weight="bold" />
        </button>
        {/* There is no demo recording, so this opens sign-in like the primary
              CTA rather than sitting here inert. It is the one control on this
              page whose label promises something the app cannot yet deliver —
              point it at a real asset or drop it, but do not leave it dead. */}
        <button
          className={cn(
            "flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-gray-300 bg-white px-7 py-[17px] text-lg font-extrabold text-foreground",
            "transition-[color,border-color,scale] duration-150 ease-[var(--ease-out)] hover:border-primary hover:text-primary active:scale-[var(--press-md)] motion-reduce:transition-none",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          disabled={collapsed}
          onClick={onStart}
          type="button"
        >
          <PlayCircleIcon className="size-5" weight="fill" /> Watch demo
        </button>
      </div>
      <div className="mt-[34px] flex flex-wrap items-center gap-x-[26px] gap-y-3 text-base font-bold text-gray-800">
        {trustPoints.map(({ Icon, label, tone }) => (
          <span className="flex items-center gap-[9px]" key={label}>
            <Icon className={cn("size-5", tone)} weight="fill" />
            {label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
