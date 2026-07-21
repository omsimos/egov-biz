"use client";

import {
  ArrowRight,
  CloudWarning,
  IdentificationCard,
  MagnifyingGlass,
  SealCheck,
  Storefront,
  Sun,
  Wallet,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { EGovLogo } from "@/components/egov-logo";
import { BottomNav, StatusBar } from "@/components/phone-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import type { CitizenProfile } from "@/lib/citizen-profile";

const AMBER = "#f6a723";

function NgaIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 44 44">
      <rect
        height="25"
        rx="2"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="3"
        width="20"
        x="12"
        y="11"
      />
      <path d="M9.5 11h25" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <rect fill={AMBER} height="4.4" rx="1.2" width="4.4" x="16.4" y="15.8" />
      <rect fill={AMBER} height="4.4" rx="1.2" width="4.4" x="23.2" y="15.8" />
      <rect fill={AMBER} height="4.4" rx="1.2" width="4.4" x="16.4" y="22.4" />
      <rect fill={AMBER} height="4.4" rx="1.2" width="4.4" x="23.2" y="22.4" />
      <path d="M19.6 36v-4.6a2.4 2.4 0 0 1 4.8 0V36" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function LguIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 44 44">
      <path d="M22 6.5 35 14.5H9z" stroke="currentColor" strokeLinejoin="round" strokeWidth="3" />
      <circle cx="22" cy="11.7" fill={AMBER} r="1.5" />
      <path
        d="M13.5 19v11M22 19v11M30.5 19v11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path d="M11 15h22" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
      <path d="M9 34.5h26" stroke={AMBER} strokeLinecap="round" strokeWidth="3.4" />
    </svg>
  );
}

function TravelIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 44 44">
      <path
        d="M22 4.5c1.8 0 3 3.2 3 6.5v4.6l11 6.6v3.6l-11-3.1v6.2l4 3v2.9l-7-2-7 2v-2.9l4-3v-6.2l-11 3.1v-3.6l11-6.6V11c0-3.3 1.2-6.5 3-6.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
        transform="rotate(38 22 22)"
      />
      <path
        d="M6.5 32.5c5 3.6 12 4.4 18.5 2.4"
        stroke={AMBER}
        strokeDasharray="0.5 5.5"
        strokeLinecap="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 44 44">
      <path
        d="M22 36.5C13.5 30.2 7.5 24.6 7.5 17.8c0-4.8 3.7-8.3 8.4-8.3 2.5 0 4.9 1.2 6.1 3.2 1.2-2 3.6-3.2 6.1-3.2 4.7 0 8.4 3.5 8.4 8.3 0 6.8-6 12.4-14.5 18.7z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M13 21.5h4.4l2.6-4.4 4.3 8.2 2.6-3.8H31"
        stroke={AMBER}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 44 44">
      <path
        d="M16 6.5h12l8.5 8.5v13L28 36.5H16L7.5 28V15z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path d="M22 13.5V24" stroke={AMBER} strokeLinecap="round" strokeWidth="3.2" />
      <circle cx="22" cy="29.3" fill={AMBER} r="2.1" />
    </svg>
  );
}

const services = [
  { icon: <NgaIcon />, label: "NGAs" },
  { icon: <LguIcon />, label: "LGUs" },
  { icon: <TravelIcon />, label: "Travel" },
  { icon: <HealthIcon />, label: "Health" },
  { badge: "New", icon: <ReportIcon />, label: "Report" },
];

