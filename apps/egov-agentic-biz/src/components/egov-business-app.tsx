"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BriefcaseIcon,
  CalendarDotsIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  ChatCircleTextIcon,
  CoffeeIcon,
  FilesIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  InfoIcon,
  LaptopIcon,
  ListChecksIcon,
  PlusIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  ShoppingBagOpenIcon,
  SparkleIcon,
  StorefrontIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BusinessChatScreen } from "@/components/business-chat-screen";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HomeScreen } from "@/components/home-screen";
import { LandingCopy, LandingHeader } from "@/components/landing-shell";
import { LoginScreen } from "@/components/login-screen";
import { BottomNav, PhoneFrame, StatusBar } from "@/components/phone-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  BusinessConversation,
  ConversationSummary,
  PaymentServiceType,
} from "@/lib/business-chat";
import type { CitizenProfile, RegisteredBusiness } from "@/lib/citizen-profile";
import {
  businessDateParts,
  dueInLabel,
  formatBusinessDate,
  shortBusinessDate,
} from "@/lib/business-dates";
import {
  fileGlyph,
  groupRecordsByAgency,
  recordIcon,
  statusVariant,
  TONE_DOT,
  TONE_TILE,
} from "@/lib/business-record-view";
import type { RegisteredBusiness as RegisteredBusinessDetail } from "@/lib/registered-business";
import { LANDING, SCREEN, SCREEN_DEPTH, SCREEN_VARIANTS } from "@/lib/motion";
import { useApi } from "@/lib/use-api";
import { useAuthSession } from "@/lib/use-auth-session";
import { cn, FOCUS_RING } from "@/lib/utils";

type Screen = "restoring" | "home" | "business" | "business-detail" | "business-chats" | "chat";

// The design's sample citizen for the landing's inert phone preview. Only the
// greeting, avatar and city are ever read; the rest stays blank, not invented.
const PREVIEW_PROFILE: CitizenProfile = {
  address: "",
  avatarUrl: "/images/mara-reyes.png",
  barangay: "",
  birthDate: "",
  city: "Makati",
  email: "",
  firstName: "Mara",
  fullName: "Mara Reyes",
  gender: "",
  id: "landing-preview",
  mobile: "",
  nationality: "",
  province: "",
  rdo: "",
  tinMasked: "",
};

const noop = () => {};

// Chip label first, prompt second: the chip is what fits on one line of a
// non-wrapping row, and the prompt is the sentence it writes into the field.
const suggestions = [
  {
    icon: CoffeeIcon,
    label: "Coffee subscription in Makati",
    text: "I want to start a coffee subscription business in Makati",
  },
  {
    icon: LaptopIcon,
    label: "Freelancer with BIR",
    text: "I’m a freelancer and want to register with BIR",
  },
  {
    icon: ShoppingBagOpenIcon,
    label: "Small online shop",
    text: "Help me open a small online shop",
  },
];

