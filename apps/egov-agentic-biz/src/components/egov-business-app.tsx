"use client";

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
  Trash,
  UserCircle,
} from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BusinessChatScreen } from "@/components/business-chat-screen";
import { LoginScreen } from "@/components/login-screen";
import { ProfileAvatar } from "@/components/profile-avatar";
import type {
  BusinessConversation,
  ConversationSummary,
  PaymentServiceType,
} from "@/lib/business-chat";
import type { CitizenProfile, RegisteredBusiness } from "@/lib/citizen-profile";
import { useApi } from "@/lib/use-api";
import { useAuthSession } from "@/lib/use-auth-session";

type Screen = "restoring" | "home" | "business" | "chat";

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
  return (
    <div className={`egov-logo ${compact ? "compact" : ""}`} aria-label="eGovPH">
      <span>eG</span>
      <span className="logo-sun">O</span>
      <span>V</span>
      <small>PH</small>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <div className="status-icons">
        <span className="signal" />
        <span className="wifi">◒</span>
        <span className="battery" />
      </div>
    </div>
  );
}

function BottomNav({ active = "home" }: { active?: "home" | "business" }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button className={active === "home" ? "active" : ""}>
        <House weight={active === "home" ? "fill" : "regular"} />
        <span>Home</span>
      </button>
      <button>
        <Newspaper />
        <span>News</span>
      </button>
      <button className="id-button" aria-label="Digital ID">
        <IdentificationCard weight="duotone" />
      </button>
      <button>
        <Receipt />
        <i>5</i>
        <span>History</span>
      </button>
      <button>
        <UserCircle />
        <span>Account</span>
      </button>
    </nav>
  );
}

function Header({
  title,
  onBack,
  profile,
}: {
  title?: string;
  onBack?: () => void;
  profile?: CitizenProfile | null;
}) {
  return (
    <header className="app-header">
      {onBack ? (
        <button className="icon-button" onClick={onBack} aria-label="Go back">
          <ArrowLeft />
        </button>
      ) : (
        <EGovLogo compact />
      )}
      {title ? <h1>{title}</h1> : <span />}
      {profile ? (
        <ProfileAvatar className="header-avatar" profile={profile} />
      ) : (
        <button className="notification-button" aria-label="Notifications">
          <BellSimple weight="fill" />
          <i />
        </button>
      )}
    </header>
  );
}

