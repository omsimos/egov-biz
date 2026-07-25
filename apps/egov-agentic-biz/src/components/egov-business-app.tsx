"use client";

import {
  ArrowLeft,
  ArrowLeftIcon,
  ArrowRightIcon,
  BellSimple,
  Briefcase,
  BriefcaseIcon,
  CalendarDots,
  CaretRight,
  CheckCircle,
  CoffeeIcon,
  FileText,
  FolderOpen,
  LaptopIcon,
  ShieldCheck,
  ShieldCheckIcon,
  ShoppingBagOpenIcon,
  SparkleIcon,
  Storefront,
  TrashIcon,
} from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BusinessChatScreen } from "@/components/business-chat-screen";
import { EGovLogo } from "@/components/egov-logo";
import { HomeScreen } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import { BottomNav, StatusBar } from "@/components/phone-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Alert } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import type {
  BusinessConversation,
  ConversationSummary,
  PaymentServiceType,
} from "@/lib/business-chat";
import type { CitizenProfile, RegisteredBusiness } from "@/lib/citizen-profile";
import type { RegisteredBusiness as RegisteredBusinessDetail } from "@/lib/registered-business";
import { useApi } from "@/lib/use-api";
import { useAuthSession } from "@/lib/use-auth-session";
import { cn } from "@/lib/utils";

type Screen = "restoring" | "home" | "business" | "business-detail" | "chat";

const FOCUS_RING =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2";

const suggestions = [
  { icon: CoffeeIcon, text: "I want to start a coffee subscription business in Makati" },
  { icon: LaptopIcon, text: "I’m a freelancer and want to register with BIR" },
  { icon: ShoppingBagOpenIcon, text: "Help me open a small online shop" },
];

