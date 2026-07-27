"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarDotsIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CoffeeIcon,
  FileTextIcon,
  FolderOpenIcon,
  LaptopIcon,
  ShieldCheckIcon,
  ShoppingBagOpenIcon,
  SparkleIcon,
  StorefrontIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { BusinessChatScreen } from "@/components/business-chat-screen";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HomeScreen } from "@/components/home-screen";
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
import type { RegisteredBusiness as RegisteredBusinessDetail } from "@/lib/registered-business";
import { useApi } from "@/lib/use-api";
import { useAuthSession } from "@/lib/use-auth-session";
import { cn, FOCUS_RING } from "@/lib/utils";

type Screen = "restoring" | "home" | "business" | "business-detail" | "chat";

// Shown on the signed-out desktop rail. A four-step summary of the shape of
// the ten-step plan the agent builds, not a replacement for it.
const registrationOutline = [
  { detail: "DTI, or SEC for a corporation", step: "01", title: "Register the name" },
  { detail: "Where the business operates", step: "02", title: "Barangay clearance" },
  { detail: "Your city or municipality", step: "03", title: "Mayor’s permit" },
  { detail: "And the correct RDO", step: "04", title: "Register with BIR" },
];

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
            <Card className="border-transparent bg-[var(--egov-blue-dark)] text-white">
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
              className="mt-3"
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
                <Alert variant="info">
                  <ShieldCheckIcon weight="fill" />
                  Demo records only. They are not official agency documents.
                </Alert>
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
                      Generated registration and tax setup files will appear here.
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
                  Sample reminders generated from this demo registration. Confirm actual tax types
                  and deadlines with BIR.
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
        <form
          className="rounded-2xl border-[1.5px] border-input-strong bg-white p-[15px] shadow-md transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_12px_32px_rgba(7,85,233,0.11)]"
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
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
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
              <small className="mb-0.5 block text-xs font-bold text-primary">Saved sessions</small>
              <h2 className="text-lg -tracking-[.5px]">Registration plans</h2>
            </div>
            <div className="flex flex-col gap-2">
              {conversations.map((conversation) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_42px] overflow-hidden rounded-lg border border-border bg-white"
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
                      "grid place-items-center border-l border-border text-destructive-ink hover:bg-destructive-soft",
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
          <h3 className="mb-2.5 text-sm text-muted-foreground">Try asking</h3>
          <div className="flex flex-col gap-2">
            {suggestions.map(({ icon: Icon, text }) => (
              <button
                className={cn(
                  "grid min-h-[62px] w-full grid-cols-[38px_1fr_18px] items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2.5 text-left text-base leading-[1.4] text-foreground",
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
                <ArrowRightIcon className="size-4 text-gray-600" />
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-[13px]">
            <small className="mb-0.5 block text-xs font-bold text-primary">
              Linked to your TIN
            </small>
            <h2 className="text-lg -tracking-[.5px]">Your businesses</h2>
          </div>
          {businessesLoading ? (
            <div className="skeleton-card h-[82px] rounded-xl" />
          ) : businesses?.length === 0 ? (
            <div className="flex min-h-[82px] items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-3.5 text-muted-foreground">
              <BriefcaseIcon className="size-[30px] shrink-0 text-primary" weight="duotone" />
              <div className="flex flex-col gap-[3px]">
                <strong className="text-base text-foreground">No linked businesses yet</strong>
                <span className="text-sm leading-[1.4]">
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
          )}
          <Alert className="mt-2.5" variant="success">
            <ShieldCheckIcon weight="fill" />
            Matched to your eGovPH account.
          </Alert>
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
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [businessRevision, setBusinessRevision] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);
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
      {/* Not aria-hidden any more. It was, correctly, while this rail only
          restated the phone beside it — but the four steps below exist nowhere
          else in the signed-out app, so hiding them from screen readers would
          hide the only copy of that information.

          items-start as well as the definite width on BrandLogo: this column
          would otherwise stretch every child to 410px, which is what distorted
          the lockup and would stretch the SSO pill edge to edge too. gap
          replaces four ad-hoc margins (mt-5/mb-[5px]/mt-5/mt-[55px]).

          pt = the phone's 10px bezel + its status bar's 11px top padding, so
          the lockup starts on the same line as the time. */}
      <div className="hidden min-[760px]:flex min-[760px]:w-[min(410px,100%)] min-[760px]:flex-col min-[760px]:items-start min-[760px]:gap-6 min-[760px]:justify-self-end min-[760px]:pt-[21px]">
        <BrandLogo height={30} />
        {/* The "Business" eyebrow that sat here said the same word the lockup
            says, 5px below it. No hard <br> either: it was set for one width
            and fought the wrap the 410px column already forces at every other. */}
        <h2 className="m-0 text-[clamp(40px,4vw,60px)] leading-[0.98] -tracking-[0.032em] text-balance">
          Start your business, step by step.
        </h2>
        <p className="m-0 max-w-[380px] text-md leading-[1.5] text-muted-foreground">
          From your DTI business name to your BIR certificate — the offices, the order, and what
          each one needs.
        </p>
        {/* Numbered because the order is a real dependency, not decoration: no
            mayor's permit without barangay clearance, no BIR certificate
            without either. Summarises the ten-step plan the agent generates.
            Sub-labels stay generic — nobody reading this has signed in yet. */}
        <ol className="m-0 w-full max-w-[380px] list-none p-0">
          {registrationOutline.map(({ detail, step, title }) => (
            <li
              className="grid grid-cols-[26px_minmax(0,1fr)] items-baseline gap-3.5 border-t border-border py-2.5 last:border-b"
              key={step}
            >
              <span className="text-xs font-black tabular-nums text-primary">{step}</span>
              <span className="grid gap-px">
                <strong className="text-sm">{title}</strong>
                <span className="text-xs text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-success-border bg-success-soft px-3 py-1.5 text-xs font-bold text-success-ink">
          <ShieldCheckIcon className="size-[14px] shrink-0 text-success" weight="fill" />
          Live eGov SSO
        </span>
      </div>
      <div className="phone-shell">
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
          <LoginScreen initialError={authError} />
        ) : (
          <>
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
                onDeleteConversation={setPendingDelete}
              />
            )}
          </>
        )}
      </div>
      <div id="egov-sso-widget-portal" />
      <ConfirmDialog
        confirmLabel="Delete plan"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” and its messages and payment history will be permanently removed. This cannot be undone.`
            : ""
        }
        onConfirm={() => {
          if (pendingDelete) void deleteSession(pendingDelete);
        }}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        open={pendingDelete !== null}
        title="Delete this registration plan?"
      />
    </div>
  );
}