function Mascot() {
  return (
    <svg aria-hidden="true" className="egovai-mascot" viewBox="0 0 64 72">
      <rect fill="#5fc887" height="10" rx="3" width="10" x="3" y="13" />
      <path
        d="M6.4 17.2l1.6 1.8 3-3.4"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="42" fill="#ffd23e" r="4" />
      <path
        d="M18 23c0-9 6-14.5 14-14.5S46 14 46 23l-.8 3.6C43 20.8 40 18.6 32 18.6s-11 2.2-13.2 8z"
        fill="#23262e"
      />
      <circle cx="32" cy="27" fill="#f7c092" r="11.2" />
      <path
        d="M21.4 23.2c1-5.8 4.8-8.8 10.6-8.8s9.6 3 10.6 8.8c-2.9-2.9-5.8-3.9-10.6-3.9s-7.7 1-10.6 3.9z"
        fill="#23262e"
      />
      <circle cx="27.6" cy="27" fill="#232323" r="1.6" />
      <circle cx="36.4" cy="27" fill="#232323" r="1.6" />
      <path
        d="M28.6 31.6c2 1.9 4.8 1.9 6.8 0"
        fill="none"
        stroke="#b26b45"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path d="M17.5 63c0-11.6 5.8-18.6 14.5-18.6S46.5 51.4 46.5 63z" fill="#f4f6f8" />
      <path d="M32 45v10.5" stroke="#d7dde3" strokeWidth="1.6" />
      <path d="M28 45l4 4.6 4-4.6" fill="none" stroke="#c3ccd4" strokeWidth="1.6" />
      <path
        d="M40 51.5c2.4 1.8 4.4 2 6 1"
        fill="none"
        stroke="#f7c092"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <rect fill="#1553e0" height="19" rx="3.5" width="11.5" x="45" y="44" />
      <rect fill="#fff" height="11.5" rx="1.5" width="7.5" x="47" y="47" />
      <circle cx="50.75" cy="60.5" fill="#fff" r="1" />
    </svg>
  );
}

function HeroCarousel({ onBusiness }: { onBusiness: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  const [index, setIndex] = useState(0);
  const count = 5;

  // Keep in sync with the `.hero-track` gap in globals.css.
  const stride = () => {
    const first = trackRef.current?.firstElementChild;
    return first instanceof HTMLElement ? first.offsetWidth + 20 : 1;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track || Date.now() < pausedUntil.current) return;
      const next = (Math.round(track.scrollLeft / stride()) + 1) % count;
      track.scrollTo({ behavior: "smooth", left: next * stride() });
    }, 4_500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section aria-label="Featured government services" className="hero-carousel">
      <div
        className="hero-track"
        onPointerDown={() => {
          pausedUntil.current = Date.now() + 9_000;
        }}
        onScroll={() => {
          const track = trackRef.current;
          if (track) setIndex(Math.min(count - 1, Math.round(track.scrollLeft / stride())));
        }}
        ref={trackRef}
      >
        <article className="hero-slide slide-etravel">
          <div className="etravel-copy">
            <span className="etravel-wordmark">
              eTr
              <svg aria-hidden="true" className="etravel-plane" viewBox="0 0 44 44">
                <path
                  d="M22 4.5c1.8 0 3 3.2 3 6.5v4.6l11 6.6v3.6l-11-3.1v6.2l4 3v2.9l-7-2-7 2v-2.9l4-3v-6.2l-11 3.1v-3.6l11-6.6V11c0-3.3 1.2-6.5 3-6.5z"
                  fill="#ffd233"
                  transform="rotate(48 22 22)"
                />
              </svg>
              vel
            </span>
            <strong>
              Philippine Travel
              <br />
              Information System
            </strong>
          </div>
          <svg aria-hidden="true" className="etravel-art" fill="none" viewBox="0 0 120 90">
            <path
              d="M8 72c26 8 44-10 32-22-9-9-24 2-14 12 12 12 44 6 56-16"
              stroke="rgba(255,255,255,0.5)"
              strokeDasharray="1 7"
              strokeLinecap="round"
              strokeWidth="2.2"
            />
            <g transform="translate(78 2) scale(0.62)">
              <path
                d="M22 4.5c1.8 0 3 3.2 3 6.5v4.6l11 6.6v3.6l-11-3.1v6.2l4 3v2.9l-7-2-7 2v-2.9l4-3v-6.2l-11 3.1v-3.6l11-6.6V11c0-3.3 1.2-6.5 3-6.5z"
                fill="#ffd233"
                transform="rotate(52 22 22)"
              />
            </g>
            <circle cx="16" cy="22" fill="rgba(255,255,255,0.35)" r="2" />
            <circle cx="104" cy="66" fill="rgba(255,255,255,0.3)" r="2.5" />
          </svg>
        </article>
        <button className="hero-slide slide-business" onClick={onBusiness} type="button">
          <span className="slide-kicker">New · Business one-stop</span>
          <strong>Start &amp; register your business</strong>
          <em>DTI, BIR &amp; LGU permits in one guided flow</em>
          <span className="slide-cta">
            Get started <ArrowRight weight="bold" />
          </span>
          <Storefront className="slide-glyph" weight="duotone" />
        </button>
        <article className="hero-slide slide-egovpay">
          <span className="slide-kicker">eGovPay</span>
          <strong>Pay permits, taxes &amp; fees securely</strong>
          <em>GCash, Maya, cards &amp; over-the-counter</em>
          <Wallet className="slide-glyph" weight="duotone" />
        </article>
        <article className="hero-slide slide-natid">
          <span className="slide-kicker">PhilSys</span>
          <strong>Your National ID, now digital</strong>
          <em>Download and present your Digital National ID</em>
          <IdentificationCard className="slide-glyph" weight="duotone" />
        </article>
        <article className="hero-slide slide-everify">
          <span className="slide-kicker">eVerify</span>
          <strong>Check documents instantly</strong>
          <em>Scan QR codes on government-issued papers</em>
          <SealCheck className="slide-glyph" weight="duotone" />
        </article>
      </div>
      <div aria-hidden="true" className="hero-dots">
        {Array.from({ length: count }, (_, dot) => (
          <i className={dot === index ? "active" : ""} key={dot} />
        ))}
      </div>
    </section>
  );
}

