"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarDotsIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  CoffeeIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  LaptopIcon,
  ListChecksIcon,
  PlusIcon,
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
import { BottomNav, StatusBar } from "@/components/phone-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  BusinessConversation,
  ConversationSummary,
  PaymentServiceType,
} from "@/lib/business-chat";
import type { CitizenProfile, RegisteredBusiness } from "@/lib/citizen-profile";
import { dueInLabel, formatBusinessDate, shortBusinessDate } from "@/lib/business-dates";
import type {
  BusinessFile,
  RegisteredBusiness as RegisteredBusinessDetail,
} from "@/lib/registered-business";
import { LANDING, SCREEN, SCREEN_DEPTH, SCREEN_VARIANTS } from "@/lib/motion";
import { useApi } from "@/lib/use-api";
import { useAuthSession } from "@/lib/use-auth-session";
import { cn, FOCUS_RING } from "@/lib/utils";

type Screen = "restoring" | "home" | "business" | "business-detail" | "chat";

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

function isCertificateOfRegistrationFile(file: BusinessFile) {
  if (file.id === "bir-form-2303") {
    return true;
  }

  if (file.id !== "file-cor") {
    return false;
  }

  const haystack = [file.title, file.filename, file.documentType, file.note]
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("certificate of registration") ||
    haystack.includes("form 2303") ||
    haystack.includes("bir 2303") ||
    /\b2303\b/.test(haystack)
  );
}

function getLatestCertificateOfRegistrationFile(files: BusinessFile[]) {
  return files
    .filter(isCertificateOfRegistrationFile)
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
      return safeRight - safeLeft;
    })[0];
}

