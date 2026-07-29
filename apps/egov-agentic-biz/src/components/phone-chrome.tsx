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
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

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
      {/* The phone's Dynamic Island. Hardware, not app UI, so it belongs to the
          frame and appears on every screen. Nothing has to coordinate with the
          payment island: that one shares this origin and is larger on both
          axes, so it covers this exactly rather than sitting beside it. */}
      <span className="dynamic-island" />
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
