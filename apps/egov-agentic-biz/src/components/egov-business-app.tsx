"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BellSimple,
  Briefcase,
  Buildings,
  Coffee,
  DotsThree,
  FirstAid,
  House,
  IdentificationCard,
  Laptop,
  MapPin,
  MegaphoneSimple,
  Newspaper,
  Receipt,
  ShieldCheck,
  ShoppingBagOpen,
  Sparkle,
  Storefront,
  SuitcaseRolling,
  UserCircle,
} from "@phosphor-icons/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { BusinessChatScreen } from "@/components/business-chat-screen";
import type { CitizenProfile, RegisteredBusiness } from "@/lib/mock-data";
import { useMockApi } from "@/lib/use-mock-api";

type Screen = "home" | "business" | "chat";

const suggestions = [
  "I want to start a coffee subscription business in Makati",
  "I’m a freelancer and want to register with BIR",
  "Help me open a small online shop",
];

const serviceItems = [
  { label: "NGAs", icon: Buildings },
  { label: "LGUs", icon: Buildings },
  { label: "Jobs", icon: Briefcase, badge: "New" },
  { label: "Business", icon: Storefront, badge: "New", business: true },
  { label: "Travel", icon: SuitcaseRolling },
  { label: "Health", icon: FirstAid },
  { label: "Report", icon: MegaphoneSimple },
  { label: "More", icon: DotsThree },
];

function EGovLogo({ compact = false }: { compact?: boolean }) {
  return <div className={`egov-logo ${compact ? "compact" : ""}`} aria-label="eGovPH"><span>eG</span><span className="logo-sun">O</span><span>V</span><small>PH</small></div>;
}

function StatusBar() {
  return <div className="status-bar" aria-hidden="true"><span>9:41</span><div className="status-icons"><span className="signal" /><span className="wifi">◒</span><span className="battery" /></div></div>;
}

function BottomNav({ active = "home" }: { active?: "home" | "business" }) {
  return <nav className="bottom-nav" aria-label="Primary navigation"><button className={active === "home" ? "active" : ""}><House weight={active === "home" ? "fill" : "regular"} /><span>Home</span></button><button><Newspaper /><span>News</span></button><button className="id-button" aria-label="Digital ID"><IdentificationCard weight="duotone" /></button><button><Receipt /><i>5</i><span>History</span></button><button><UserCircle /><span>Account</span></button></nav>;
}

function Header({ title, onBack, profile }: { title?: string; onBack?: () => void; profile?: CitizenProfile | null }) {
  return <header className="app-header">{onBack ? <button className="icon-button" onClick={onBack} aria-label="Go back"><ArrowLeft /></button> : <EGovLogo compact />}{title ? <h1>{title}</h1> : <span />}{profile ? <Image className="header-avatar" src={profile.avatarUrl} width={36} height={36} alt={`${profile.fullName} profile`} /> : <button className="notification-button" aria-label="Notifications"><BellSimple weight="fill" /><i /></button>}</header>;
}

function HomeScreen({ profile, onBusiness }: { profile: CitizenProfile | null; onBusiness: () => void }) {
  return <div className="screen home-screen"><StatusBar /><div className="home-scroll" id="app-content"><Header /><section className="profile-hero"><div className="profile-copy">{profile ? <Image src={profile.avatarUrl} width={56} height={56} alt="" /> : <div className="avatar-skeleton" />}<div><strong>Hi, {profile?.firstName ?? "there"}</strong><span>{profile?.mobile ?? "Loading…"}</span></div></div><div className="sun-card" aria-hidden="true"><span className="sun-rays">✦</span><div className="sun-hill" /><div className="sun-wave" /></div></section><section className="service-grid" aria-label="eGovPH services">{serviceItems.map(({ label, icon: Icon, badge, business }) => <button key={label} className={business ? "business-service" : ""} onClick={business ? onBusiness : undefined}><span className="service-icon"><Icon weight="duotone" />{badge && <i>{badge}</i>}</span><span>{label}</span></button>)}</section><button className="business-banner" onClick={onBusiness}><span className="banner-mark"><Storefront weight="duotone" /></span><span><small>NEW IN eGovPH</small><strong>Start and grow your business</strong><em>One guided path across government services</em></span><ArrowRight /></button><section className="featured-section"><div className="section-heading"><div><small>CONNECTED SERVICES</small><h2>Featured for you</h2></div><button>See all</button></div><div className="feature-cards"><article><span>National documents</span><strong>National Government Services</strong><div className="building-illustration"><Buildings weight="duotone" /></div></article><article><span>Near your address</span><strong>Makati City Services</strong><div className="building-illustration"><MapPin weight="duotone" /></div></article></div></section></div><BottomNav /></div>;
}