function HomeScreen({
  profile,
  onBusiness,
  onLogout,
}: {
  profile: CitizenProfile;
  onBusiness: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="screen home-screen">
      <StatusBar />
      <div className="home-scroll" id="app-content">
        <Header />
        <section className="profile-hero">
          <div className="profile-copy">
            <ProfileAvatar profile={profile} />
            <div>
              <strong>Hi, {profile.firstName}</strong>
              <span>{profile.mobile || profile.email}</span>
              <button className="profile-signout" onClick={onLogout}>
                Sign out
              </button>
            </div>
          </div>
          <div className="sun-card" aria-hidden="true">
            <span className="sun-rays">✦</span>
            <div className="sun-hill" />
            <div className="sun-wave" />
          </div>
        </section>
        <section className="service-grid" aria-label="eGovPH services">
          {serviceItems.map(({ label, icon: Icon, badge, business }) => (
            <button
              key={label}
              className={business ? "business-service" : ""}
              onClick={business ? onBusiness : undefined}
            >
              <span className="service-icon">
                <Icon weight="duotone" />
                {badge && <i>{badge}</i>}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </section>
        <button className="business-banner" onClick={onBusiness}>
          <span className="banner-mark">
            <Storefront weight="duotone" />
          </span>
          <span>
            <small>NEW IN eGovPH</small>
            <strong>Start and grow your business</strong>
            <em>One guided path across government services</em>
          </span>
          <ArrowRight />
        </button>
        <section className="featured-section">
          <div className="section-heading">
            <div>
              <small>CONNECTED SERVICES</small>
              <h2>Featured for you</h2>
            </div>
            <button>See all</button>
          </div>
          <div className="feature-cards">
            <article>
              <span>National documents</span>
              <strong>National Government Services</strong>
              <div className="building-illustration">
                <Buildings weight="duotone" />
              </div>
            </article>
            <article>
              <span>Near your address</span>
              <strong>
                {profile.city ? `${profile.city} Services` : "Local Government Services"}
              </strong>
              <div className="building-illustration">
                <MapPin weight="duotone" />
              </div>
            </article>
          </div>
        </section>
      </div>
      <BottomNav />
    </div>
  );
}

function BusinessLanding({
  profile,
  businesses,
  businessesLoading,
  conversations,
  initialPrompt,
  onBack,
  onSubmit,
  onResume,
  onDelete,
}: {
  profile: CitizenProfile | null;
  businesses: RegisteredBusiness[] | null;
  businessesLoading: boolean;
  conversations: ConversationSummary[];
  initialPrompt: string;
  onBack: () => void;
  onSubmit: (prompt: string) => void;
  onResume: (id: string) => void;
  onDelete: (conversation: ConversationSummary) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (prompt.trim()) onSubmit(prompt.trim());
  };
  return (
    <div className="screen business-screen">
      <StatusBar />
      <Header title="Business" onBack={onBack} profile={profile} />
      <div className="business-scroll" id="app-content">
        <section className="business-intro">
          <div className="assistant-orbit">
            <Sparkle weight="fill" />
            <i />
            <i />
          </div>
          <span className="secure-label">
            <ShieldCheck weight="fill" /> eGovPH
          </span>
          <h2>Start a registration plan</h2>
          <p>
            Describe your business once. We’ll map the full route and gather important details
            together.
          </p>
        </section>
        <form className="prompt-box" onSubmit={submit}>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Describe your business idea…"
            rows={3}
            aria-label="Describe your business idea"
          />
          <div>
            <button type="submit" disabled={!prompt.trim()} aria-label="Continue">
              <ArrowRight weight="bold" />
            </button>
          </div>
        </form>
        {conversations.length > 0 && (
          <section className="saved-plans">
            <div className="section-heading">
              <div>
                <small>SAVED SESSIONS</small>
                <h2>Registration plans</h2>
              </div>
            </div>
            <div>
              {conversations.map((conversation) => (
                <div className="saved-plan-row" key={conversation.id}>
                  <button className="saved-plan-open" onClick={() => onResume(conversation.id)}>
                    <span>
                      <strong>{conversation.title}</strong>
                      <small>Updated {new Date(conversation.updatedAt).toLocaleDateString()}</small>
                    </span>
                    <ArrowRight />
                  </button>
                  <button
                    className="saved-plan-delete"
                    onClick={() => onDelete(conversation)}
                    aria-label={`Delete ${conversation.title}`}
                  >
                    <Trash />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="suggestions-section">
          <h3>Try asking</h3>
          <div className="suggestion-list">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => {
                  setPrompt(suggestion);
                  inputRef.current?.focus();
                }}
              >
                <span>
                  {index === 0 ? <Coffee /> : index === 1 ? <Laptop /> : <ShoppingBagOpen />}
                </span>
                {suggestion}
                <ArrowRight />
              </button>
            ))}
          </div>
        </section>
        <section className="linked-businesses">
          <div className="section-heading">
            <div>
              <small>LINKED TO YOUR TIN</small>
              <h2>Your businesses</h2>
            </div>
            <button aria-label="Show business options">
              <DotsThree />
            </button>
          </div>
          {businessesLoading ? (
            <div className="business-record skeleton-card" />
          ) : (
            businesses?.map((business) => (
              <article className="business-record" key={business.id}>
                <span className="record-icon">
                  <Briefcase weight="duotone" />
                </span>
                <div>
                  <strong>{business.name}</strong>
                  <span>{business.type}</span>
                  <small>{business.registrationNumber}</small>
                </div>
                <i>{business.status}</i>
              </article>
            ))
          )}
          <p>
            <ShieldCheck weight="fill" /> Matched to your eGovPH account.
          </p>
        </section>
      </div>
      <BottomNav active="business" />
    </div>
  );
}

export function EgaphBusinessApp({
  initialConversation = null,
  requestedChatId = null,
}: {
  initialConversation?: BusinessConversation | null;
  requestedChatId?: string | null;
}) {
  const [screen, setScreen] = useState<Screen>(
    initialConversation ? "chat" : requestedChatId ? "restoring" : "home",
  );
  const [prompt, setPrompt] = useState(initialConversation?.initialPrompt ?? "");
  const [conversation, setConversation] = useState<BusinessConversation | null>(
    initialConversation,
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentService, setPaymentService] = useState<PaymentServiceType | null>(null);
  const { error: authError, logout, profile, status } = useAuthSession();
  const { data: businesses, loading: businessesLoading } = useApi<RegisteredBusiness[]>(
    "/api/businesses",
    status === "authenticated",
  );
  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/conversations");
    if (response.ok)
      setConversations(
        ((await response.json()) as { conversations: ConversationSummary[] }).conversations,
      );
  }, []);
  const openConversation = useCallback(
    async (id: string, status?: string | null, serviceType?: PaymentServiceType | null) => {
      const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
      if (!response.ok) return;
      const current = ((await response.json()) as { conversation: BusinessConversation })
        .conversation;
      setConversation(current);
      setPrompt(current.initialPrompt);
      setPaymentStatus(status ?? null);
      setPaymentService(serviceType ?? null);
      setScreen("chat");
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("chat", current.id);
      window.history.replaceState({}, "", url);
      await refreshConversations();
    },
    [refreshConversations],
  );
  useEffect(() => {
    void (async () => {
      await refreshConversations();
      const url = new URL(window.location.href);
      const id = url.searchParams.get("chat");
      if (!id) {
        setScreen("home");
        return;
      }
      const paymentReturn = url.searchParams.get("payment") === "return";
      if (initialConversation?.id === id && !paymentReturn) return;
      let status: string | null = null;
      let serviceType: PaymentServiceType | null = null;
      const transactionId = url.searchParams.get("transactionId");
      if (paymentReturn && transactionId) {
        const paymentResponse = await fetch(
          `/api/payments/egovpay/status?transactionId=${encodeURIComponent(transactionId)}`,
        );
        if (paymentResponse.ok) {
          const payment = (
            (await paymentResponse.json()) as {
              payment?: { status?: string; serviceType?: PaymentServiceType };
            }
          ).payment;
          status = payment?.status ?? "pending";
          serviceType = payment?.serviceType ?? null;
        }
      }
      await openConversation(id, status, serviceType);
      setScreen((current) => (current === "restoring" ? "business" : current));
    })();
  }, [initialConversation?.id, openConversation, refreshConversations]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  const startChat = async (value: string) => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initialPrompt: value }),
    });
    if (!response.ok) return;
    const created = ((await response.json()) as { conversation: BusinessConversation })
      .conversation;
    setConversation(created);
    setPrompt(value);
    setPaymentStatus(null);
    setPaymentService(null);
    setPaymentService(null);
    setScreen("chat");
    window.history.pushState({}, "", `?chat=${encodeURIComponent(created.id)}`);
    await refreshConversations();
  };
  const leaveChat = () => {
    setScreen("business");
    setConversation(null);
    setPaymentStatus(null);
    window.history.pushState({}, "", window.location.pathname);
    void refreshConversations();
  };
  const deleteSession = async (item: ConversationSummary) => {
    if (
      !window.confirm(
        `Delete “${item.title}”? This will permanently remove its messages and payment history.`,
      )
    )
      return;
    const response = await fetch(`/api/conversations/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setConversations((current) => current.filter(({ id }) => id !== item.id));
    if (conversation?.id === item.id) leaveChat();
  };
  const signOut = async () => {
    await logout();
    window.location.assign("/");
  };
  return (
    <div className="prototype-stage">
      <div className="context-panel" aria-hidden="true">
        <EGovLogo />
        <p>Business</p>
        <h2>
          Start your business,
          <br />
          step by step.
        </h2>
        <span>One clear path through government services.</span>
        <div className="context-foot">
          <i />
          <span>Live eGov SSO</span>
        </div>
      </div>
      <div className="phone-shell">
        {status === "loading" ? (
          <div className="screen auth-loading">
            <div className="auth-loading-mark">
              <ShieldCheck weight="duotone" />
            </div>
            <p>Restoring your secure session…</p>
          </div>
        ) : !profile ? (
          <LoginScreen initialError={authError} />
        ) : (
          <>
            {screen === "restoring" && (
              <div className="screen restoring-chat-screen">
                <StatusBar />
                <div className="loading-agent" role="status">
                  <div className="assistant-orbit">
                    <Sparkle weight="fill" />
                    <i />
                    <i />
                  </div>
                  <h1>Opening your saved plan</h1>
                  <p>Restoring the conversation…</p>
                  <div className="loading-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            {screen === "home" && (
              <HomeScreen
                profile={profile}
                onBusiness={() => setScreen("business")}
                onLogout={() => void signOut()}
              />
            )}
            {screen === "business" && (
              <BusinessLanding
                profile={profile}
                businesses={businesses}
                businessesLoading={businessesLoading}
                conversations={conversations}
                initialPrompt={prompt}
                onBack={() => setScreen("home")}
                onSubmit={startChat}
                onResume={(id) => void openConversation(id)}
                onDelete={(item) => void deleteSession(item)}
              />
            )}
            {screen === "chat" && conversation && (
              <BusinessChatScreen
                key={conversation.id}
                conversation={conversation}
                conversations={conversations}
                profile={profile}
                paymentStatus={paymentStatus}
                paymentService={paymentService}
                onBack={leaveChat}
                onNewConversation={leaveChat}
                onSelectConversation={(id) => void openConversation(id)}
                onDeleteConversation={(item) => void deleteSession(item)}
              />
            )}
          </>
        )}
      </div>
      <div id="egov-sso-widget-portal" />
    </div>
  );
}