function formatBusinessDate(value: string) {
  return new Date(`${value.length === 10 ? `${value}T00:00:00Z` : value}`).toLocaleDateString(
    "en-PH",
    { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" },
  );
}

export function BusinessDetailScreen({
  business,
  loading,
  error,
  onBack,
  profile,
}: {
  business: RegisteredBusinessDetail | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  profile: CitizenProfile;
}) {
  const [tab, setTab] = useState<"overview" | "records" | "files" | "calendar">("overview");
  return (
    <div className="screen business-detail-screen">
      <StatusBar />
      <Header title="Business record" onBack={onBack} profile={profile} />
      <div className="business-detail-scroll" id="app-content">
        {loading ? (
          <div className="business-detail-loading skeleton-card" />
        ) : error || !business ? (
          <div className="business-detail-error">
            <Briefcase weight="duotone" />
            <strong>Business record unavailable</strong>
            <span>{error ?? "This linked record could not be found."}</span>
          </div>
        ) : (
          <>
            <section className="business-identity-card">
              <span>
                <Storefront weight="duotone" />
              </span>
              <div>
                <small>LINKED TO {business.tinMasked || "YOUR EGOV ACCOUNT"}</small>
                <h1>{business.name}</h1>
                <p>
                  {business.type} in {business.city}
                </p>
              </div>
              <i>
                <CheckCircle weight="fill" /> {business.status}
              </i>
            </section>
            <nav className="business-detail-tabs" aria-label="Business record sections">
              {(["overview", "records", "files", "calendar"] as const).map((item) => (
                <button
                  className={tab === item ? "active" : ""}
                  data-cuelume-toggle="toggle"
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                >
                  {item === "overview"
                    ? "Overview"
                    : item === "records"
                      ? "Records"
                      : item === "files"
                        ? "Files"
                        : "Tax calendar"}
                </button>
              ))}
            </nav>
            {tab === "overview" && (
              <div className="business-overview">
                <section>
                  <h2>Registration</h2>
                  <dl>
                    <div>
                      <dt>Registration number</dt>
                      <dd>{business.registrationNumber}</dd>
                    </div>
                    <div>
                      <dt>Owner</dt>
                      <dd>{business.ownerName}</dd>
                    </div>
                    <div>
                      <dt>RDO</dt>
                      <dd>{business.rdo || "Needs confirmation"}</dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{formatBusinessDate(business.finalizedAt)}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h2>Business address</h2>
                  <p>{business.businessAddress}</p>
                  <span>{business.businessActivity}</span>
                </section>
                <button
                  type="button"
                  className="next-tax-card"
                  data-cuelume-toggle="page"
                  onClick={() => setTab("calendar")}
                >
                  <CalendarDots weight="duotone" />
                  <div>
                    <small>NEXT TAX REMINDER</small>
                    <strong>{business.taxObligations[0]?.title ?? "No reminders scheduled"}</strong>
                    <span>
                      {business.taxObligations[0]
                        ? formatBusinessDate(business.taxObligations[0].dueDate)
                        : ""}
                    </span>
                  </div>
                  <CaretRight weight="bold" />
                </button>
                <p className="demo-record-note">
                  <ShieldCheck weight="fill" /> Demo records only. They are not official agency
                  documents.
                </p>
              </div>
            )}
            {tab === "files" && (
              <section className="business-files-list">
                <header>
                  <div>
                    <small>DOCUMENT VAULT</small>
                    <h2>Business files</h2>
                  </div>
                  <span>{business.files.length} files</span>
                </header>
                {business.files.length === 0 ? (
                  <div className="business-file-empty">
                    <FileText weight="duotone" />
                    <strong>No files saved yet</strong>
                    <p>Generated registration and tax setup files will appear here.</p>
                  </div>
                ) : (
                  business.files.map((file) => (
                    <article className="business-file-card" key={file.id}>
                      <span className="business-file-icon">
                        <FileText weight="duotone" />
                      </span>
                      <div>
                        <small>{file.documentType}</small>
                        <strong>{file.title}</strong>
                        <code>{file.filename}</code>
                        <p>{file.note}</p>
                        <time>{formatBusinessDate(file.createdAt)}</time>
                      </div>
                      <aside>
                        <i>{file.status}</i>
                        <a
                          href={`/api/businesses/${encodeURIComponent(business.id)}/files/${encodeURIComponent(file.id)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      </aside>
                    </article>
                  ))
                )}
              </section>
            )}
            {tab === "records" && (
              <section className="business-records-list">
                <header>
                  <h2>Registrations and permits</h2>
                  <span>{business.records.length} records</span>
                </header>
                {business.records.map((record) => (
                  <article key={record.id}>
                    <span>
                      <FileText weight="duotone" />
                    </span>
                    <div>
                      <strong>{record.title}</strong>
                      <p>{record.agency}</p>
                      <small>{record.referenceNumber}</small>
                      <em>{record.note}</em>
                    </div>
                    <i className={record.status === "Not required" ? "muted" : ""}>
                      {record.status}
                    </i>
                  </article>
                ))}
              </section>
            )}
            {tab === "calendar" && (
              <section className="tax-calendar-list">
                <header>
                  <div>
                    <small>TAX CALENDAR</small>
                    <h2>Upcoming obligations</h2>
                  </div>
                  <CalendarDots weight="duotone" />
                </header>
                <p>
                  Sample reminders generated from this demo registration. Confirm actual tax types
                  and deadlines with BIR.
                </p>
                {business.taxObligations.map((obligation) => {
                  const date = new Date(`${obligation.dueDate}T00:00:00Z`);
                  return (
                    <article key={obligation.id}>
                      <time dateTime={obligation.dueDate}>
                        <strong>
                          {date.toLocaleDateString("en-PH", { day: "2-digit", timeZone: "UTC" })}
                        </strong>
                        <span>
                          {date
                            .toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" })
                            .toUpperCase()}
                        </span>
                      </time>
                      <div>
                        <small>
                          {obligation.formCode} · {obligation.frequency}
                        </small>
                        <strong>{obligation.title}</strong>
                        <span>{obligation.periodLabel}</span>
                        <p>{obligation.note}</p>
                      </div>
                      <i>{obligation.status}</i>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
      <BottomNav active="none" />
    </div>
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
        <button
          className="icon-button"
          data-cuelume-toggle="page"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft />
        </button>
      ) : (
        <EGovLogo size={22} />
      )}
      {title ? <h1>{title}</h1> : <span />}
      {profile ? (
        <ProfileAvatar className="header-avatar" profile={profile} />
      ) : (
        <button
          className="notification-button"
          data-cuelume-toggle="tick"
          aria-label="Notifications"
        >
          <BellSimple weight="fill" />
          <i />
        </button>
      )}
    </header>
  );
}

export function BusinessLanding({
  profile,
  businesses,
  businessesLoading,
  conversations,
  initialPrompt,
  onBack,
  onSubmit,
  onResume,
  onDelete,
  onOpenBusiness,
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
  onOpenBusiness: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (prompt.trim()) onSubmit(prompt.trim());
  };
  return (
    <div className="screen bg-[#fafbfe]">
      <StatusBar />
      <header className="grid h-[58px] grid-cols-[40px_1fr_40px] items-center gap-2.5 px-5 pt-1.5 pb-2">
        <IconButton aria-label="Go back" onClick={onBack} variant="plain">
          <ArrowLeftIcon />
        </IconButton>
        <h1 className="text-center text-md -tracking-[.3px]">Business</h1>
        {profile ? (
          <Avatar
            className="justify-self-end border-2 border-white shadow-[0_0_0_1px_var(--line)]"
            size="md"
          >
            {profile.avatarUrl && (
              <AvatarImage alt={`${profile.fullName} profile`} src={profile.avatarUrl} />
            )}
            <AvatarFallback>{profile.firstName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        ) : (
          <IconButton aria-label="Notifications" className="justify-self-end" variant="soft">
            <BellSimple weight="fill" />
          </IconButton>
        )}
      </header>
      <div
        className="h-[calc(100%-36px-58px)] overflow-y-auto overscroll-contain px-5 pb-[112px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        id="app-content"
      >
        <section className="flex flex-col items-center px-2.5 pt-[26px] pb-5 text-center">
          <div className="relative grid size-[62px] rotate-[-4deg] place-items-center rounded-[22px] bg-primary text-white shadow-[0_12px_28px_rgba(7,85,233,0.24)]">
            <SparkleIcon className="size-[29px]" weight="fill" />
            <span className="absolute -top-1 right-[7px] size-2.5 rounded-full border-2 border-white bg-[var(--egov-orange)]" />
          </div>
          <span className="mt-[17px] inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[1.2px] text-primary">
            <ShieldCheckIcon className="size-[13px]" weight="fill" /> eGOVPH
          </span>
          <h2 className="mt-2.5 mb-2 text-2xl leading-[1.03] tracking-[-1.5px] text-balance">
            Describe your business
          </h2>
          <p className="max-w-[330px] text-base leading-[1.55] text-muted-foreground">
            Tell us what you want to sell or do.
          </p>
        </section>
        <form
          className="rounded-[20px] border-[1.5px] border-[#cfd9ec] bg-white p-[15px] shadow-md transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_12px_32px_rgba(7,85,233,0.11)]"
          onSubmit={submit}
        >
          <Textarea
            aria-label="Describe your business idea"
            className="min-h-0 resize-none border-0 bg-transparent p-0 text-base leading-[1.45] shadow-none focus:border-transparent focus:ring-0"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Describe your business idea…"
            ref={inputRef}
            rows={3}
            value={prompt}
          />
          <div className="mt-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[.7px] text-primary">
              <ShieldCheckIcon className="size-[13px]" weight="fill" />
              Your details stay private
            </span>
            <IconButton
              aria-label="Continue"
              data-cuelume-toggle="page"
              disabled={!prompt.trim()}
              type="submit"
              variant="primary"
            >
              <ArrowRightIcon weight="bold" />
            </IconButton>
          </div>
        </form>
        {conversations.length > 0 && (
          <section className="mt-6 mb-7">
            <div className="mb-3">
              <small className="mb-0.5 block text-2xs font-extrabold tracking-[1.3px] text-primary">
                SAVED SESSIONS
              </small>
              <h2 className="text-lg -tracking-[.5px]">Registration plans</h2>
            </div>
            <div className="flex flex-col gap-2">
              {conversations.map((conversation) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_42px] overflow-hidden rounded-[14px] border border-border bg-white"
                  key={conversation.id}
                >
                  <button
                    className={cn(
                      "grid min-h-[58px] min-w-0 grid-cols-[minmax(0,1fr)_18px] items-center gap-2.5 px-3 py-2.5 text-left",
                      FOCUS_RING,
                    )}
                    data-cuelume-toggle="page"
                    onClick={() => onResume(conversation.id)}
                    type="button"
                  >
                    <span className="grid min-w-0 gap-[3px]">
                      <strong className="truncate text-sm">{conversation.title}</strong>
                      <small className="text-2xs text-muted-foreground">
                        Updated {new Date(conversation.updatedAt).toLocaleDateString()}
                      </small>
                    </span>
                    <ArrowRightIcon className="size-4 text-primary" />
                  </button>
                  <button
                    aria-label={`Delete ${conversation.title}`}
                    className={cn(
                      "grid place-items-center border-l border-border text-[#9a493e] hover:bg-[#fff1ef]",
                      FOCUS_RING,
                    )}
                    data-cuelume-toggle="droplet"
                    onClick={() => onDelete(conversation)}
                    type="button"
                  >
                    <TrashIcon className="size-[15px]" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="mt-6 mb-[30px]">
          <h3 className="mb-2.5 text-[12px] uppercase tracking-[1.1px] text-muted-foreground">
            Try asking
          </h3>
          <div className="flex flex-col gap-2">
            {suggestions.map(({ icon: Icon, text }) => (
              <button
                className={cn(
                  "grid min-h-[62px] w-full grid-cols-[38px_1fr_18px] items-center gap-2.5 rounded-[14px] border border-border bg-white px-3 py-2.5 text-left text-[14px] leading-[1.4] text-foreground",
                  FOCUS_RING,
                )}
                data-cuelume-toggle="toggle"
                key={text}
                onClick={() => {
                  setPrompt(text);
                  inputRef.current?.focus();
                }}
                type="button"
              >
                <span className="grid size-[34px] place-items-center rounded-md bg-secondary text-primary">
                  <Icon className="size-[17px]" />
                </span>
                {text}
                <ArrowRightIcon className="size-4 text-[#8a94a7]" />
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-[13px]">
            <small className="mb-0.5 block text-2xs font-extrabold tracking-[1.3px] text-primary">
              LINKED TO YOUR TIN
            </small>
            <h2 className="text-lg -tracking-[.5px]">Your businesses</h2>
          </div>
          {businessesLoading ? (
            <div className="skeleton-card h-[82px] rounded-xl" />
          ) : businesses?.length === 0 ? (
            <div className="flex min-h-[82px] items-center gap-3 rounded-xl border border-dashed border-[#cfd8e8] bg-white p-3.5 text-muted-foreground">
              <BriefcaseIcon className="size-[30px] shrink-0 text-primary" weight="duotone" />
              <div className="flex flex-col gap-[3px]">
                <strong className="text-[14px] text-foreground">No linked businesses yet</strong>
                <span className="text-[12px] leading-[1.4]">
                  Complete a registration plan to save its records and tax calendar here.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {businesses?.map((business) => (
                <button
                  className={cn("block w-full rounded-xl text-left", FOCUS_RING)}
                  data-cuelume-toggle="page"
                  key={business.id}
                  onClick={() => onOpenBusiness(business.id)}
                  type="button"
                >
                  <Card>
                    <CardContent className="grid grid-cols-[44px_1fr_auto] items-center gap-[11px]">
                      <span className="grid size-11 place-items-center rounded-[14px] bg-secondary text-primary">
                        <BriefcaseIcon className="size-[23px]" weight="duotone" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <strong className="truncate text-[14px]">{business.name}</strong>
                        <span className="text-[12px] text-muted-foreground">{business.type}</span>
                        <small className="text-[12px] text-muted-foreground">
                          {business.registrationNumber}
                        </small>
                      </div>
                      <Badge variant="success">{business.status}</Badge>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
          <Alert className="mt-2.5" variant="success">
            <ShieldCheckIcon weight="fill" />
            Matched to your eGovPH account.
          </Alert>
        </section>
      </div>
      <BottomNav active="none" />
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
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [businessRevision, setBusinessRevision] = useState(0);
  const { error: authError, logout, profile, status } = useAuthSession();
  const { data: businesses, loading: businessesLoading } = useApi<RegisteredBusiness[]>(
    `/api/businesses?revision=${businessRevision}`,
    status === "authenticated",
  );
  const {
    data: selectedBusiness,
    error: selectedBusinessError,
    loading: selectedBusinessLoading,
  } = useApi<RegisteredBusinessDetail>(
    selectedBusinessId ? `/api/businesses/${encodeURIComponent(selectedBusinessId)}` : "",
    status === "authenticated" && Boolean(selectedBusinessId),
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
      const businessId = url.searchParams.get("business");
      if (businessId) {
        setSelectedBusinessId(businessId);
        setScreen("business-detail");
        return;
      }
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
    setScreen("chat");
    window.history.pushState({}, "", `?chat=${encodeURIComponent(created.id)}`);
    await refreshConversations();
  };
  const leaveChat = () => {
    setScreen("business");
    setConversation(null);
    setPaymentStatus(null);
    setPaymentService(null);
    setBusinessRevision((current) => current + 1);
    window.history.pushState({}, "", window.location.pathname);
    void refreshConversations();
  };
  const openBusiness = (id: string) => {
    setSelectedBusinessId(id);
    setScreen("business-detail");
    window.history.pushState({}, "", `?business=${encodeURIComponent(id)}`);
  };
  const leaveBusinessDetail = () => {
    setSelectedBusinessId(null);
    setScreen("business");
    window.history.pushState({}, "", window.location.pathname);
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
        <EGovLogo size={36} />
        <p>Business</p>
        <h2>
          Start your business,
          <br />
          step by step.
        </h2>
        <span>One clear path through government services.</span>
        <div className="context-foot">
          <ShieldCheck weight="fill" />
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
                    <FolderOpen weight="fill" />
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
                onOpenBusiness={openBusiness}
              />
            )}
            {screen === "business-detail" && (
              <BusinessDetailScreen
                business={selectedBusiness}
                loading={selectedBusinessLoading}
                error={selectedBusinessError}
                onBack={leaveBusinessDetail}
                profile={profile}
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
