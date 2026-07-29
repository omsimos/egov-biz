"use client";

import {
  BellSlashIcon,
  HouseIcon,
  NewspaperIcon,
  QrCodeIcon,
  UserIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

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

export function BottomNav({ active = "home" }: { active?: "home" | "business" }) {
  // Only Home ever lights up — there is no dedicated Business tab, and the
  // other four items are a placeholder nav shell with nothing behind them
  // yet, so a <button> that does nothing reads as broken and makes screen
  // readers announce five dead controls (mirrors HomeScreen's service tiles).
  const homeActive = active === "home" || active === "business";
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <div
        aria-current={homeActive ? "page" : undefined}
        className={homeActive ? "active" : ""}
        data-cuelume-toggle="tick"
      >
        <HouseIcon weight={homeActive ? "fill" : "regular"} />
        <span>Home</span>
      </div>
      <div className="unbuilt" data-cuelume-toggle="tick">
        <NewspaperIcon />
        <span>News</span>
      </div>
      {/* Decoration: nothing behind it, so no name worth announcing and no click
          sound — a sound would claim something happened. */}
      <div aria-hidden="true">
        <span className="qr-orb">
          <QrCodeIcon weight="fill" />
        </span>
      </div>
      <div className="unbuilt" data-cuelume-toggle="tick">
        <WalletIcon />
        <span>Wallet</span>
      </div>
      <div className="unbuilt" data-cuelume-toggle="tick">
        <UserIcon />
        <span>Me</span>
      </div>
    </nav>
  );
}
