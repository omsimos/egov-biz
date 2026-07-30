"use client";

import {
  BellSlashIcon,
  FileTextIcon,
  HouseIcon,
  IdentificationCardIcon,
  NewspaperIcon,
  QrCodeIcon,
  ScanIcon,
  SquaresFourIcon,
  UserIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { OmsimosMark } from "@/components/omsimos-mark";
import { ISLAND_CARD_IN, ISLAND_CARD_OUT, ISLAND_IN, ISLAND_OUT } from "@/lib/motion";

/**
 * The phone frame element that sheets portal into. Base UI requires a
 * `Dialog.Portal`, and portalled to `<body>` a sheet escapes the device: on a
 * desktop viewport it spans the window and centres on the page rather than on
 * the phone. Pointing the portal at `.phone-shell` — which is
 * `position: relative; overflow: hidden` — puts every sheet inside the frame
 * and lets `DialogContent` position itself with `absolute`.
 *
 * Null until the frame mounts, and in any tree without one; `DialogPortal`
 * falls back to `<body>` there rather than failing to render.
 */
const PhoneFrameContext = createContext<HTMLElement | null>(null);

export function PhoneFrame({
  children,
  element,
}: {
  children: ReactNode;
  element: HTMLElement | null;
}) {
  return <PhoneFrameContext.Provider value={element}>{children}</PhoneFrameContext.Provider>;
}

export function usePhoneFrame() {
  return useContext(PhoneFrameContext);
}

// Resting, then hovered. Geometry lives here rather than in CSS because motion
// animates it inline and the two would otherwise disagree about the open size —
// the card is sized from the same numbers so it never reflows mid-expansion.
//
// 15, not the 999 a pill is normally written as. The browser clamps a radius to
// half the shorter side, so both draw the same pill at 30px tall — but animated
// from 999 the number stays above the clamp for most of the expansion, which
// means the *drawn* radius tracks half the growing height instead: it climbs to
// ~40 as the box opens and then snaps back down to 30 at the end. Corners that
// get rounder than they finish and then pop is what read as unsmooth. Between
// the two radii actually drawn, 15 → 30 rises once and stops.
const ISLAND_REST = { borderRadius: 15, height: 30, width: 112 };
const ISLAND_OPEN = { borderRadius: 30, height: 96, width: 200 };

/**
 * The phone's Dynamic Island. Hardware, not app UI, so it belongs to the frame
 * and appears on every screen. Nothing has to coordinate with the payment
 * island: that one shares this origin, is larger on both axes, and paints above
 * the status bar, so it covers this exactly rather than sitting beside it — and
 * while it is up it also swallows the pointer, so this cannot expand out from
 * under it.
 *
 * Hover-only, and so decoration only: it lives inside an aria-hidden bar, and a
 * focusable easter egg in there would be reachable by tab while invisible to a
 * screen reader. Nothing here is load-bearing, so there is nothing to miss.
 */
function DynamicIsland() {
  const [open, setOpen] = useState(false);
  // MotionConfig's reducedMotion="user" drops transforms and layout animations
  // but not an explicit width/height, which is what this animates.
  const reduced = useReducedMotion();
  return (
    <motion.div
      animate={open ? ISLAND_OPEN : ISLAND_REST}
      className="dynamic-island"
      initial={false}
      onHoverEnd={() => setOpen(false)}
      onHoverStart={() => setOpen(true)}
      transition={reduced ? { duration: 0 } : open ? ISLAND_IN : ISLAND_OUT}
    >
      <AnimatePresence>
        {open && (
          <motion.span
            animate={{ opacity: 1, transition: ISLAND_CARD_IN }}
            className="dynamic-island-card"
            exit={{ opacity: 0, transition: ISLAND_CARD_OUT }}
            initial={{ opacity: 0 }}
            style={{ height: ISLAND_OPEN.height, width: ISLAND_OPEN.width }}
          >
            {/* currentColor, so the card's white is the mark's white. */}
            <OmsimosMark size={32} />
            <span className="dynamic-island-domain">omsimos.com</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function StatusBar() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(`${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const timer = setInterval(update, 10_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="status-bar" aria-hidden="true">
      <DynamicIsland />
      <span className="status-left">
        {time ?? "9:41"}
        <BellSlashIcon weight="fill" />
      </span>
      <div className="status-icons">
        <span className="signal" />
        <svg className="status-wifi" fill="none" viewBox="0 0 16 12">
          <path
            d="M1.5 4.2a10 10 0 0 1 13 0M3.8 6.8a6.6 6.6 0 0 1 8.4 0M6.1 9.3a3.2 3.2 0 0 1 3.8 0"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <circle cx="8" cy="11" fill="currentColor" r="1.1" />
        </svg>
        <span className="battery-pill">72</span>
      </div>
    </div>
  );
}

// Two shells, one bar. The launcher is the eGovPH app itself and carries its
// nav (Scan, Digital ID, History, Account); everything under Business carries
// the product's own (News, QR, Wallet, Me). `active` already told them apart at
// every call site, so it selects the item set too rather than a second prop.
const NAV_ITEMS = {
  home: [
    { Icon: ScanIcon, label: "Scan" },
    { Icon: FileTextIcon, label: "History" },
    { Icon: SquaresFourIcon, label: "Account" },
  ],
  business: [
    { Icon: NewspaperIcon, label: "News" },
    { Icon: WalletIcon, label: "Wallet" },
    { Icon: UserIcon, label: "Me" },
  ],
} as const;

export function BottomNav({ active = "home" }: { active?: "home" | "business" }) {
  // Only Home ever lights up — there is no dedicated Business tab, and the
  // other four items are a placeholder nav shell with nothing behind them
  // yet, so a <button> that does nothing reads as broken and makes screen
  // readers announce five dead controls (mirrors HomeScreen's service tiles).
  const [first, ...rest] = NAV_ITEMS[active];
  const Orb = active === "home" ? IdentificationCardIcon : QrCodeIcon;
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <div aria-current="page" className="active" data-cuelume-toggle="tick">
        <HouseIcon weight="fill" />
        <span>Home</span>
      </div>
      <div className="unbuilt" data-cuelume-toggle="tick">
        <first.Icon />
        <span>{first.label}</span>
      </div>
      {/* Decoration: nothing behind it, so no name worth announcing and no click
          sound — a sound would claim something happened. */}
      <div aria-hidden="true">
        <span className="qr-orb">
          <Orb weight="fill" />
        </span>
      </div>
      {rest.map(({ Icon, label }) => (
        <div className="unbuilt" data-cuelume-toggle="tick" key={label}>
          <Icon />
          <span>{label}</span>
        </div>
      ))}
    </nav>
  );
}
