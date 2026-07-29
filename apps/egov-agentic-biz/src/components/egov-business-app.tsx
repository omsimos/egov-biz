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
  FolderOpenIcon,
  LaptopIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingBagOpenIcon,
  SparkleIcon,
  StorefrontIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type {
  BusinessFile,
  RegisteredBusiness as RegisteredBusinessDetail,
} from "@/lib/registered-business";
import { LANDING, SCREEN, SCREEN_DEPTH, SCREEN_VARIANTS } from "@/lib/motion";
import { useApi } from "@/lib/use-api";
import { useAuthSession } from "@/lib/use-auth-session";
import { cn, FOCUS_RING } from "@/lib/utils";

type Screen = "restoring" | "home" | "business" | "business-detail" | "chat";

// The citizen shown in the landing's phone preview, from the design. Nobody is
// signed in behind that screen, so every field it does not put on glass is
// blank rather than invented — only the greeting, the avatar and the city are
// ever read. See the `.landing-preview` subtree, which is inert.
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

  const submitButton = (
    <IconButton
      aria-label="Continue"
      data-cuelume-toggle="page"
      disabled={!prompt.trim()}
      type="submit"
      variant="primary"
    >
      <ArrowRightIcon weight="bold" />
    </IconButton>
  );

  const composer = (
    <form
      className={cn(
        "rounded-2xl border-[1.5px] border-input-strong bg-white transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_12px_32px_rgba(7,85,233,0.11)]",
        returning
          ? "flex items-center gap-2.5 py-2.5 pr-2.5 pl-[15px] shadow-sm"
          : "p-[15px] shadow-md",
      )}
      onSubmit={submit}
    >
      <Textarea
        aria-label="Describe your business idea"
        className={cn(
          "min-h-0 resize-none border-0 bg-transparent p-0 text-base leading-[1.45] shadow-none focus:border-transparent focus:ring-0",
          returning && "self-center py-1",
        )}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Describe your business idea…"
        ref={inputRef}
        rows={returning ? 1 : 3}
        value={prompt}
      />
      {returning ? (
        submitButton
      ) : (
        <div className="mt-2.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
            <ShieldCheckIcon className="size-[13px]" weight="fill" />
            Your details stay private
          </span>
          {submitButton}
        </div>
      )}
    </form>
  );

  // These write into the textarea and focus it, so they belong under the field
  // rather than below the saved plans. No trailing arrow — nothing navigates —
  // and 62px rows at 15px overstated what amounts to placeholder text.
  const prompts = (
    <div className="mt-2.5 flex flex-col gap-1.5">
      {suggestions.map(({ icon: Icon, text }) => (
        <button
          className={cn(
            "grid w-full grid-cols-[22px_1fr] items-center gap-2.5 rounded-md border border-border bg-white px-3 py-2.5 text-left text-sm leading-[1.35] font-semibold text-foreground",
            // These write into the textarea rather than navigating, so the
            // press is the whole confirmation the user gets that the tap landed
            // on the row they aimed at.
            // scale, not transform — see the note on optionCard in
            // business-chat-screen.tsx for why a hand-written transition list
            // has to name it.
            "transition-[scale,border-color,background-color] duration-150 ease-[var(--ease-out)] hover:border-input-strong hover:bg-gray-50 active:scale-[var(--press-lg)]",
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
          <Icon className="size-[15px] text-primary" />
          {text}
        </button>
      ))}
    </div>
  );

  const plansSection = conversations.length > 0 && (
    <section className="mt-7">
      <div className="mb-3">
        {/* Deliberately not "In progress": ConversationSummary carries only
            id/title/initialPrompt/activeStreamId/createdAt/updatedAt, so this
            screen cannot tell a finished plan from an abandoned one. Saying
            otherwise is a claim the data does not support. Per-plan status wants
            the summary to carry the latest plan's step counts. */}
        <small className="mb-0.5 block text-xs font-bold text-primary">Saved sessions</small>
        <h2 className="text-lg -tracking-[.5px]">Registration plans</h2>
      </div>
      <div className="flex flex-col gap-2">
        {/* The press lives on the row, not on either button inside it. :active
            propagates to ancestors, so pressing resume or delete dips the whole
            row as one object — scaling only the resume half would shear it away
            from the delete column it shares a border with. */}
        {conversations.map((conversation) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_34px] overflow-hidden rounded-lg border border-border bg-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]"
            key={conversation.id}
          >
            <button
              className={cn(
                "grid min-h-[58px] min-w-0 grid-cols-[minmax(0,1fr)_18px] items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-gray-50",
                FOCUS_RING,
              )}
              data-cuelume-toggle="page"
              onClick={() => onResume(conversation.id)}
              type="button"
            >
              <span className="grid min-w-0 gap-[3px]">
                <strong className="truncate text-sm">{conversation.title}</strong>
                <small className="text-2xs text-muted-foreground">
                  {conversation.progress
                    ? `${
                        conversation.progress.done
                          ? "Complete"
                          : `${conversation.progress.completed} of ${conversation.progress.total} steps`
                      } · `
                    : null}
                  Updated {new Date(conversation.updatedAt).toLocaleDateString()}
                </small>
              </span>
              <ArrowRightIcon className="size-4 text-primary" />
            </button>
            {/* Quiet by default. A divider plus destructive ink gave deleting the
                same billing as resuming, on the row that represents work in
                progress — and the confirm dialog is what makes it safe, not the
                colour. */}
            <button
              aria-label={`Delete ${conversation.title}`}
              className={cn(
                "grid place-items-center text-gray-500 transition-colors hover:bg-destructive-soft hover:text-destructive-ink",
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
  );

  const businessesSection = (
    <section className="mt-7">
      <div className="mb-[13px]">
        <small className="mb-0.5 block text-xs font-bold text-primary">Linked to your TIN</small>
        <h2 className="text-lg -tracking-[.5px]">Your businesses</h2>
      </div>
      {businessesLoading ? (
        <div className="skeleton-card h-[82px] rounded-xl" />
      ) : businesses?.length === 0 ? (
        <div className="resolve-in flex min-h-[82px] items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-3.5 text-muted-foreground">
          <BriefcaseIcon className="size-[30px] shrink-0 text-primary" weight="duotone" />
          <div className="flex flex-col gap-[3px]">
            <strong className="text-base text-foreground">No linked businesses yet</strong>
            <span className="text-sm leading-[1.4]">
              Complete a registration plan to save its records and tax calendar here.
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="resolve-in flex flex-col gap-2.5">
            {businesses?.map((business) => (
              <button
                className={cn(
                  "group block w-full rounded-xl text-left",
                  "transition-transform duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]",
                  FOCUS_RING,
                )}
                data-cuelume-toggle="page"
                key={business.id}
                onClick={() => onOpenBusiness(business.id)}
                type="button"
              >
                {/* Hover lifts the card's own shadow rather than tinting it: the
                    card is white on a white-ish ground, so a background change
                    reads as a colour bug where depth reads as "this opens". */}
                <Card className="transition-shadow duration-150 group-hover:shadow-md">
                  <CardContent className="grid grid-cols-[44px_1fr_auto] items-center gap-[11px]">
                    <span className="grid size-11 place-items-center rounded-lg bg-secondary text-primary">
                      <BriefcaseIcon className="size-[23px]" weight="duotone" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <strong className="truncate text-base">{business.name}</strong>
                      <span className="text-sm text-muted-foreground">{business.type}</span>
                      <small className="text-sm text-muted-foreground">
                        {business.registrationNumber}
                      </small>
                    </div>
                    <Badge variant="success">{business.status}</Badge>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
          {/* A caption, not an Alert. It confirms something about the card right
              above it; the full-width success banner was the treatment a real
              warning gets, and it used to render over the empty state too,
              claiming a match to nothing. */}
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-[13px] text-success" weight="fill" />
            Matched to your eGovPH account
          </span>
        </>
      )}
    </section>
  );

  return (
    <div className="screen">
      <StatusBar />
      <header className="grid h-[58px] grid-cols-[40px_1fr_40px] items-center gap-2.5 px-5 pt-1.5 pb-2">
        <IconButton aria-label="Go back" onClick={onBack} variant="plain">
          <ArrowLeftIcon />
        </IconButton>
        <h1 className="text-center text-md -tracking-[.3px]">Business</h1>
        {profile && (
          <Avatar
            className="justify-self-end border-2 border-white shadow-[0_0_0_1px_var(--line)]"
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
            {businessesSection}
            {plansSection}
            <section className="mt-7">
              <h2 className="mb-3 text-lg -tracking-[.5px]">Start something new</h2>
              {composer}
              {prompts}
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
            {prompts}
            {businessesSection}
          </>
        )}
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
  // Landing → sign-in. Only ever true while signed out; authenticating unmounts
  // the whole landing, so this never has to be reset on success.
  const [signingIn, setSigningIn] = useState(false);
  // The copy column's geometry, which both landing slides are derived from.
  // Measured rather than computed because its width is a min()/clamp() of the
  // viewport, and both values are 0 below the landing's breakpoint, where the
  // column is display:none and nothing moves.
  const copyRef = useRef<HTMLDivElement>(null);
  const [copyBox, setCopyBox] = useState({ right: 0, width: 0 });
  // Only the landing slides, and only above 760px. matchMedia rather than a CSS
  // class because motion animates inline transforms and cannot read a media
  // query — the phone must know to stay put on a handset, where the login screen
  // is the page and there is no preview behind it.
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
  // The landing is the signed-out experience, so it waits until we actually know
  // the visitor is signed out. Rendering it during `loading` would flash a
  // marketing page at someone who already has a session.
  const onLanding = status !== "loading" && !profile;
  // offsetLeft/offsetWidth rather than a rect: both are layout values that ignore
  // transforms, so a reading taken mid-slide is still the resting geometry. The
  // offsetParent is .landing-stage, which spans the viewport, so offsetLeft is
  // already a viewport coordinate. Re-measured on resize because the column's
  // max-width is a min() of the viewport, and re-run when the landing mounts so
  // the first reading is not taken against a column that is not there yet.
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
  // The copy travels to its own right edge, not merely its own width: it starts
  // inset from the left of the viewport, so a translate of just the width leaves
  // that inset — about 225px of headline at 1440 — still on screen.
  const copySlide = copyBox.right;
  // The phone travels half the copy's width, because the two are centred as one
  // group: with the copy beside it, the phone sits W/2 to the right of where it
  // would sit alone, so that is exactly the distance back to the middle.
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
          // The phone is where it belongs on arrival; only Get started moves it.
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
            // Both halves stay mounted and slide past each other: the Home
            // preview leaves to the left as the login screen arrives from the
            // right, each travelling its own full width so neither is ever
            // visible outside the frame. Below 760px there is no landing to
            // preview from, so the login screen is simply the page, parked at 0,
            // and the preview never renders.
            <>
              {/* A picture of the product, not the product: there is no session
                  yet, so this is the design's own sample citizen and the whole
                  subtree is inert. */}
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
                // pointer-events rather than `hidden`: the screen has to keep its
                // box through the slide, and only the half on screen may take a
                // click.
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