export function BusinessDetailScreen({
  business,
  conversations,
  conversationsLoading,
  loading,
  error,
  onBack,
  onNewChat,
  onOpenChat,
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
  profile: CitizenProfile;
}) {
  const [tab, setTab] = useState<"overview" | "records" | "files" | "calendar">("overview");
  const latestCorFile = useMemo(
    () => (business ? getLatestCertificateOfRegistrationFile(business.files) : undefined),
    [business],
  );
  return (
    <div className="screen business-detail-screen">
      <StatusBar />
      <Header title="Business record" onBack={onBack} profile={profile} />
      <div className="business-detail-scroll" id="app-content">
        {loading ? (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <div className="skeleton-card h-[124px] rounded-2xl" />
            <div className="skeleton-card h-11 rounded-lg" />
            <div className="flex flex-col gap-2.5">
              <div className="skeleton-card h-20 rounded-xl" />
              <div className="skeleton-card h-20 rounded-xl" />
              <div className="skeleton-card h-20 rounded-xl" />
            </div>
          </div>
        ) : error || !business ? (
          <Alert variant="destructive">
            <BriefcaseIcon weight="duotone" />
            <AlertTitle>Business record unavailable</AlertTitle>
            <AlertDescription>{error ?? "This linked record could not be found."}</AlertDescription>
          </Alert>
        ) : (
          <>
            <Card className="resolve-in border-transparent bg-[var(--egov-blue-dark)] text-white">
              <CardContent className="grid grid-cols-[48px_1fr] gap-3">
                <span className="grid size-12 place-items-center rounded-lg bg-white/10">
                  <StorefrontIcon className="size-[26px]" weight="duotone" />
                </span>
                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-white/70">
                    Linked to {business.tinMasked || "your eGov account"}
                  </span>
                  <h1 className="text-lg leading-tight">{business.name}</h1>
                  <p className="mt-1 text-xs text-white/85">
                    {business.type} in {business.city}
                  </p>
                </div>
                <Badge className="col-span-2 mt-0.5 w-fit" variant="success">
                  <CheckCircleIcon weight="fill" /> {business.status}
                </Badge>
              </CardContent>
            </Card>
            <Tabs
              className="resolve-in mt-3"
              onValueChange={(value) =>
                setTab(value as "overview" | "records" | "files" | "calendar")
              }
              value={tab}
            >
              <TabsList
                aria-label="Business record sections"
                className="sticky -top-3.5 z-10 grid w-full grid-cols-4 gap-1"
              >
                <TabsTrigger
                  className="px-1 text-center text-xs"
                  data-cuelume-toggle="toggle"
                  value="overview"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  className="px-1 text-center text-xs"
                  data-cuelume-toggle="toggle"
                  value="records"
                >
                  Records
                </TabsTrigger>
                <TabsTrigger
                  className="px-1 text-center text-xs"
                  data-cuelume-toggle="toggle"
                  value="files"
                >
                  Files
                </TabsTrigger>
                <TabsTrigger
                  className="px-1 text-center text-xs"
                  data-cuelume-toggle="toggle"
                  value="calendar"
                >
                  Tax calendar
                </TabsTrigger>
              </TabsList>
              <TabsContent className="flex flex-col gap-3" value="overview">
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <h2 className="text-md font-extrabold -tracking-[.2px]">Registration</h2>
                    <dl className="flex flex-col">
                      <div className="grid grid-cols-[100px_1fr] items-center gap-2.5 py-1.5">
                        <dt className="text-xs text-muted-foreground">Registration number</dt>
                        <dd className="m-0 text-right text-xs font-bold break-words">
                          {business.registrationNumber}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[100px_1fr] items-center gap-2.5 py-1.5">
                        <dt className="text-xs text-muted-foreground">Owner</dt>
                        <dd className="m-0 text-right text-xs font-bold break-words">
                          {business.ownerName}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[100px_1fr] items-center gap-2.5 py-1.5">
                        <dt className="text-xs text-muted-foreground">RDO</dt>
                        <dd className="m-0 text-right text-xs font-bold break-words">
                          {business.rdo || "Needs confirmation"}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[100px_1fr] items-center gap-2.5 py-1.5">
                        <dt className="text-xs text-muted-foreground">Completed</dt>
                        <dd className="m-0 text-right text-xs font-bold break-words">
                          {formatBusinessDate(business.finalizedAt)}
                        </dd>
                      </div>
                    </dl>
                    {latestCorFile ? (
                      <a
                        className="mt-0.5 inline-flex w-fit items-center text-2xs font-semibold text-primary/75 underline-offset-2 transition-colors hover:text-primary hover:underline"
                        href={`/api/businesses/${business.id}/files/${latestCorFile.id}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View CoR (2303) →
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1.5">
                    <h2 className="text-md font-extrabold -tracking-[.2px]">Business address</h2>
                    <p className="m-0 text-sm leading-normal">{business.businessAddress}</p>
                    <span className="text-xs text-muted-foreground">
                      {business.businessActivity}
                    </span>
                  </CardContent>
                </Card>
                <button
                  className={cn(
                    "grid grid-cols-[40px_1fr_16px] items-center gap-2.5 rounded-xl border border-primary-border bg-secondary p-4 text-left shadow-xs transition",
                    FOCUS_RING,
                  )}
                  data-cuelume-toggle="page"
                  onClick={() => setTab("calendar")}
                  type="button"
                >
                  <CalendarDotsIcon className="size-[30px] text-primary" weight="duotone" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-primary">Next tax reminder</span>
                    <strong className="text-xs">
                      {business.taxObligations[0]?.title ?? "No reminders scheduled"}
                    </strong>
                    <span className="text-2xs text-muted-foreground">
                      {business.taxObligations[0]
                        ? formatBusinessDate(business.taxObligations[0].dueDate)
                        : ""}
                    </span>
                  </div>
                  <CaretRightIcon className="text-primary" weight="bold" />
                </button>
                <Card>
                  <CardContent className="flex flex-col gap-3">
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <span className="mb-0.5 block text-xs font-bold text-primary">
                          Business assistant
                        </span>
                        <h2 className="text-md font-extrabold -tracking-[.2px]">Recent chats</h2>
                        <p className="mt-1 text-2xs leading-normal text-muted-foreground">
                          Ask about this business’s taxes, files, permits, and next obligations.
                        </p>
                      </div>
                      <IconButton
                        aria-label={`Start a new chat about ${business.name}`}
                        className="shrink-0"
                        data-cuelume-toggle="page"
                        onClick={() => onNewChat(business.id)}
                        variant="primary"
                      >
                        <PlusIcon weight="bold" />
                      </IconButton>
                    </header>
                    {conversationsLoading ? (
                      <div className="skeleton-card h-[58px] rounded-lg" />
                    ) : conversations.length === 0 ? (
                      <button
                        className={cn(
                          "grid min-h-[70px] grid-cols-[38px_1fr_16px] items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2.5 text-left transition-[scale,border-color,background-color] duration-150 ease-[var(--ease-out)] hover:border-primary-border hover:bg-gray-50 active:scale-[var(--press-lg)]",
                          FOCUS_RING,
                        )}
                        data-cuelume-toggle="page"
                        onClick={() => onNewChat(business.id)}
                        type="button"
                      >
                        <span className="grid size-[38px] place-items-center rounded-lg bg-secondary text-primary">
                          <ChatCircleDotsIcon className="size-5" weight="duotone" />
                        </span>
                        <span className="grid gap-0.5">
                          <strong className="text-xs">Start your first business chat</strong>
                          <span className="text-2xs leading-normal text-muted-foreground">
                            Your conversation will stay linked to this record.
                          </span>
                        </span>
                        <CaretRightIcon className="text-primary" weight="bold" />
                      </button>
                    ) : (
                      <div className="grid gap-1.5">
                        {conversations.slice(0, 3).map((conversation) => (
                          <button
                            className={cn(
                              "grid min-h-[52px] grid-cols-[34px_1fr_16px] items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left transition-[scale,border-color,background-color] duration-150 ease-[var(--ease-out)] hover:border-primary-border hover:bg-gray-50 active:scale-[var(--press-lg)]",
                              FOCUS_RING,
                            )}
                            data-cuelume-toggle="page"
                            key={conversation.id}
                            onClick={() => onOpenChat(conversation.id)}
                            type="button"
                          >
                            <span className="grid size-[34px] place-items-center rounded-md bg-secondary text-primary">
                              <ChatCircleDotsIcon className="size-[18px]" weight="duotone" />
                            </span>
                            <span className="grid min-w-0 gap-0.5">
                              <strong className="truncate text-xs">{conversation.title}</strong>
                              <time
                                className="text-2xs text-muted-foreground"
                                dateTime={conversation.updatedAt}
                              >
                                Updated {formatBusinessDate(conversation.updatedAt)}
                              </time>
                            </span>
                            <CaretRightIcon className="text-primary" weight="bold" />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent className="flex flex-col gap-2.5" value="files">
                <header className="flex items-center justify-between">
                  <div>
                    <span className="mb-0.5 block text-xs font-bold text-primary">
                      Document vault
                    </span>
                    <h2 className="text-md font-extrabold -tracking-[.2px]">Business files</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {business.files.length} files
                  </span>
                </header>
                {business.files.length === 0 ? (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
                    <FileTextIcon className="mb-2 size-[34px] text-primary" weight="duotone" />
                    <strong className="text-xs text-foreground">No files saved yet</strong>
                    <p className="mt-1 text-2xs">
                      Forms generated by the DX BIR service will appear here.
                    </p>
                  </div>
                ) : (
                  business.files.map((file) => (
                    <Card key={file.id}>
                      <CardContent className="grid grid-cols-[40px_1fr_auto] items-start gap-2.5">
                        <span className="grid size-10 place-items-center rounded-lg bg-destructive-soft text-destructive-ink">
                          <FileTextIcon weight="duotone" />
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-xs font-bold text-primary">
                            {file.documentType}
                          </span>
                          <strong className="text-xs">{file.title}</strong>
                          <code className="text-2xs break-words text-muted-foreground">
                            {file.filename}
                          </code>
                          <p className="m-0 text-2xs break-words text-muted-foreground">
                            {file.note}
                          </p>
                          <time
                            className="text-2xs text-muted-foreground"
                            dateTime={file.createdAt}
                          >
                            {formatBusinessDate(file.createdAt)}
                          </time>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="success">{file.status}</Badge>
                          <a
                            className="text-xs font-extrabold text-primary"
                            href={`/api/businesses/${encodeURIComponent(business.id)}/files/${encodeURIComponent(file.id)}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              <TabsContent className="flex flex-col gap-2.5" value="records">
                <header className="flex items-center justify-between">
                  <h2 className="text-md font-extrabold -tracking-[.2px]">
                    Registrations and permits
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {business.records.length} records
                  </span>
                </header>
                {business.records.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="grid grid-cols-[38px_1fr_auto] items-start gap-2.5">
                      <span className="grid size-[38px] place-items-center rounded-lg bg-secondary text-primary">
                        <FileTextIcon weight="duotone" />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <strong className="text-xs">{record.title}</strong>
                        <p className="m-0 text-2xs break-words text-muted-foreground">
                          {record.agency}
                        </p>
                        <span className="text-2xs break-words text-muted-foreground">
                          {record.referenceNumber}
                        </span>
                        <span className="mt-0.5 text-2xs break-words text-muted-foreground">
                          {record.note}
                        </span>
                      </div>
                      <Badge
                        variant={
                          record.status === "Not required"
                            ? "neutral"
                            : record.status === "Scheduled"
                              ? "warning"
                              : "success"
                        }
                      >
                        {record.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent className="flex flex-col gap-2.5" value="calendar">
                <header className="flex items-center justify-between px-0.5">
                  <div>
                    <span className="mb-0.5 block text-xs font-bold text-primary">
                      Tax calendar
                    </span>
                    <h2 className="text-md font-extrabold -tracking-[.2px]">
                      Upcoming obligations
                    </h2>
                  </div>
                  <CalendarDotsIcon className="size-[30px] text-primary" weight="duotone" />
                </header>
                <p className="mx-0.5 mb-1 text-2xs text-muted-foreground">
                  {business.taxObligations.length
                    ? "DX BIR demo reminders are based only on the legal business type. Confirm tax types and filing deadlines directly with BIR."
                    : "No tax calendar is saved for this record. Confirm tax types and filing deadlines directly with BIR."}
                </p>
                {business.taxObligations.map((obligation) => {
                  const date = new Date(`${obligation.dueDate}T00:00:00Z`);
                  return (
                    <Card key={obligation.id}>
                      <CardContent className="grid grid-cols-[47px_1fr_auto] items-start gap-2.5">
                        <time
                          className="flex flex-col items-center rounded-lg bg-secondary py-1.5 text-primary"
                          dateTime={obligation.dueDate}
                        >
                          <strong className="text-lg leading-none">
                            {date.toLocaleDateString("en-PH", { day: "2-digit", timeZone: "UTC" })}
                          </strong>
                          <span className="mt-0.5 text-2xs font-black">
                            {date
                              .toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" })
                              .toUpperCase()}
                          </span>
                        </time>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-2xs font-extrabold text-primary">
                            {obligation.formCode} · {obligation.frequency}
                          </span>
                          <strong className="text-xs">{obligation.title}</strong>
                          <span className="text-2xs text-muted-foreground">
                            {obligation.periodLabel}
                          </span>
                          <p className="m-0 text-2xs text-muted-foreground">{obligation.note}</p>
                        </div>
                        <Badge variant={obligation.status === "Upcoming" ? "warning" : "neutral"}>
                          {obligation.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      <BottomNav active="business" />
    </div>
  );
}
// onBack and profile are always provided by this module-private component's
// single caller (BusinessDetailScreen, whose own props require both), so
// there is no "no back button" / "no profile" fallback to render here.
function Header({
  title,
  onBack,
  profile,
}: {
  title?: string;
  onBack: () => void;
  profile: CitizenProfile;
}) {
  return (
    <header className="grid h-[58px] grid-cols-[40px_1fr_40px] items-center gap-2.5 px-5 pt-1.5 pb-2">
      <IconButton aria-label="Go back" data-cuelume-toggle="page" onClick={onBack} variant="plain">
        <ArrowLeftIcon />
      </IconButton>
      {title ? <h1 className="text-center text-md -tracking-[.3px]">{title}</h1> : <span />}
      <ProfileAvatar
        className="size-9 justify-self-end rounded-full border-2 border-white object-cover shadow-[0_0_0_1px_var(--line)]"
        profile={profile}
      />
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
        <div className="relative grid grid-cols-2 gap-3 border-t border-[var(--line-soft)] bg-[linear-gradient(90deg,var(--gray-50)_0%,#fff_60%)] px-3.5 py-[11px]">
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
          transition={LANDING}
        >
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
                <HomeScreen onBusiness={noop} onLogout={noop} profile={PREVIEW_PROFILE} />
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
                    profile={profile}
                  />
                )}
                {screen === "chat" && conversation && (
                  <BusinessChatScreen
                    business={selectedBusiness}
                    key={conversation.id}
                    conversation={conversation}
                    conversations={
                      conversation.purpose === "management" ? businessConversations : conversations
                    }
                    profile={profile}
                    paymentStatus={paymentStatus}
                    paymentService={paymentService}
                    onBack={leaveChat}
                    onNewConversation={() => {
                      if (conversation.purpose === "management" && conversation.businessId)
                        void startBusinessChat(conversation.businessId);
                      else leaveChat();
                    }}
                    onOpenBusiness={openBusiness}
                    onSelectConversation={(id) => void openConversation(id)}
                    onDeleteConversation={setPendingDelete}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>
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
    </div>
  );
}