export function BusinessDetailScreen({
  business,
  conversations,
  conversationsLoading,
  loading,
  error,
  onBack,
  onNewChat,
  onOpenChat,
  onShowAllChats,
  profile,
}: {
  business: RegisteredBusinessDetail | null;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onNewChat: (businessId: string) => void;
  onOpenChat: (conversationId: string) => void;
  onShowAllChats: (businessId: string) => void;
  profile: CitizenProfile;
}) {
  const [tab, setTab] = useState<RecordTab>("overview");
  const groups = useMemo(
    () => (business ? groupRecordsByAgency(business.records) : []),
    [business],
  );
  // The soonest obligation is the only one that states a day count, so it is
  // also the only one that needs finding — the API returns them in due order.
  const nextObligation = business?.taxObligations[0];

  return (
    <div className="screen screen-stack screen-ground">
      <StatusBar />
      {/* The business is the title. The shipped screen said "Business record"
          over the *owner's* name, so the one fact the header had room for was
          the one the citizen already knew. */}
      <header className="grid shrink-0 grid-cols-[38px_minmax(0,1fr)_34px] items-center gap-2 bg-white px-4 pt-1 pb-2.5">
        <IconButton
          aria-label="Go back"
          className="size-[38px]"
          data-cuelume-toggle="page"
          onClick={onBack}
          variant="plain"
        >
          <ArrowLeftIcon className="size-[19px]" weight="bold" />
        </IconButton>
        <span className="flex min-w-0 flex-col items-center gap-px">
          <h1 className="max-w-full truncate text-[16px] font-extrabold -tracking-[.3px]">
            {business?.name ?? "Business record"}
          </h1>
          {business && (
            <span className="truncate text-meta font-semibold text-muted-foreground">
              {[business.type, business.tinMasked && `TIN ${business.tinMasked}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </span>
        <ProfileAvatar
          className="size-[34px] justify-self-end rounded-full object-cover"
          profile={profile}
        />
      </header>

      {loading || error || !business ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-[96px]" id="app-content">
          {loading ? (
            <div aria-hidden="true" className="flex flex-col gap-3">
              <div className="skeleton-card h-[80px] rounded-[18px]" />
              <div className="skeleton-card h-[66px] rounded-[15px]" />
              <div className="skeleton-card h-[220px] rounded-[18px]" />
            </div>
          ) : (
            <Alert variant="destructive">
              <BriefcaseIcon weight="duotone" />
              <AlertTitle>Business record unavailable</AlertTitle>
              <AlertDescription>
                {error ?? "This linked record could not be found."}
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <Tabs
          className="flex min-h-0 flex-1 flex-col gap-0"
          onValueChange={(value) => setTab(value as RecordTab)}
          value={tab}
        >
          {/* Four equal pills that do not scroll. Sticky tabs inside the
              scroller meant the row the citizen was aiming at moved while the
              panel behind it settled. */}
          <TabsList
            aria-label="Business record sections"
            className="flex shrink-0 gap-1 rounded-none border-b border-[var(--line-soft)] bg-white p-0 px-4 pb-2.5"
          >
            {RECORD_TABS.map(([value, label]) => (
              <TabsTrigger
                className="flex-1 rounded-[10px] px-1 py-[9px] text-center text-sm font-extrabold data-active:bg-secondary data-active:text-primary data-active:shadow-none"
                data-cuelume-toggle="toggle"
                key={value}
                value={value}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-[96px]" id="app-content">
            <TabsContent className="flex flex-col gap-3" value="overview">
              {/* One card, one action. An earlier version stacked status chips,
                  a form line and two buttons here; what a returning owner needs
                  from the top of this screen is the next deadline. */}
              {nextObligation ? (
                <button
                  className={cn(
                    "grid grid-cols-[48px_minmax(0,1fr)_16px] items-center gap-[13px] rounded-[18px] bg-primary-deep p-4 text-left text-white",
                    "shadow-[0_12px_26px_-20px_rgba(7,60,170,.6)] transition-transform duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]",
                    FOCUS_RING,
                  )}
                  data-cuelume-toggle="page"
                  onClick={() => setTab("calendar")}
                  type="button"
                >
                  <span className="flex size-12 flex-col items-center justify-center rounded-[14px] bg-white/16">
                    <strong className="text-md leading-none">
                      {businessDateParts(nextObligation.dueDate).day}
                    </strong>
                    <span className="text-xs font-extrabold text-primary-border">
                      {businessDateParts(nextObligation.dueDate).month}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-meta font-extrabold text-primary-border">
                      Next filing · {dueInLabel(nextObligation.dueDate)}
                    </span>
                    <strong className="text-md leading-[1.35] -tracking-[.2px]">
                      {nextObligation.title}
                    </strong>
                  </span>
                  <CaretRightIcon className="size-3.5 text-white/60" weight="bold" />
                </button>
              ) : (
                <p className="rounded-[18px] border border-border bg-white p-4 text-sm leading-[1.5] text-muted-foreground">
                  No filing calendar is saved for this record. Confirm tax types and deadlines
                  directly with BIR.
                </p>
              )}

              <div className="flex gap-2">
                {(
                  [
                    ["records", "Records", SealCheckIcon, business.records.length],
                    ["files", "Files", FilesIcon, business.files.length],
                    ["calendar", "Filings", CalendarDotsIcon, business.taxObligations.length],
                  ] as const
                ).map(([value, label, Icon, count]) => (
                  <button
                    className={cn(
                      "flex flex-1 flex-col gap-[3px] rounded-[15px] border border-border bg-white p-3 text-left",
                      "transition-colors duration-150 ease-[var(--ease-out)] hover:border-primary-border",
                      FOCUS_RING,
                    )}
                    data-cuelume-toggle="toggle"
                    key={value}
                    onClick={() => setTab(value)}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                      <Icon className="size-[15px] text-primary" weight="duotone" />
                      {label}
                    </span>
                    <strong className="text-md -tracking-[.4px]">{count}</strong>
                  </button>
                ))}
              </div>

              <section className="rounded-[18px] border border-border bg-white p-4">
                <h2 className="mb-0.5 text-md font-extrabold -tracking-[.4px]">Registration</h2>
                <dl className="m-0 flex flex-col">
                  {(
                    [
                      ["Business name", business.name, false],
                      ["Registration no.", business.registrationNumber, true],
                      ["Owner", business.ownerName, false],
                      ["BIR district", business.rdo || "Needs confirmation", false],
                      ["Line of business", business.businessActivity, false],
                      ["Address", business.businessAddress, false],
                      ["Registered", formatBusinessDate(business.finalizedAt), false],
                    ] as const
                  ).map(([label, value, mono]) => (
                    <div
                      className="grid grid-cols-[118px_minmax(0,1fr)] items-baseline gap-3.5 border-b border-[var(--row-divider)] py-[13px] last:border-b-0"
                      key={label}
                    >
                      <dt className="text-sm text-gray-600">{label}</dt>
                      <dd
                        className={cn(
                          "m-0 text-copy leading-[1.55] font-bold break-words",
                          mono && "font-mono",
                        )}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <DemoRecordsNote className="mt-3" />
              </section>

              <BusinessAssistantCard
                business={business}
                conversations={conversations}
                loading={conversationsLoading}
                onNewChat={onNewChat}
                onOpenChat={onOpenChat}
                onShowAllChats={onShowAllChats}
              />
            </TabsContent>

            <TabsContent className="flex flex-col" value="records">
              {/* Grouped by issuer, so the agency name is said once per group
                  instead of on every row — which is what let the rows below drop
                  to one line of title and one reference. */}
              {groups.map(({ agency, count, items, tone }) => (
                <section className="mb-4 flex flex-col" key={agency}>
                  <div className="flex items-center justify-between gap-2.5 px-0.5 pb-2">
                    <h2 className="inline-flex items-center gap-[7px] text-copy font-extrabold -tracking-[.3px]">
                      <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
                      {agency}
                    </h2>
                    <span className="text-meta font-bold text-gray-500">{count}</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border bg-white">
                    {items.map((record) => {
                      const Icon = recordIcon(record);
                      return (
                        <div
                          className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-[11px] border-t border-[var(--row-divider)] px-3.5 py-[13px] first:border-t-0"
                          key={record.id}
                        >
                          <span
                            className={cn(
                              "grid size-[34px] place-items-center rounded-[10px]",
                              TONE_TILE[tone],
                            )}
                          >
                            <Icon className="size-[17px]" weight="duotone" />
                          </span>
                          <span className="flex min-w-0 flex-col gap-[3px]">
                            <strong className="text-base">{record.title}</strong>
                            <span className="truncate font-mono text-meta text-gray-600">
                              {record.referenceNumber}
                            </span>
                          </span>
                          <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
              <DemoRecordsNote className="pb-1" />
            </TabsContent>

            <TabsContent className="flex flex-col" value="files">
              {business.files.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
                  <FileTextIcon className="mb-2 size-[34px] text-primary" weight="duotone" />
                  <strong className="text-base text-foreground">No files saved yet</strong>
                  <p className="mt-1 text-meta">
                    Forms generated by the DX BIR service will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-white">
                  {/* The whole row is the link. Splitting the target between a
                      title and a separate "Open" control gave one destination
                      two hit areas and made the smaller one the real button. */}
                  {business.files.map((file) => {
                    const { Icon, tone } = fileGlyph(file);
                    return (
                      <a
                        className={cn(
                          "grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--row-divider)] p-3.5 first:border-t-0",
                          "transition-colors duration-150 hover:bg-gray-50",
                          FOCUS_RING,
                        )}
                        data-cuelume-toggle="page"
                        href={`/api/businesses/${encodeURIComponent(business.id)}/files/${encodeURIComponent(file.id)}`}
                        key={file.id}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <span
                          className={cn(
                            "grid size-10 place-items-center rounded-xl",
                            TONE_TILE[tone],
                          )}
                        >
                          <Icon className="size-[21px]" weight="duotone" />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <strong className="text-base">{file.title}</strong>
                          <span className="truncate text-meta text-gray-600">
                            {file.documentType} · {file.filename}
                          </span>
                        </span>
                        <span className="flex flex-none flex-col items-end gap-[5px]">
                          <Badge variant={statusVariant(file.status)}>{file.status}</Badge>
                          <span className="inline-flex items-center gap-1 text-meta font-extrabold text-primary">
                            Open
                            <ArrowUpRightIcon className="size-[11px]" weight="bold" />
                          </span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
              <span className="mt-3 inline-flex items-start gap-[7px] pb-1 text-meta leading-[1.45] text-muted-foreground">
                <ShieldCheckIcon
                  className="mt-px size-[13px] flex-none text-success"
                  weight="fill"
                />
                Preview files. Form 1901 still has to be submitted to BIR.
              </span>
            </TabsContent>

            <TabsContent className="flex flex-col gap-2.5" value="calendar">
              {business.taxObligations.map((obligation, index) => {
                const { day, month } = businessDateParts(obligation.dueDate);
                // Only the soonest states a day count: four rows each counting
                // down turned a schedule into four competing alarms.
                const soonest = index === 0;
                return (
                  <article
                    className={cn(
                      "grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-2xl border bg-white p-3.5",
                      soonest ? "border-primary-border" : "border-border",
                    )}
                    key={obligation.id}
                  >
                    <time
                      className={cn(
                        "flex size-12 flex-col items-center justify-center rounded-[13px]",
                        soonest ? "bg-secondary" : "bg-gray-100",
                      )}
                      dateTime={obligation.dueDate}
                    >
                      <strong
                        className={cn(
                          "text-md leading-none",
                          soonest ? "text-primary" : "text-gray-800",
                        )}
                      >
                        {day}
                      </strong>
                      <span
                        className={cn(
                          "text-xs font-extrabold",
                          soonest ? "text-primary/70" : "text-gray-600",
                        )}
                      >
                        {month}
                      </span>
                    </time>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-meta font-extrabold",
                          soonest ? "text-primary" : "text-gray-600",
                        )}
                      >
                        {soonest
                          ? `${capitalize(dueInLabel(obligation.dueDate))} · ${obligation.status}`
                          : obligation.status}
                      </span>
                      <strong className="text-base leading-[1.3]">{obligation.title}</strong>
                      <span className="text-meta text-gray-600">
                        {obligation.formCode} · {obligation.periodLabel}
                      </span>
                    </div>
                  </article>
                );
              })}
              <span className="mt-1 inline-flex items-start gap-[7px] pb-1 text-meta leading-[1.45] text-muted-foreground">
                <InfoIcon className="mt-px size-[13px] flex-none text-primary" weight="fill" />
                Sample schedule for a sole proprietor. Confirm registered tax types with BIR.
              </span>
            </TabsContent>
          </div>
        </Tabs>
      )}
      <BottomNav active="business" />
    </div>
  );
}

const RECORD_TABS = [
  ["overview", "Overview"],
  ["records", "Records"],
  ["files", "Files"],
  ["calendar", "Tax calendar"],
] as const;

type RecordTab = (typeof RECORD_TABS)[number][0];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Said once per tab, not once per row. Every records and files row used to carry
// its own copy of this, which is how eight rows came to repeat one disclaimer
// eight times.
function DemoRecordsNote({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] text-meta text-muted-foreground",
        className,
      )}
    >
      <ShieldCheckIcon className="size-[13px] text-success" weight="fill" />
      Demo records — not official agency documents
    </span>
  );
}

function BusinessAssistantCard({
  business,
  conversations,
  loading,
  onNewChat,
  onOpenChat,
  onShowAllChats,
}: {
  business: RegisteredBusinessDetail;
  conversations: ConversationSummary[];
  loading: boolean;
  onNewChat: (businessId: string) => void;
  onOpenChat: (conversationId: string) => void;
  onShowAllChats: (businessId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-primary-border bg-[linear-gradient(155deg,var(--gray-50)_0%,var(--primary-tint)_60%,var(--primary-tint-strong)_100%)] p-[18px]">
      <div className="grid grid-cols-[46px_minmax(0,1fr)] items-center gap-[13px]">
        <span className="grid size-[46px] place-items-center rounded-[14px] bg-primary text-white">
          <ChatCircleDotsIcon className="size-6" weight="fill" />
        </span>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h2 className="truncate text-[19px] leading-[1.3] font-extrabold -tracking-[.3px] text-primary-ink">
            Ask about {business.name}
          </h2>
          <p className="text-sm leading-[1.55] text-primary-ink/80">
            Taxes, files, permits, and what’s still open.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="skeleton-card h-[46px] rounded-[13px]" />
      ) : conversations.length > 0 ? (
        <div className="flex flex-col gap-[7px]">
          {conversations.slice(0, 3).map((conversation) => (
            <button
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_14px] items-center gap-2.5 rounded-[13px] border border-primary-border bg-white/92 px-[13px] py-3 text-left",
                "transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-white active:scale-[var(--press-lg)]",
                FOCUS_RING,
              )}
              data-cuelume-toggle="page"
              key={conversation.id}
              onClick={() => onOpenChat(conversation.id)}
              type="button"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <strong className="truncate text-copy leading-[1.4]">{conversation.title}</strong>
                <time className="text-meta text-primary-ink/70" dateTime={conversation.updatedAt}>
                  {formatBusinessDate(conversation.updatedAt)}
                </time>
              </span>
              <CaretRightIcon className="size-[13px] text-primary/50" weight="bold" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          className={cn(
            "flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[13px] bg-primary text-base font-extrabold text-white",
            "transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-[var(--primary-hover)] active:scale-[var(--press-lg)]",
            FOCUS_RING,
          )}
          data-cuelume-toggle="page"
          onClick={() => onNewChat(business.id)}
          type="button"
        >
          <PlusIcon className="size-[15px]" weight="bold" />
          New question
        </button>
        {conversations.length > 0 && (
          <button
            className={cn(
              "flex h-[46px] flex-none items-center gap-[7px] rounded-[13px] border border-primary-border bg-white/92 px-4 text-base font-extrabold text-primary",
              "transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-white active:scale-[var(--press-lg)]",
              FOCUS_RING,
            )}
            data-cuelume-toggle="page"
            onClick={() => onShowAllChats(business.id)}
            type="button"
          >
            Show all
            <ArrowRightIcon className="size-3.5" weight="bold" />
          </button>
        )}
      </div>
    </section>
  );
}

// Every chat scoped to one business, which is the list the record's "Show all"
// promises. Rows carry a title and a date and no answer preview: a preview line
// would mean loading each transcript's last assistant message to render a list.
export function BusinessChatsScreen({
  business,
  conversations,
  loading,
  onBack,
  onNewChat,
  onOpenChat,
}: {
  business: RegisteredBusinessDetail | null;
  conversations: ConversationSummary[];
  loading: boolean;
  onBack: () => void;
  onNewChat: (businessId: string) => void;
  onOpenChat: (conversationId: string) => void;
}) {
  const name = business?.name ?? "this business";
  return (
    <div className="screen screen-stack screen-ground">
      <StatusBar />
      <header className="grid shrink-0 grid-cols-[38px_minmax(0,1fr)_34px] items-center gap-2 border-b border-[var(--line-soft)] bg-white px-4 pt-1 pb-3">
        <IconButton
          aria-label="Back to business record"
          className="size-[38px]"
          data-cuelume-toggle="page"
          onClick={onBack}
          variant="plain"
        >
          <ArrowLeftIcon className="size-[19px]" weight="bold" />
        </IconButton>
        <span className="flex min-w-0 flex-col items-center gap-px">
          <h1 className="max-w-full truncate text-[16px] leading-[1.3] font-extrabold -tracking-[.2px]">
            Chats about {name}
          </h1>
          <span className="text-meta font-semibold text-muted-foreground">
            {conversations.length === 1 ? "1 saved chat" : `${conversations.length} saved chats`}
          </span>
        </span>
        {business && (
          <IconButton
            aria-label={`Start a new chat about ${name}`}
            className="size-[34px] justify-self-end"
            data-cuelume-toggle="page"
            onClick={() => onNewChat(business.id)}
            variant="primary"
          >
            <PlusIcon className="size-[17px]" weight="bold" />
          </IconButton>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-6" id="app-content">
        {loading ? (
          <div aria-hidden="true" className="skeleton-card h-[200px] rounded-2xl" />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-6 text-center">
            <ChatCircleTextIcon className="mb-2 size-[34px] text-primary" weight="duotone" />
            <strong className="text-base">No chats about {name} yet</strong>
            <p className="mt-1 text-meta leading-[1.5] text-muted-foreground">
              Ask about its taxes, files or permits and the conversation is saved here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            {conversations.map((conversation) => (
              <button
                className={cn(
                  "grid w-full grid-cols-[36px_minmax(0,1fr)_14px] items-center gap-3 border-t border-[var(--row-divider)] p-3.5 text-left first:border-t-0",
                  "transition-colors duration-150 hover:bg-gray-50",
                  FOCUS_RING,
                )}
                data-cuelume-toggle="page"
                key={conversation.id}
                onClick={() => onOpenChat(conversation.id)}
                type="button"
              >
                <span className="grid size-9 place-items-center rounded-[11px] bg-secondary text-primary">
                  <ChatCircleTextIcon className="size-[19px]" weight="duotone" />
                </span>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <strong className="truncate text-base leading-[1.4]">{conversation.title}</strong>
                  <time className="text-meta text-gray-500" dateTime={conversation.updatedAt}>
                    {formatBusinessDate(conversation.updatedAt)}
                  </time>
                </span>
                <CaretRightIcon className="size-[13px] text-gray-500" weight="bold" />
              </button>
            ))}
          </div>
        )}
        <span className="mt-3 inline-flex items-start gap-[7px] text-meta leading-[1.5] text-muted-foreground">
          <ShieldCheckIcon className="mt-px size-[13px] flex-none text-success" weight="fill" />
          Only chats scoped to this business. Other plans live in Business.
        </span>
      </div>
    </div>
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

  // Someone with a business or a plan in progress came back for those, not for
  // an invitation to describe a business they already registered. While the
  // list is still loading, assume they are returning: showing the first-run
  // hero and then reshuffling once data arrives is worse than either order.
  const returning = businessesLoading || (businesses?.length ?? 0) > 0 || conversations.length > 0;
  // The handoff's threshold, not `.trim()`: three characters is not a business
  // description, and lighting the field up for "cof" promises the agent can do
  // something with it.
  const ready = prompt.trim().length > 3;

  const composer = (
    <form
      className={cn(
        "rounded-[20px] border-[1.5px] bg-white p-1.5 transition-[border-color] duration-200 focus-within:border-primary",
        ready ? "border-primary" : "border-input-strong",
      )}
      onSubmit={submit}
    >
      <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
        <Textarea
          aria-label="Describe your business idea"
          className="min-h-0 resize-none self-center border-0 bg-transparent p-0 text-base leading-[1.45] font-semibold shadow-none focus:border-transparent focus:ring-0"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="A coffee cart, a sari-sari store, freelance work…"
          ref={inputRef}
          rows={1}
          value={prompt}
        />
        {/* A rounded square, not the circle IconButton draws by default: it is
            paired with the field's own 20px radius rather than standing alone,
            and the disabled fill is stated because opacity-50 on brand blue
            still reads as an available primary action. */}
        <IconButton
          aria-label="Continue"
          className={cn(
            "size-10 rounded-[13px]",
            ready ? "" : "bg-muted text-gray-500 shadow-none",
          )}
          data-cuelume-toggle="page"
          disabled={!ready}
          type="submit"
          variant="primary"
        >
          <ArrowRightIcon className="size-[18px]" weight="bold" />
        </IconButton>
      </div>
      {/* One non-wrapping row that scrolls. Stacked, these three read as a menu
          of three products; in a row they read as what they are — examples of
          the sentence the field wants. */}
      <div className="flex gap-1.5 overflow-x-auto px-1.5 pt-0.5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suggestions.map(({ icon: Icon, label, text }) => (
          <button
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-2 text-sm font-bold whitespace-nowrap text-gray-800",
              // scale, not transform — see the note on optionCard in
              // business-chat-screen.tsx for why a hand-written transition list
              // has to name it.
              "transition-[scale,background-color,color] duration-150 ease-[var(--ease-out)] hover:bg-primary-tint hover:text-primary active:scale-[var(--press-md)]",
              FOCUS_RING,
            )}
            data-cuelume-toggle="toggle"
            key={label}
            onClick={() => {
              setPrompt(text);
              inputRef.current?.focus();
            }}
            type="button"
          >
            <Icon className="size-[14px] text-primary" />
            {label}
          </button>
        ))}
      </div>
    </form>
  );

  // 17px/800 with its meta on the same baseline, not a 20px title over an
  // all-caps eyebrow: three of these stack on one screen, and an eyebrow each
  // spends a line saying what the heading beside it already says.
  const sectionHeading = (title: string, meta?: ReactNode) => (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-md font-extrabold -tracking-[.2px]">{title}</h2>
      {meta}
    </div>
  );

  const plansSection = conversations.length > 0 && (
    <section className="mt-[22px]">
      {sectionHeading(
        "In progress",
        <span className="text-meta font-bold text-gray-600">
          {conversations.length === 1 && conversations[0].progress
            ? `${conversations[0].progress.completed} of ${conversations[0].progress.total} steps`
            : `${conversations.length} plans`}
        </span>,
      )}
      <div className="mt-2.5 flex flex-col gap-2.5">
        {/* Quiet on purpose. This is the row that must not outshine a registered
            business above it: the resume action is text, not a button, and the
            card carries a border rather than a shadow. */}
        {conversations.map((conversation) => {
          const progress = conversation.progress;
          const complete = Boolean(progress?.done);
          return (
            <div
              className="rounded-xl border border-border bg-white p-3.5 transition-colors duration-150 ease-[var(--ease-out)] hover:border-primary-border"
              key={conversation.id}
            >
              <div className="grid grid-cols-[36px_minmax(0,1fr)_auto_24px] items-center gap-2">
                <span className="grid size-9 place-items-center rounded-[11px] bg-secondary text-primary">
                  <ListChecksIcon className="size-[19px]" weight="duotone" />
                </span>
                <button
                  className={cn(
                    "grid min-w-0 gap-0.5 rounded-md text-left",
                    "transition-transform duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]",
                    FOCUS_RING,
                  )}
                  data-cuelume-toggle="page"
                  onClick={() => onResume(conversation.id)}
                  type="button"
                >
                  <strong className="truncate text-base leading-[1.4]">{conversation.title}</strong>
                  <span className="truncate text-meta text-muted-foreground">
                    {complete
                      ? "Plan complete"
                      : progress?.nextLabel
                        ? `Next: ${progress.nextLabel}`
                        : `Updated ${formatBusinessDate(conversation.updatedAt)}`}
                  </span>
                </button>
                <button
                  className={cn(
                    "inline-flex shrink-0 items-center gap-[5px] rounded-md text-sm font-extrabold text-primary",
                    FOCUS_RING,
                  )}
                  data-cuelume-toggle="page"
                  onClick={() => onResume(conversation.id)}
                  type="button"
                >
                  {complete ? "Open plan" : "Continue plan"}
                  <ArrowRightIcon className="size-[13px]" weight="bold" />
                </button>
                {/* Quiet by default. A divider plus destructive ink gave deleting
                    the same billing as resuming, on the row that represents work
                    in progress — and the confirm dialog is what makes it safe,
                    not the colour. Not in the handoff, which draws no way to
                    remove a plan; dropping the only one there is is not a design
                    decision this screen gets to make. */}
                <button
                  aria-label={`Delete ${conversation.title}`}
                  className={cn(
                    "grid size-6 place-items-center justify-self-end rounded-md text-gray-400 transition-colors hover:text-destructive-ink",
                    FOCUS_RING,
                  )}
                  data-cuelume-toggle="droplet"
                  onClick={() => onDelete(conversation)}
                  type="button"
                >
                  <TrashIcon className="size-[15px]" />
                </button>
              </div>
              {progress && progress.total > 0 && (
                <div
                  aria-label={`${progress.completed} of ${progress.total} steps done`}
                  className="mt-[11px] flex gap-1"
                  role="img"
                >
                  {Array.from({ length: progress.total }, (_, step) => (
                    <span
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors duration-300",
                        step < progress.completed ? "bg-primary" : "bg-primary-border",
                      )}
                      key={step}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const businessesSection = (
    <section className="mt-3.5">
      {sectionHeading(
        "Your businesses",
        <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-muted-foreground">
          <ShieldCheckIcon className="size-3 text-success" weight="fill" />
          Linked to your TIN
        </span>,
      )}
      {businessesLoading ? (
        <div className="skeleton-card mt-2.5 h-[118px] rounded-[18px]" />
      ) : businesses?.length === 0 ? (
        <div className="resolve-in mt-2.5 flex min-h-[82px] items-center gap-3 rounded-[18px] border border-dashed border-gray-300 bg-white p-3.5 text-muted-foreground">
          <BriefcaseIcon className="size-[30px] shrink-0 text-primary" weight="duotone" />
          <div className="flex flex-col gap-[3px]">
            <strong className="text-base text-foreground">No linked businesses yet</strong>
            <span className="text-sm leading-[1.4]">
              Complete a registration plan to save its records and tax calendar here.
            </span>
          </div>
        </div>
      ) : (
        <div className="resolve-in mt-2.5 flex flex-col gap-2.5">
          {businesses?.map((business) => (
            <BusinessCard
              business={business}
              key={business.id}
              onOpen={() => onOpenBusiness(business.id)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="screen screen-ground">
      <StatusBar />
      <header className="grid h-[58px] grid-cols-[40px_1fr_40px] items-center gap-2.5 px-5 pt-1.5 pb-2">
        <IconButton aria-label="Go back" onClick={onBack} variant="plain">
          <ArrowLeftIcon />
        </IconButton>
        <h1 className="text-center text-md -tracking-[.3px]">Business</h1>
        {profile && (
          <Avatar
            className="size-[34px] justify-self-end border-2 border-white shadow-[0_0_0_1px_var(--line)]"
            size="md"
          >
            {profile.avatarUrl && (
              <AvatarImage alt={`${profile.fullName} profile`} src={profile.avatarUrl} />
            )}
            <AvatarFallback>{profile.firstName.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
      </header>
      <div
        className="h-[calc(100%-36px-58px)] overflow-y-auto overscroll-contain px-5 pb-[112px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        id="app-content"
      >
        {returning ? (
          <>
            {/* The order is the point of the redesign: what the citizen came
                back for, then what is unfinished, then — below a rule, because
                it is a different job — the invitation to start another. */}
            {businessesSection}
            {plansSection}
            <div className="mt-6 h-px bg-line-soft" />
            <section className="mt-[22px]">
              <h2 className="text-md font-extrabold -tracking-[.2px]">Register another business</h2>
              <p className="mt-[7px] text-sm leading-[1.6] text-muted-foreground">
                Describe it in your own words — the agent turns it into a step-by-step plan.
              </p>
              <div className="mt-3">{composer}</div>
            </section>
          </>
        ) : (
          <>
            <section className="flex flex-col items-center px-2.5 pt-[26px] pb-5 text-center">
              <div className="relative grid size-[62px] rotate-[-4deg] place-items-center rounded-2xl bg-primary text-white shadow-[0_12px_28px_rgba(7,85,233,0.24)]">
                <SparkleIcon className="size-[29px]" weight="fill" />
                <span className="absolute -top-1 right-[7px] size-2.5 rounded-full border-2 border-white bg-[var(--egov-orange)]" />
              </div>
              <span className="mt-[17px] inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <ShieldCheckIcon className="size-[13px]" weight="fill" /> eGovPH
              </span>
              <h2 className="mt-2.5 mb-2 text-2xl leading-[1.03] tracking-[-1.5px] text-balance">
                Describe your business
              </h2>
              <p className="max-w-[330px] text-base leading-[1.55] text-muted-foreground">
                Tell us what you want to sell or do.
              </p>
            </section>
            {composer}
            {businessesSection}
          </>
        )}
      </div>
      <BottomNav active="business" />
    </div>
  );
}

function BusinessCard({ business, onOpen }: { business: RegisteredBusiness; onOpen: () => void }) {
  const nextFiling = business.nextTaxDue;
  const onFile =
    business.recordCount === null || business.fileCount === null
      ? null
      : `${business.recordCount} records · ${business.fileCount} files`;
  return (
    <button
      className={cn(
        "relative block w-full overflow-hidden rounded-[18px] border border-border bg-white text-left",
        "transition-[border-color,scale] duration-150 ease-[var(--ease-out)] hover:border-primary-border active:scale-[var(--press-lg)]",
        FOCUS_RING,
      )}
      data-cuelume-toggle="page"
      onClick={onOpen}
      type="button"
    >
      {/* A wash, not a shadow: cards on this screen are separated by their
          border, and the one card that opens the record gets warmth instead of
          height so it does not read as floating over the others. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[42px] -right-[30px] size-[118px] rounded-full bg-[radial-gradient(circle_at_40%_55%,rgba(7,85,233,.09),rgba(7,85,233,0)_70%)]"
      />
      <div className="relative grid grid-cols-[44px_minmax(0,1fr)_auto_14px] items-center gap-3 px-3.5 pt-[15px] pb-3.5">
        <span className="grid size-11 place-items-center rounded-[14px] bg-[linear-gradient(145deg,var(--primary-lift)_0%,var(--primary-deep)_100%)] text-white shadow-[0_8px_16px_-10px_rgba(7,71,194,.9)]">
          <StorefrontIcon className="size-[23px]" weight="duotone" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <strong className="truncate text-md leading-[1.3] -tracking-[.2px]">
            {business.name}
          </strong>
          <span className="truncate text-sm text-muted-foreground">
            {[business.type, business.city].filter(Boolean).join(" · ")}
          </span>
        </span>
        <Badge className="text-meta" variant="success">
          <span className="size-1.5 rounded-full bg-success" />
          {business.status}
        </Badge>
        <CaretRightIcon className="size-3.5 text-gray-500" weight="bold" />
      </div>
      {(nextFiling || onFile) && (
        <div className="relative grid grid-cols-2 gap-3 border-t border-[var(--line-soft)] bg-[linear-gradient(90deg,var(--gray-50)_0%,var(--surface)_60%)] px-3.5 py-[11px]">
          {nextFiling && (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="inline-flex items-center gap-[5px] text-xs text-gray-600">
                <CalendarDotsIcon className="size-3 text-primary" weight="fill" />
                Next filing
              </span>
              <strong className="truncate text-sm">
                {shortBusinessDate(nextFiling)} · {dueInLabel(nextFiling)}
              </strong>
            </span>
          )}
          {onFile && (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="inline-flex items-center gap-[5px] text-xs text-gray-600">
                <FolderIcon className="size-3 text-primary" weight="fill" />
                On file
              </span>
              <strong className="truncate text-sm">{onFile}</strong>
            </span>
          )}
        </div>
      )}
    </button>
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
  // Which way the last navigation went, derived from the screens' depth rather
  // than passed in by each of the eleven setScreen callers. Read during the
  // render where `screen` has already changed but the ref has not, so it still
  // holds where we came from; the effect then catches it up after paint.
  const lastDepth = useRef(SCREEN_DEPTH[screen]);
  const goingBack = SCREEN_DEPTH[screen] < lastDepth.current;
  useEffect(() => {
    lastDepth.current = SCREEN_DEPTH[screen];
  }, [screen]);
  const [prompt, setPrompt] = useState(initialConversation?.initialPrompt ?? "");
  const [conversation, setConversation] = useState<BusinessConversation | null>(
    initialConversation,
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [businessConversations, setBusinessConversations] = useState<ConversationSummary[]>([]);
  const [businessConversationsLoading, setBusinessConversationsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentService, setPaymentService] = useState<PaymentServiceType | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [businessRevision, setBusinessRevision] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);
  // Only true while signed out; authenticating unmounts the landing, so this
  // never needs resetting on success.
  const [signingIn, setSigningIn] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);
  // State, not a ref: DialogContent reads this during render to pick its portal
  // container, so the frame mounting has to cause a re-render.
  const [phoneFrame, setPhoneFrame] = useState<HTMLElement | null>(null);
  const [copyBox, setCopyBox] = useState({ right: 0, width: 0 });
  // matchMedia rather than a CSS class: motion animates inline transforms and
  // cannot read a media query.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 760px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
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
  const refreshBusinessConversations = useCallback(async (businessId: string) => {
    setBusinessConversationsLoading(true);
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/conversations`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setBusinessConversations([]);
        return;
      }
      setBusinessConversations(((await response.json()) as { data: ConversationSummary[] }).data);
    } finally {
      setBusinessConversationsLoading(false);
    }
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
      if (current.businessId) {
        setSelectedBusinessId(current.businessId);
        if (current.purpose === "management")
          await refreshBusinessConversations(current.businessId);
      }
      setScreen("chat");
      const url = new URL(window.location.href);
      url.search = "";
      if (current.businessId) url.searchParams.set("business", current.businessId);
      url.searchParams.set("chat", current.id);
      window.history.replaceState({}, "", url);
      if (current.purpose === "registration") await refreshConversations();
    },
    [refreshBusinessConversations, refreshConversations],
  );
  useEffect(() => {
    void (async () => {
      await refreshConversations();
      const url = new URL(window.location.href);
      const id = url.searchParams.get("chat");
      const businessId = url.searchParams.get("business");
      if (!id) {
        if (businessId) {
          setSelectedBusinessId(businessId);
          setScreen("business-detail");
          await refreshBusinessConversations(businessId);
          return;
        }
        setScreen("home");
        return;
      }
      const paymentReturn = url.searchParams.get("payment") === "return";
      if (initialConversation?.id === id && !paymentReturn) return;
      let status: string | null = null;
      let serviceType: PaymentServiceType | null = null;
      if (paymentReturn) {
        const returnedService = url.searchParams.get("paymentService") as PaymentServiceType | null;
        const statusQuery = new URLSearchParams({
          conversationId: id,
          ...(returnedService ? { serviceType: returnedService } : {}),
        });
        const paymentResponse = await fetch(`/api/payments/egovpay/status?${statusQuery}`);
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
  }, [
    initialConversation?.id,
    openConversation,
    refreshBusinessConversations,
    refreshConversations,
  ]);
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
  const startBusinessChat = async (businessId: string) => {
    const response = await fetch(
      `/api/businesses/${encodeURIComponent(businessId)}/conversations`,
      { method: "POST" },
    );
    if (!response.ok) return;
    const created = ((await response.json()) as { data: BusinessConversation }).data;
    setSelectedBusinessId(businessId);
    setConversation(created);
    setPaymentStatus(null);
    setPaymentService(null);
    setScreen("chat");
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("business", businessId);
    url.searchParams.set("chat", created.id);
    window.history.pushState({}, "", url);
    await refreshBusinessConversations(businessId);
  };
  const leaveChat = () => {
    const businessId = conversation?.purpose === "management" ? conversation.businessId : null;
    setScreen(businessId ? "business-detail" : "business");
    setConversation(null);
    setPaymentStatus(null);
    setPaymentService(null);
    setBusinessRevision((current) => current + 1);
    if (businessId) {
      setSelectedBusinessId(businessId);
      window.history.pushState({}, "", `?business=${encodeURIComponent(businessId)}`);
      void refreshBusinessConversations(businessId);
    } else {
      window.history.pushState({}, "", window.location.pathname);
      void refreshConversations();
    }
  };
  const openBusiness = (id: string) => {
    setBusinessRevision((current) => current + 1);
    void refreshConversations();
    setSelectedBusinessId(id);
    setBusinessConversations([]);
    setScreen("business-detail");
    window.history.pushState({}, "", `?business=${encodeURIComponent(id)}`);
    void refreshBusinessConversations(id);
  };
  const openBusinessChats = (id: string) => {
    setSelectedBusinessId(id);
    setScreen("business-chats");
    void refreshBusinessConversations(id);
  };
  const leaveBusinessDetail = () => {
    setSelectedBusinessId(null);
    setBusinessConversations([]);
    setScreen("business");
    window.history.pushState({}, "", window.location.pathname);
  };
  const deleteSession = async (item: ConversationSummary) => {
    const response = await fetch(`/api/conversations/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setConversations((current) => current.filter(({ id }) => id !== item.id));
    setBusinessConversations((current) => current.filter(({ id }) => id !== item.id));
    if (conversation?.id === item.id) leaveChat();
  };
  const signOut = async () => {
    await logout();
    window.location.assign("/");
  };
  // Waits for a known-signed-out status, so a visitor with a session never sees
  // the marketing page flash.
  const onLanding = status !== "loading" && !profile;
  // offsetLeft/offsetWidth rather than a rect: they ignore transforms, so a
  // reading taken mid-slide is still the resting geometry.
  useEffect(() => {
    const node = copyRef.current;
    if (!node) {
      setCopyBox({ right: 0, width: 0 });
      return;
    }
    const measure = () =>
      setCopyBox({ right: node.offsetLeft + node.offsetWidth, width: node.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onLanding, wide]);
  // Right edge, not width: the copy is inset from the left, so travelling only
  // its width leaves that inset (~225px of headline at 1440) on screen.
  const copySlide = copyBox.right;
  // Half the copy's width: the pair is centred as one group, so the phone sits
  // W/2 right of centre and that is the distance back.
  const phoneSlide = wide && signingIn ? -copyBox.width / 2 : 0;
  return (
    <div className="landing-stage">
      <div aria-hidden="true" className="landing-blobs" />
      {onLanding && <LandingHeader onStart={() => setSigningIn(true)} />}
      <div className="landing-main">
        {onLanding && (
          <LandingCopy
            collapsed={signingIn}
            onStart={() => setSigningIn(true)}
            ref={copyRef}
            slide={copySlide}
          />
        )}
        <motion.div
          animate={{ x: phoneSlide }}
          className="phone-shell"
          initial={false}
          ref={setPhoneFrame}
          transition={LANDING}
        >
          <PhoneFrame element={phoneFrame}>
            {status === "loading" ? (
              <div
                aria-live="polite"
                className="screen grid place-content-center justify-items-center gap-4 bg-canvas! text-muted-foreground"
                role="status"
              >
                <div className="grid size-[58px] animate-[auth-pulse_1.2s_ease-in-out_infinite_alternate] place-items-center rounded-[19px] bg-primary text-white motion-reduce:animate-none!">
                  <ShieldCheckIcon className="size-[30px]" weight="duotone" />
                </div>
                <p className="m-0 text-sm font-bold">Restoring your secure session…</p>
              </div>
            ) : !profile ? (
              // Both halves stay mounted and cross, each travelling its own full
              // width. Below 760px the login screen is simply the page, parked at
              // 0, and the preview never renders.
              <>
                <motion.div
                  animate={{ x: signingIn ? "-100%" : "0%" }}
                  aria-hidden="true"
                  className="landing-preview hidden min-[760px]:block"
                  initial={false}
                  transition={LANDING}
                >
                  {/* Business is live even here: it is the one thing on the
                    launcher this product does, and tapping it before signing in
                    means the same thing as pressing Get started. The screen
                    stays aria-hidden — Get started is the labelled path, and
                    this is a picture of where you land. Logging out of a
                    session that does not exist stays a no-op. */}
                  <HomeScreen
                    onBusiness={() => setSigningIn(true)}
                    onLogout={noop}
                    profile={PREVIEW_PROFILE}
                  />
                </motion.div>
                <motion.div
                  animate={{ x: wide && !signingIn ? "100%" : "0%" }}
                  // pointer-events, not `hidden`: the screen keeps its box through
                  // the slide, but only the visible half may take a click.
                  className={cn("landing-login", wide && !signingIn && "pointer-events-none")}
                  initial={false}
                  transition={LANDING}
                >
                  <LoginScreen
                    initialError={authError}
                    onBack={signingIn ? () => setSigningIn(false) : undefined}
                  />
                </motion.div>
              </>
            ) : (
              // One keyed wrapper per screen instead of five loose conditionals, so
              // the outgoing screen stays mounted long enough to leave. Each is
              // absolutely positioned because both halves have to occupy the same
              // box during the swap; .phone-shell is already `position: relative;
              // overflow: hidden`, which is what clips the 24px of travel.
              // initial={false} stops the first screen animating in on load — that
              // is an arrival, not a navigation.
              <AnimatePresence custom={goingBack} initial={false}>
                <motion.div
                  animate="animate"
                  className="absolute inset-0"
                  custom={goingBack}
                  exit="exit"
                  initial="initial"
                  key={screen}
                  transition={SCREEN}
                  variants={SCREEN_VARIANTS}
                >
                  {screen === "restoring" && (
                    <div className="screen bg-canvas!">
                      <StatusBar />
                      <div
                        className="flex h-[calc(100%-36px)] flex-col items-center justify-center px-[38px] text-center"
                        role="status"
                      >
                        <div className="relative grid size-[62px] animate-[soft-pulse_1.8s_infinite] rotate-[-4deg] place-items-center rounded-[22px] bg-primary text-white shadow-[0_12px_28px_rgba(7,85,233,0.24)] motion-reduce:animate-none!">
                          <FolderOpenIcon className="size-[29px]" weight="fill" />
                        </div>
                        <h1 className="mt-7 mb-2 text-[25px] leading-[1.15] tracking-[-0.8px]">
                          Opening your saved plan
                        </h1>
                        <p className="m-0 text-[14px] text-muted-foreground">
                          Restoring the conversation…
                        </p>
                        <div aria-hidden="true" className="mt-6 flex gap-[5px]">
                          <span className="size-[6px] animate-[dots_1s_infinite_alternate] rounded-full bg-primary motion-reduce:animate-none!" />
                          <span className="size-[6px] animate-[dots_1s_infinite_alternate] rounded-full bg-primary [animation-delay:0.2s] motion-reduce:animate-none!" />
                          <span className="size-[6px] animate-[dots_1s_infinite_alternate] rounded-full bg-primary [animation-delay:0.4s] motion-reduce:animate-none!" />
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
                      onDelete={setPendingDelete}
                      onOpenBusiness={openBusiness}
                    />
                  )}
                  {screen === "business-detail" && (
                    <BusinessDetailScreen
                      business={selectedBusiness}
                      conversations={businessConversations}
                      conversationsLoading={businessConversationsLoading}
                      loading={selectedBusinessLoading}
                      error={selectedBusinessError}
                      onBack={leaveBusinessDetail}
                      onNewChat={(businessId) => void startBusinessChat(businessId)}
                      onOpenChat={(id) => void openConversation(id)}
                      onShowAllChats={openBusinessChats}
                      profile={profile}
                    />
                  )}
                  {screen === "business-chats" && (
                    <BusinessChatsScreen
                      business={selectedBusiness}
                      conversations={businessConversations}
                      loading={businessConversationsLoading}
                      onBack={() => setScreen("business-detail")}
                      onNewChat={(businessId) => void startBusinessChat(businessId)}
                      onOpenChat={(id) => void openConversation(id)}
                    />
                  )}
                  {screen === "chat" && conversation && (
                    <BusinessChatScreen
                      business={selectedBusiness}
                      key={conversation.id}
                      conversation={conversation}
                      conversations={
                        conversation.purpose === "management"
                          ? businessConversations
                          : conversations
                      }
                      profile={profile}
                      paymentStatus={paymentStatus}
                      paymentService={paymentService}
                      onBack={leaveChat}
                      onOpenBusiness={openBusiness}
                      onSelectConversation={(id) => void openConversation(id)}
                      onDeleteConversation={setPendingDelete}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
            {/* Inside the phone, not the page: DialogContent positions itself
              against its nearest positioned ancestor, and above the screens
              that is .phone-shell. At the .landing-stage level its sheet spanned
              the whole viewport. */}
            <ConfirmDialog
              confirmLabel={pendingDelete?.purpose === "management" ? "Delete chat" : "Delete plan"}
              description={
                pendingDelete
                  ? pendingDelete.purpose === "management"
                    ? `“${pendingDelete.title}” and its messages will be permanently removed. This cannot be undone.`
                    : `“${pendingDelete.title}” and its messages and payment history will be permanently removed. This cannot be undone.`
                  : ""
              }
              onConfirm={() => {
                if (pendingDelete) void deleteSession(pendingDelete);
              }}
              onOpenChange={(next) => {
                if (!next) setPendingDelete(null);
              }}
              open={pendingDelete !== null}
              title={
                pendingDelete?.purpose === "management"
                  ? "Delete this business chat?"
                  : "Delete this registration plan?"
              }
            />
          </PhoneFrame>
        </motion.div>
      </div>
    </div>
  );
}