function formatToday() {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} - ${month} ${now.getDate()}, ${now.getFullYear()}`;
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
  const [query, setQuery] = useState("");
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(formatToday()), []);

  return (
    <div className="screen home-screen">
      <StatusBar />
      <div className="home-scroll" id="app-content">
        <header className="home-header">
          <EGovLogo size={25} />
          <div className="home-greeting">
            <strong>Mabuhay, {profile.firstName.toUpperCase()}</strong>
            <span>Welcome to eGovPH</span>
          </div>
          <button
            className="home-avatar"
            onClick={() => {
              if (window.confirm("Sign out of eGovPH?")) onLogout();
            }}
            title="Sign out"
            type="button"
          >
            <ProfileAvatar profile={profile} />
          </button>
        </header>

        <div className="date-pill">
          <Sun weight="regular" />
          <span suppressHydrationWarning>{today ?? formatToday()}</span>
        </div>

        <div className="home-search">
          <input
            aria-label="Search services"
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            value={query}
          />
          {query === "" && (
            <span aria-hidden="true" className="home-search-hint">
              Search Services like <b>National ID</b>
            </span>
          )}
          <MagnifyingGlass weight="bold" />
        </div>

        <nav aria-label="eGovPH services" className="home-services">
          {services.map(({ badge, icon, label }) => (
            <button key={label} type="button">
              <span className="service-bubble">
                {icon}
                {badge && <i>{badge}</i>}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <HeroCarousel onBusiness={onBusiness} />

        <section aria-label="Highlights" className="home-cards">
          <article className="weather-card">
            <CloudWarning weight="duotone" />
            <strong>-°C</strong>
            <span>Not available</span>
            <small>Enable Location</small>
          </article>
          <article className="mini-card etrabaho-card">
            <span className="mini-wordmark">
              <i>e</i>Trabaho
            </span>
            <span aria-hidden="true" className="mini-phone">
              <i />
              <i />
              <i />
              <i />
            </span>
          </article>
          <button className="mini-card egovai-card" onClick={onBusiness} type="button">
            <span className="mini-wordmark">
              <i>e</i>Gov AI
            </span>
            <Mascot />
          </button>
        </section>
      </div>
      <BottomNav active="home" />
    </div>
  );
}