function BusinessLanding({ profile, businesses, businessesLoading, initialPrompt, onBack, onSubmit }: { profile: CitizenProfile | null; businesses: RegisteredBusiness[] | null; businessesLoading: boolean; initialPrompt: string; onBack: () => void; onSubmit: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submit = (event: FormEvent) => { event.preventDefault(); if (prompt.trim()) onSubmit(prompt.trim()); };
  return <div className="screen business-screen"><StatusBar /><Header title="Business" onBack={onBack} profile={profile} /><div className="business-scroll" id="app-content"><section className="business-intro"><div className="assistant-orbit"><Sparkle weight="fill" /><i /><i /></div><span className="secure-label"><ShieldCheck weight="fill" /> eGovPH</span><h2>Describe your business</h2><p>Tell us what you want to sell or do.</p></section><form className="prompt-box" onSubmit={submit}><textarea ref={inputRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe your business idea…" rows={3} aria-label="Describe your business idea" /><div><span><ShieldCheck weight="fill" /> Your details stay private</span><button type="submit" disabled={!prompt.trim()} aria-label="Continue"><ArrowRight weight="bold" /></button></div></form><section className="suggestions-section"><h3>Try asking</h3><div className="suggestion-list">{suggestions.map((suggestion, index) => <button key={suggestion} onClick={() => { setPrompt(suggestion); inputRef.current?.focus(); }}><span>{index === 0 ? <Coffee /> : index === 1 ? <Laptop /> : <ShoppingBagOpen />}</span>{suggestion}<ArrowRight /></button>)}</div></section><section className="linked-businesses"><div className="section-heading"><div><small>LINKED TO YOUR TIN</small><h2>Your businesses</h2></div><button aria-label="Show business options"><DotsThree /></button></div>{businessesLoading ? <div className="business-record skeleton-card" /> : businesses?.map((business) => <article className="business-record" key={business.id}><span className="record-icon"><Briefcase weight="duotone" /></span><div><strong>{business.name}</strong><span>{business.type}</span><small>{business.registrationNumber}</small></div><i>{business.status}</i></article>)}<p><ShieldCheck weight="fill" /> Matched to your eGovPH account.</p></section></div><BottomNav active="business" /></div>;
}

export function EgaphBusinessApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [prompt, setPrompt] = useState("");
  const { data: profile } = useMockApi<CitizenProfile>("/api/profile");
  const { data: businesses, loading: businessesLoading } = useMockApi<RegisteredBusiness[]>("/api/businesses");
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  const startChat = (value: string) => { setPrompt(value); setScreen("chat"); };
  return <div className="prototype-stage"><div className="context-panel" aria-hidden="true"><EGovLogo /><p>Business</p><h2>Start your business,<br />step by step.</h2><span>One clear path through government services.</span><div className="context-foot"><i /><span>Demo</span></div></div><div className="phone-shell">{screen === "home" && <HomeScreen profile={profile} onBusiness={() => setScreen("business")} />}{screen === "business" && <BusinessLanding profile={profile} businesses={businesses} businessesLoading={businessesLoading} initialPrompt={prompt} onBack={() => setScreen("home")} onSubmit={startChat} />}{screen === "chat" && <BusinessChatScreen initialPrompt={prompt} profile={profile} onBack={() => setScreen("business")} />}</div></div>;
}
