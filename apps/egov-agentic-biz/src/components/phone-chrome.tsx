"use client";

import {
  BellSlash,
  FileText,
  House,
  IdentificationCard,
  Scan,
  SquaresFour,
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
        <BellSlash weight="fill" />
      </span>
      <div className="status-icons">
        <span className="signal" />
        <svg className="status-wifi" fill="none" viewBox="0 0 16 12">
          <path
            d="M1.5 4.2a10 10 0 0 1 13 0M3.8 6.8a6.6 6.6 0 0 1 8.4 0M6.1 9.3a3.2 3.2 0 0 1 3.8 0"
            stroke="#111"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <circle cx="8" cy="11" fill="#111" r="1.1" />
        </svg>
        <span className="battery-pill">72</span>
      </div>
    </div>
  );
}

export function BottomNav({ active = "home" }: { active?: "home" | "none" }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button className={active === "home" ? "active" : ""} type="button">
        <House weight={active === "home" ? "fill" : "regular"} />
        <span>Home</span>
      </button>
      <button type="button">
        <Scan />
        <span>Scan</span>
      </button>
      <button aria-label="Digital ID" className="id-button" type="button">
        <span className="id-orb">
          <IdentificationCard weight="fill" />
        </span>
        <span>Digital ID</span>
      </button>
      <button type="button">
        <FileText />
        <span>History</span>
      </button>
      <button type="button">
        <SquaresFour />
        <span>Account</span>
      </button>
    </nav>
  );
}
