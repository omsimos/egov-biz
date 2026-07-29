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

const trustPoints = [
  { Icon: ShieldCheckIcon, label: "PhilSys verified", tone: "text-success" },
  { Icon: ClockIcon, label: "Under 15 minutes", tone: "text-primary" },
  { Icon: BuildingsIcon, label: "4 agencies, one flow", tone: "text-[var(--egov-orange)]" },
];

// Spans, not links: this landing is one viewport with no sections to target.
const navItems = ["How it works", "Services", "Support"];

const HEADER_BUTTON = "font-extrabold text-base transition-colors duration-150 disabled:opacity-60";

// Two exports, not one shell: the header spans the stage while the copy is the
// phone's flex sibling inside .landing-main.
export function LandingHeader({ onStart }: { onStart: () => void }) {
  return (
    // Above .landing-blobs (z-0, positioned) but below .landing-main (z-2), so
    // nothing here can paint over the phone at narrow widths.
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
  ref: Ref<HTMLDivElement>;
  slide: number;
}) {
  return (
    // aria-hidden and disabled, not just off-screen: a translated element keeps
    // its place in the accessibility tree and the tab order.
    <motion.div
      animate={{ x: collapsed ? -slide : 0 }}
      aria-hidden={collapsed}
      className="landing-copy hidden min-[760px]:block"
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
        {/* No demo recording exists, so this opens sign-in rather than sitting
            inert. Point it at a real asset or drop it. */}
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
