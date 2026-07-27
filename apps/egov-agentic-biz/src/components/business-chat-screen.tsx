"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightIcon,
  ArrowSquareOut,
  Check,
  CheckCircle,
  CheckCircleIcon,
  CheckIcon,
  CircleNotch,
  Buildings,
  CalendarDots,
  Certificate,
  DownloadSimple,
  FilePdf,
  FileText,
  FlagCheckeredIcon,
  GlobeHemisphereWestIcon,
  Headset,
  InfoIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PaperPlaneRightIcon,
  PencilSimple,
  PencilSimpleIcon,
  ShieldCheck,
  SparkleIcon,
  Storefront,
  StopCircle,
  Plus,
  CaretDown,
  CaretDownIcon,
  Trash,
  X,
  XIcon,
} from "@phosphor-icons/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { play } from "cuelume";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { StatusBar } from "@/components/phone-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldHint, FieldLabel } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { PulseDot } from "@/components/ui/pulse-dot";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { BirFormArtifact } from "@/lib/bir-form/artifact";
import {
  uniqueMessagesById,
  type BarangayClearance,
  type BusinessChatMessage,
  type BusinessConversation,
  type ConversationSummary,
  type DtiBusinessNameForm,
  type EbplsBusinessPermitReceipt,
  type PaymentServiceType,
  type RegistrationPlan,
} from "@/lib/business-chat";
import type { CitizenProfile } from "@/lib/citizen-profile";
import type { IntakeQuestion } from "@/lib/questions";
import type { BusinessRecord, TaxObligation } from "@/lib/registered-business";

type AskUserPart = Extract<BusinessChatMessage["parts"][number], { type: "tool-askUser" }>;
type ReadyAskUserPart = AskUserPart & {
  state: "input-available";
  input: { questions?: IntakeQuestion[]; question?: IntakeQuestion };
};
type PendingQuestion = { part: ReadyAskUserPart; questions: IntakeQuestion[] };
export type PaymentRequest = {
  serviceType: PaymentServiceType;
  serviceLabel: string;
  proposedName: string;
  ownerName: string;
  feeLabel: string;
  serviceReference?: string;
  territorialScope?: DtiBusinessNameForm["territorialScope"];
};

function textOf(message: BusinessChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function CompletionConfetti() {
  return (
    <div className="completion-confetti" aria-hidden="true">
      {Array.from({ length: 40 }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

export function ComplianceResultCard({
  title,
  subtitle,
  records,
  obligations = [],
}: {
  title: string;
  subtitle: string;
  records: BusinessRecord[];
  obligations?: TaxObligation[];
}) {
  return (
    <article className="compliance-result-card">
      <header>
        <span>
          <ShieldCheck weight="duotone" />
        </span>
        <div>
          <small>Setup result</small>
          <strong>{title}</strong>
          <p>{subtitle}</p>
        </div>
      </header>
      <ul>
        {records.map((record) => (
          <li key={record.id}>
            <div>
              <strong>{record.title}</strong>
              <span>{record.agency}</span>
            </div>
            <i className={record.status === "Not required" ? "muted" : ""}>{record.status}</i>
          </li>
        ))}
      </ul>
      {obligations.length > 0 && (
        <footer>
          <CalendarDots weight="duotone" />
          <span>{obligations.length} tax reminders added to the business calendar</span>
        </footer>
      )}
    </article>
  );
}

function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="local-permit-fields">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function BarangayClearanceCard({
  clearance,
  paid,
  onPay,
}: {
  clearance: BarangayClearance;
  paid: boolean;
  onPay: (request: PaymentRequest) => void;
}) {
  const approved = clearance.status === "Approved";
  return (
    <article className={`local-permit-card ${approved ? "approved" : "payment-due"}`}>
      <header>
        <span>
          <Certificate weight="duotone" />
        </span>
        <div>
          <small>Electronic barangay clearance</small>
          <strong>
            {clearance.barangay}, {clearance.city}
          </strong>
        </div>
        <i>
          {approved ? (
            <>
              <CheckCircle weight="fill" /> Approved
            </>
          ) : (
            "Payment required"
          )}
        </i>
      </header>
      <DetailRows
        rows={[
          ["Reference", clearance.referenceNumber],
          ["Business", clearance.businessName],
          ["Owner", clearance.ownerName],
          ["Activity", clearance.businessActivity],
          ["Business address", clearance.businessAddress],
          [
            approved ? "Valid until" : "Assessed fee",
            approved && clearance.validUntil
              ? new Date(clearance.validUntil).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : clearance.feeLabel,
          ],
        ]}
      />
      <section>
        <small>Documents submitted</small>
        <ul>
          {clearance.supportingDocuments.map((document) => (
            <li key={document}>
              <FileText /> {document}
            </li>
          ))}
        </ul>
      </section>
      <section className="local-permit-use">
        <small>Used for</small>
        <ul>
          {clearance.usedFor.map((use) => (
            <li key={use}>
              <Check /> {use}
            </li>
          ))}
        </ul>
      </section>
      {!approved && (
        <footer className="local-permit-payment">
          <div>
            <small>Barangay clearance fee</small>
            <strong>{clearance.feeLabel}</strong>
          </div>
          <button
            type="button"
            data-cuelume-toggle="page"
            disabled={paid}
            onClick={() =>
              onPay({
                serviceType: "barangay-clearance",
                serviceLabel: "Barangay Business Clearance",
                proposedName: clearance.businessName,
                ownerName: clearance.ownerName,
                feeLabel: clearance.feeLabel,
                serviceReference: clearance.referenceNumber,
              })
            }
          >
            {paid ? "Paid" : "Pay with eGovPay"} <ArrowRight weight="bold" />
          </button>
        </footer>
      )}
    </article>
  );
}

export function EbplsPermitCard({
  receipt,
  paid,
  onPay,
}: {
  receipt: EbplsBusinessPermitReceipt;
  paid: boolean;
  onPay: (request: PaymentRequest) => void;
}) {
  const issued = receipt.status === "Permit issued";
  return (
    <article className={`local-permit-card ebpls ${issued ? "approved" : "payment-due"}`}>
      <header>
        <span>
          <Buildings weight="duotone" />
        </span>
        <div>
          <small>EBPLS</small>
          <strong>Mayor’s / business permit</strong>
        </div>
        <i>
          {issued ? (
            <>
              <CheckCircle weight="fill" /> Issued
            </>
          ) : (
            "Payment required"
          )}
        </i>
      </header>
      <p className="ebpls-expansion">
        <strong>Electronic Business Permits and Licensing System</strong>
        <span>
          {issued
            ? "The LGU permit has been issued electronically."
            : "The LGU assessment is complete and ready for payment."}
        </span>
      </p>
      <DetailRows
        rows={[
          ["EBPLS reference", receipt.referenceNumber],
          ["Application", receipt.permitType],
          ["Business", receipt.businessName],
          ["Location", `${receipt.barangay}, ${receipt.city}`],
          ["Barangay clearance", receipt.barangayClearanceReference],
          [
            issued ? "Valid until" : "Assessed fee",
            issued && receipt.validUntil
              ? new Date(receipt.validUntil).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : receipt.feeLabel,
          ],
        ]}
      />
      <section>
        <small>Attachments sent</small>
        <ul>
          {receipt.attachments.map((attachment) => (
            <li key={attachment}>
              <FileText /> {attachment}
            </li>
          ))}
        </ul>
      </section>
      {!issued && (
        <footer className="local-permit-payment">
          <div>
            <small>Assessed LGU fees</small>
            <strong>{receipt.feeLabel}</strong>
          </div>
          <button
            type="button"
            disabled={paid}
            onClick={() =>
              onPay({
                serviceType: "ebpls-business-permit",
                serviceLabel: "EBPLS Mayor’s / Business Permit",
                proposedName: receipt.businessName,
                ownerName: receipt.ownerName,
                feeLabel: receipt.feeLabel,
                serviceReference: receipt.referenceNumber,
              })
            }
          >
            {paid ? "Paid" : "Pay with eGovPay"} <ArrowRight weight="bold" />
          </button>
        </footer>
      )}
      <footer>
        <CircleNotch />
        <span>
          <small>NEXT</small>
          <strong>{receipt.nextAction}</strong>
        </span>
      </footer>
    </article>
  );
}

function Markdown({ children, streaming = false }: { children: string; streaming?: boolean }) {
  return (
    <Streamdown controls={false} isAnimating={streaming} mode={streaming ? "streaming" : "static"}>
      {children}
    </Streamdown>
  );
}

function latestRegistrationPlan(messages: BusinessChatMessage[]) {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (part.type !== "tool-updatePlan") continue;
      if (part.state === "output-available") return { plan: part.output.plan, active: false };
      if (part.state === "input-available")
        return { plan: { title: part.input.title, steps: part.input.steps }, active: true };
    }
  return null;
}

function PlanDock({
  plan,
  active,
  collapseKey,
}: {
  plan: RegistrationPlan;
  active: boolean;
  // Tool call id of the question currently being asked, if any. The dock and
  // the question form are siblings inside .chat-composer-shell, which caps at
  // min(76dvh, 680px) — so an expanded plan (list capped at min(28dvh, 260px))
  // eats height the question then can't have, and the composer clips it.
  // Yielding on each new question keeps the task visible; the user can reopen
  // the plan and it stays open until the next one arrives.
  collapseKey?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (collapseKey) setExpanded(false);
  }, [collapseKey]);
  const completed = plan.steps.filter((step) => step.status === "completed").length;
  const allResolved =
    plan.steps.length > 0 &&
    plan.steps.every((step) => step.status === "completed" || step.status === "skipped");
  const current =
    plan.steps.find((step) => step.status === "in_progress") ??
    plan.steps.find((step) => step.status === "pending") ??
    plan.steps.at(-1);
  const currentLabel = allResolved
    ? "Registration plan complete"
    : (current?.label ?? "Preparing your registration plan");

  return (
    <Card
      role="region"
      aria-label="Registration plan"
      className={cn(
        "min-w-0 shadow-xs",
        active ? "border-primary-border-strong" : "border-gray-300",
      )}
    >
      <button
        className="grid min-h-[54px] w-full grid-cols-[32px_minmax(0,1fr)_auto_20px] items-center gap-2 bg-white px-2.5 py-2 text-left hover:bg-gray-50"
        data-cuelume-toggle={expanded ? "droplet" : "bloom"}
        type="button"
        aria-expanded={expanded}
        aria-controls="registration-plan-items"
        onClick={() => setExpanded((open) => !open)}
      >
        <span
          className={cn(
            "grid size-8 place-items-center rounded-md",
            allResolved || current?.status === "completed"
              ? "bg-success text-white"
              : current?.status === "in_progress"
                ? "bg-secondary text-primary"
                : "bg-muted text-muted-foreground",
          )}
        >
          {allResolved || current?.status === "completed" ? (
            <CheckIcon className="size-4" weight="bold" />
          ) : current?.status === "in_progress" ? (
            <PulseDot className="size-4" />
          ) : (
            <ListChecksIcon className="size-4" weight="duotone" />
          )}
        </span>
        <span className="grid min-w-0 gap-0.5">
          <small className="text-xs font-bold text-muted-foreground">
            {expanded ? "Registration plan" : "Current task"}
          </small>
          <strong className="truncate text-xs leading-[1.35]">
            {expanded ? plan.title : currentLabel}
          </strong>
        </span>
        <span
          className="rounded-sm bg-muted px-[7px] py-1 text-2xs font-extrabold tabular-nums text-muted-foreground"
          aria-label={`${completed} of ${plan.steps.length} tasks completed`}
        >
          {completed}/{plan.steps.length}
        </span>
        <CaretDownIcon
          className={cn(
            "size-[15px] text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
          weight="bold"
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        id="registration-plan-items"
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <ol className="m-0 max-h-[min(28dvh,260px)] list-none overflow-y-auto border-t border-gray-200 px-2.5 pt-[5px] pb-2">
            {plan.steps.map((step, index) => {
              const finishLine = index === plan.steps.length - 1;
              return (
                <li
                  className={cn(
                    "grid min-h-9 grid-cols-[22px_minmax(0,1fr)] items-start gap-2 py-1.5 text-xs leading-[1.4]",
                    step.status === "in_progress"
                      ? "font-extrabold text-foreground"
                      : step.status === "completed"
                        ? "text-gray-800"
                        : step.status === "skipped"
                          ? "text-gray-500"
                          : "text-gray-700",
                  )}
                  key={step.id}
                  aria-current={step.status === "in_progress" ? "step" : undefined}
                  aria-label={step.status === "skipped" ? `${step.label} — skipped` : undefined}
                >
                  <span
                    className={cn(
                      "grid size-[18px] place-items-center rounded-sm border-[1.5px]",
                      finishLine
                        ? "border-0 bg-transparent"
                        : step.status === "completed"
                          ? "border-success bg-success text-white"
                          : step.status === "in_progress"
                            ? "border-primary-border-strong bg-secondary text-primary"
                            : step.status === "skipped"
                              ? "border-gray-300 bg-gray-100 text-gray-600"
                              : "border-gray-400 bg-white text-white",
                    )}
                    aria-hidden="true"
                  >
                    {step.status === "skipped" ? (
                      <MinusIcon className="size-[11px]" weight="bold" />
                    ) : finishLine ? (
                      <FlagCheckeredIcon
                        className={cn(
                          "size-[17px]",
                          step.status === "completed"
                            ? "text-success"
                            : step.status === "in_progress"
                              ? "text-primary"
                              : "text-gray-600",
                        )}
                        weight={step.status === "completed" ? "fill" : "duotone"}
                      />
                    ) : step.status === "completed" ? (
                      <CheckIcon className="size-[11px]" weight="bold" />
                    ) : step.status === "in_progress" ? (
                      <PulseDot className="size-[11px]" />
                    ) : null}
                  </span>
                  <span>
                    {step.label}
                    {step.status === "skipped" && (
                      <small className="italic text-gray-500"> (skipped)</small>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Card>
  );
}

function QuestionComposer({
  pending,
  disabled,
  onAnswer,
}: {
  pending: PendingQuestion;
  disabled: boolean;
  onAnswer: (answers: { questionId: string; value: string | string[]; labels: string[] }[]) => void;
}) {
  const [values, setValues] = useState<Record<string, string | string[]>>(() =>
    Object.fromEntries(
      pending.questions.map((question) => [question.id, question.type === "multi" ? [] : ""]),
    ),
  );
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const question = pending.questions[questionIndex];
  const complete = (question: IntakeQuestion) => {
    const value = values[question.id];
    const text =
      question.type === "single" && value === "__other__"
        ? (custom[question.id]?.trim() ?? "")
        : Array.isArray(value)
          ? value.join(" ")
          : (value?.trim() ?? "");
    if (!text) return false;
    if (question.id === "proposed-business-name") return text.length >= 3;
    if (question.id !== "business-address") return true;
    const hasAddressMarker =
      /\b(?:\d{1,5}|unit|room|floor|block|lot|house|street|st\.?|road|rd\.?|avenue|ave\.?|drive|highway|building|bldg\.?|plaza|village|subdivision|purok|sitio|poblacion|barangay|brgy\.?)\b/i.test(
        text,
      );
    return (
      text.length >= 10 && hasAddressMarker && (text.includes(",") || text.split(/\s+/).length >= 4)
    );
  };

  const canContinue = complete(question);
  const lastQuestion = questionIndex === pending.questions.length - 1;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canContinue || disabled) return;
    if (!lastQuestion) {
      play("page");
      setQuestionIndex((current) => current + 1);
      return;
    }
    onAnswer(
      pending.questions.map((question) => {
        const selected = values[question.id];
        const value = selected === "__other__" ? custom[question.id].trim() : selected;
        const items = Array.isArray(value) ? value : [value];
        return {
          questionId: question.id,
          value,
          labels: items.map(
            (item) => question.options?.find((option) => option.id === item)?.label ?? item,
          ),
        };
      }),
    );
  };

  return (
    <form className="grid min-h-0 gap-4 overflow-y-auto pt-1 pr-1" onSubmit={submit}>
      <div className="flex items-start gap-2">
        <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-secondary text-primary">
          <SparkleIcon className="size-[13px]" weight="fill" />
        </span>
        <div className="grid gap-1">
          {pending.questions.length > 1 && (
            <small className="text-xs font-bold text-muted-foreground">
              Question {questionIndex + 1} of {pending.questions.length}
            </small>
          )}
          {/* The one thing the user has to act on. --text-md is in the scale
              and was never used here, so the question sat at the same size as
              its own help text. */}
          <strong className="text-md font-extrabold leading-[1.25]">{question.title}</strong>
          {question.helpText && (
            <small className="text-xs leading-[1.35] text-muted-foreground">
              {question.helpText}
            </small>
          )}
        </div>
      </div>
      {(() => {
        const value = values[question.id];
        const selected = Array.isArray(value) ? value : value ? [value] : [];
        const enteredText = typeof value === "string" ? value.trim() : "";
        const options =
          question.type === "single"
            ? [
                ...(question.options ?? []),
                {
                  id: "__other__",
                  label: "Other — type your answer",
                  description: "Enter a different answer",
                },
              ]
            : (question.options ?? []);
        // p-3 with a 13px label puts the row at ~46px, over the 44pt tap-target
        // floor it used to sit under. border-2 and the 900 label are what make
        // a selected row read as chosen at a glance — the fill alone doesn't.
        const optionCard = (checked: boolean) =>
          cn(
            "flex cursor-pointer items-center gap-2.5 rounded-md border-2 p-3 transition-colors",
            checked
              ? "border-primary bg-secondary"
              : "border-input bg-white hover:border-primary/40",
          );
        const optionCopy = (label: string, description?: string, checked?: boolean) => (
          <span className="grid gap-0.5">
            <strong className={cn("text-sm leading-[1.3]", checked && "font-black")}>
              {label}
            </strong>
            {description && (
              <small className="text-xs leading-[1.25] text-muted-foreground">{description}</small>
            )}
          </span>
        );
        return (
          <section className="grid gap-3" key={question.id}>
            {question.type === "single" ? (
              <>
                <RadioGroup
                  className="gap-2"
                  aria-label={question.title}
                  value={typeof value === "string" ? value : ""}
                  onValueChange={(next) =>
                    setValues((current) => ({ ...current, [question.id]: String(next) }))
                  }
                >
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className={optionCard(value === option.id)}
                      data-cuelume-toggle="toggle"
                    >
                      <RadioGroupItem value={option.id} />
                      {optionCopy(option.label, option.description, value === option.id)}
                    </label>
                  ))}
                </RadioGroup>
                {value === "__other__" && (
                  <div className="grid gap-1.5">
                    <FieldLabel className="mb-0">Your answer</FieldLabel>
                    <Input
                      value={custom[question.id] ?? ""}
                      onChange={(event) =>
                        setCustom((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                      placeholder="Type your answer"
                      autoFocus
                    />
                  </div>
                )}
              </>
            ) : question.type === "multi" ? (
              <div className="grid gap-2" role="group" aria-label={question.title}>
                {options.map((option) => {
                  const checked = selected.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={optionCard(checked)}
                      data-cuelume-toggle="toggle"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setValues((current) => ({
                            ...current,
                            [question.id]: checked
                              ? selected.filter((id) => id !== option.id)
                              : [...selected, option.id],
                          }))
                        }
                      />
                      {optionCopy(option.label, option.description, checked)}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-1.5">
                <FieldLabel className="mb-0">Your answer</FieldLabel>
                <Input
                  type={question.type === "number" ? "number" : "text"}
                  min={question.minimum}
                  max={question.maximum}
                  placeholder={question.placeholder ?? "Type your answer"}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [question.id]: event.target.value }))
                  }
                  error={Boolean(enteredText && !complete(question))}
                  autoFocus
                />
                {enteredText && !complete(question) && (
                  <FieldHint error role="alert" className="mt-0">
                    {question.id === "business-address"
                      ? "Enter the full street, building, or unit and barangay."
                      : "Enter the complete proposed business name."}
                  </FieldHint>
                )}
              </div>
            )}
          </section>
        );
      })()}
      <div className="flex items-center gap-2">
        {questionIndex > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuestionIndex((current) => current - 1)}
            disabled={disabled}
          >
            <ArrowLeft /> Back
          </Button>
        )}
        {/* flex-1 rather than `block`: block is w-full, and Button's base
            carries shrink-0, so beside the Back button it demanded 100% of the
            row and ran off the right edge. `shrink` comes last so twMerge drops
            the shrink-0. */}
        <Button className="min-w-0 flex-1 shrink" type="submit" disabled={!canContinue || disabled}>
          {lastQuestion ? "Continue" : "Next question"} <ArrowRightIcon weight="bold" />
        </Button>
      </div>
    </form>
  );
}

function AgentDot() {
  return (
    <span
      className="mt-px grid size-7 flex-none place-items-center rounded-full bg-primary text-white"
      aria-hidden="true"
    >
      <SparkleIcon className="size-[13px]" weight="fill" />
    </span>
  );
}

function SearchTool({
  part,
}: {
  part: Extract<BusinessChatMessage["parts"][number], { type: "tool-webSearch" }>;
}) {
  const complete = part.state === "output-available";
  const failed = part.state === "output-error";
  return (
    <div className="grid w-full grid-cols-[22px_1fr_16px] items-center gap-2 rounded-lg border border-border bg-card px-[11px] py-2.5 text-xs text-muted-foreground">
      {complete ? (
        <CheckCircleIcon className="size-4 text-success" weight="fill" />
      ) : failed ? (
        <XIcon className="size-4 text-destructive" />
      ) : (
        <MagnifyingGlassIcon className="size-4 text-primary" />
      )}
      <div className="grid min-w-0 gap-0.5">
        <small className="text-xs font-bold text-muted-foreground">
          {complete
            ? "Searched official sources"
            : failed
              ? "Search unavailable"
              : "Searching official sources"}
        </small>
        {"input" in part && part.input && (
          <span className={cn("truncate", !complete && !failed && "chat-shimmer")}>
            {part.input.query}
          </span>
        )}
      </div>
      <GlobeHemisphereWestIcon className="size-4 text-primary" />
    </div>
  );
}

export function DtiFormCard({
  form,
  note,
  paid,
  onSubmitPay,
}: {
  form: DtiBusinessNameForm;
  note?: string;
  paid: boolean;
  onSubmitPay: () => void;
}) {
  const rows = [
    ["Proposed business name", form.proposedName || "Needs your answer"],
    ["Business activity", form.businessActivity],
    ["Territorial scope", form.territorialScope],
    ["Owner", form.ownerName],
    [
      "Business address",
      `${form.businessAddress}${form.city && !form.businessAddress.includes(form.city) ? `, ${form.city}` : ""}`,
    ],
  ];
  if (form.missingFields.length || rows.some(([, value]) => !value)) return null;
  return (
    <Card className="w-full">
      <div className="grid grid-cols-[39px_1fr_auto] items-center gap-[9px] border-b border-gray-200 p-[13px]">
        <span className="grid size-[39px] place-items-center rounded-full bg-primary-ink text-xs font-black text-white">
          DTI
        </span>
        <div className="grid gap-0.5">
          <small className="text-xs font-bold text-muted-foreground">
            Business name registration
          </small>
          <strong className="text-base">Application draft</strong>
        </div>
        <Badge variant="success">{paid ? "Paid" : "Ready"}</Badge>
      </div>
      {note && (
        <p className="m-0 flex gap-1.5 bg-secondary px-[13px] py-[9px] text-xs text-gray-800">
          <PencilSimpleIcon className="size-[13px] flex-none" /> {note}
        </p>
      )}
      <div className="px-[13px] py-0.5">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              "grid gap-[3px] py-2.5",
              index < rows.length - 1 && "border-b border-line-soft",
            )}
          >
            <span className="text-2xs font-bold text-muted-foreground">{label}</span>
            <strong className="text-xs leading-[1.35]">{value}</strong>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mx-[13px] mt-[5px] mb-3 flex gap-[7px] rounded-md p-[9px] text-xs leading-[1.4]",
          paid ? "bg-success-soft text-success-ink" : "bg-muted text-gray-800",
        )}
      >
        <InfoIcon className="size-[13px] flex-none text-primary" weight="fill" />
        <span>
          {paid
            ? "Payment recorded. This application checkpoint is complete."
            : "To change anything, type it below. For example: “Use the name Reyes Coffee Club.”"}
        </span>
      </div>
      <div className="grid gap-[9px] border-t border-gray-200 px-[13px] pt-[11px] pb-[13px]">
        <div className="flex items-center justify-between gap-2.5">
          <small className="text-2xs font-extrabold text-muted-foreground">Payment</small>
          <strong className="text-xs tabular-nums">{form.feeLabel}</strong>
        </div>
        <Button
          block
          data-cuelume-toggle="bloom"
          onClick={onSubmitPay}
          disabled={paid}
          className={cn(
            paid && "bg-[var(--success-soft)] text-success shadow-none disabled:opacity-100",
          )}
        >
          {paid ? (
            <>
              <CheckCircleIcon weight="fill" /> Paid
            </>
          ) : (
            <>
              Submit and pay <ArrowRightIcon weight="bold" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function BirFormArtifactCard({
  artifact,
  onPreview,
}: {
  artifact: BirFormArtifact;
  onPreview: () => void;
}) {
  return (
    <button
      className="pdf-artifact-card"
      data-cuelume-toggle="page"
      type="button"
      onClick={onPreview}
    >
      <span className="pdf-artifact-icon">
        <FilePdf weight="fill" />
      </span>
      <span className="pdf-artifact-copy">
        <small>PDF artifact</small>
        <strong>BIR Form 1901</strong>
        <span>
          {artifact.pageCount} pages · {Math.max(1, Math.round(artifact.size / 1024))} KB
        </span>
      </span>
      <span className="pdf-artifact-action">
        Preview <ArrowRight weight="bold" />
      </span>
    </button>
  );
}

function ToolPart({
  part,
  paidServices,
  onSubmitPay,
  onPreviewPdf,
}: {
  part: BusinessChatMessage["parts"][number];
  paidServices: Set<PaymentServiceType>;
  onSubmitPay: (request: PaymentRequest) => void;
  onPreviewPdf: (artifact: BirFormArtifact) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  if (name === "askUser") return null;
  if (part.type === "tool-user_info")
    return (
      <div className={`chat-tool-row ${part.state === "output-available" ? "complete" : "active"}`}>
        {part.state === "output-available" ? (
          <ShieldCheck weight="fill" />
        ) : (
          <CircleNotch className="spin" />
        )}
        <div>
          <small>
            {part.state === "output-available" ? "Verified profile ready" : "Loading eGov profile"}
          </small>
          <span>Private identity data stays inside this authenticated session</span>
        </div>
        <ShieldCheck />
      </div>
    );
  if (part.type === "tool-generate_bir_form") {
    if (part.state === "output-available")
      return (
        <BirFormArtifactCard
          artifact={part.output.artifact}
          onPreview={() => onPreviewPdf(part.output.artifact)}
        />
      );
    if (part.state === "output-error")
      return (
        <div className="chat-tool-row error">
          <X />
          <div>
            <small>PDF generation failed</small>
            <span>Try asking me to generate the BIR form again</span>
          </div>
          <FilePdf />
        </div>
      );
    return (
      <div className="chat-tool-row active">
        <CircleNotch className="spin" />
        <div>
          <small>Generating BIR Form 1901</small>
          <span className="chat-shimmer">Prefilling the authenticated profile</span>
        </div>
        <FilePdf />
      </div>
    );
  }
  if (part.type === "tool-setupBooksAndInvoices") {
    if (part.state !== "output-available")
      return (
        <div className="chat-tool-row active">
          <CircleNotch className="spin" />
          <div>
            <small>Setting up books and invoices</small>
            <span className="chat-shimmer">Preparing mock accounting records</span>
          </div>
          <FileText />
        </div>
      );
    return (
      <ComplianceResultCard
        title="Books and invoices set up"
        subtitle="Accounting books and sample invoice controls are ready"
        records={part.output.records}
      />
    );
  }
  if (part.type === "tool-prepareSelfEmployedRegistration") {
    if (part.state !== "output-available")
      return (
        <div className="chat-tool-row active">
          <CircleNotch className="spin" />
          <div>
            <small>Preparing self-employed registration</small>
            <span className="chat-shimmer">Matching the BIR route and RDO</span>
          </div>
          <FileText />
        </div>
      );
    return (
      <article className="self-employed-setup-card">
        <header>
          <span>
            <FileText weight="duotone" />
          </span>
          <div>
            <small>BIR registration checkpoint</small>
            <strong>{part.output.status}</strong>
          </div>
          <i>Prepared</i>
        </header>
        <DetailRows
          rows={[
            ["Taxpayer", part.output.taxpayerName],
            ["Activity", part.output.professionalActivity],
            ["Business city", part.output.businessCity],
            ["RDO", part.output.rdo],
            ["Address source", part.output.addressSource],
          ]}
        />
        <footer>{part.output.nextAction}</footer>
      </article>
    );
  }
  if (part.type === "tool-setupTaxCompliance") {
    if (part.state !== "output-available")
      return (
        <div className="chat-tool-row active">
          <CircleNotch className="spin" />
          <div>
            <small>Setting up recurring tax filings</small>
            <span className="chat-shimmer">Building the mock BIR filing calendar</span>
          </div>
          <CalendarDots />
        </div>
      );
    return (
      <ComplianceResultCard
        title="Tax calendar set up"
        subtitle="BIR registration and recurring filing reminders"
        records={part.output.records}
        obligations={part.output.obligations}
      />
    );
  }
  if (part.type === "tool-completeSectorPermits") {
    if (part.state !== "output-available") return null;
    return (
      <ComplianceResultCard
        title="Sector checks resolved"
        subtitle="Food, fire, sanitary, and sector requirements"
        records={part.output.records}
      />
    );
  }
  if (part.type === "tool-registerEmployerAgencies") {
    if (part.state !== "output-available") return null;
    return (
      <ComplianceResultCard
        title="Employer registrations resolved"
        subtitle="SSS, PhilHealth, and Pag-IBIG applicability"
        records={part.output.records}
      />
    );
  }
  if (part.type === "tool-finalizeBusinessRegistration") {
    if (part.state !== "output-available") return null;
    return (
      <a
        className="business-finalized-card"
        data-cuelume-toggle="page"
        href={`/?business=${part.output.businessId}`}
      >
        <span>
          <Storefront weight="duotone" />
        </span>
        <div>
          <small>All set up</small>
          <strong>{part.output.businessName}</strong>
          <p>Open records and tax calendar</p>
        </div>
        <ArrowRight weight="bold" />
      </a>
    );
  }
  if (part.type === "tool-webSearch") return <SearchTool part={part} />;
  if (part.type === "tool-updatePlan") return null;
  if (part.type === "tool-editDtiBusinessNameForm") {
    if (part.state === "output-available")
      return (
        <DtiFormCard
          form={part.output.form}
          note={part.input.note}
          paid={paidServices.has("dti-business-name")}
          onSubmitPay={() =>
            onSubmitPay({
              serviceType: "dti-business-name",
              serviceLabel: "DTI Business Name Registration",
              proposedName: part.output.form.proposedName,
              ownerName: part.output.form.ownerName,
              feeLabel: part.output.form.feeLabel,
              territorialScope: part.output.form.territorialScope,
            })
          }
        />
      );
    return (
      <div className="chat-tool-row active">
        <CircleNotch className="spin" />
        <div>
          <small>Updating application</small>
          <span className="chat-shimmer">Preparing your DTI form</span>
        </div>
        <PencilSimple />
      </div>
    );
  }
  if (part.type === "tool-submitBarangayClearance") {
    if (part.state === "output-available")
      return (
        <BarangayClearanceCard
          clearance={part.output.clearance}
          paid={paidServices.has("barangay-clearance")}
          onPay={onSubmitPay}
        />
      );
    const barangay = "input" in part && part.input?.application?.barangay;
    return (
      <div className="local-permit-processing" role="status">
        <span>
          <CircleNotch className="spin" />
        </span>
        <div>
          <small>Electronic barangay clearance</small>
          <strong>Submitting{barangay ? ` to ${barangay}` : ""}…</strong>
          <em>Checking registration and business-address documents</em>
        </div>
      </div>
    );
  }
  if (part.type === "tool-submitEbplsBusinessPermit") {
    if (part.state === "output-available")
      return (
        <EbplsPermitCard
          receipt={part.output.receipt}
          paid={paidServices.has("ebpls-business-permit")}
          onPay={onSubmitPay}
        />
      );
    return (
      <div className="local-permit-processing ebpls" role="status">
        <span>
          <CircleNotch className="spin" />
        </span>
        <div>
          <small>EBPLS · Electronic Business Permits and Licensing System</small>
          <strong>LGU assessment in progress…</strong>
          <em>
            Validating the application, approved barangay clearance, and submitted attachments
          </em>
        </div>
      </div>
    );
  }
  return (
    <div className="chat-tool-row active">
      <CircleNotch className="spin" />
      <div>
        <small>Working</small>
        <span>{name}</span>
      </div>
    </div>
  );
}

export function PaymentDialog({
  payment,
  conversationId,
  onClose,
}: {
  payment: PaymentRequest;
  conversationId: string;
  onClose: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const openCheckout = async () => {
    play("loading");
    setOpening(true);
    setPaymentError("");
    try {
      const response = await fetch("/api/payments/egovpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          serviceType: payment.serviceType,
          proposedName: payment.proposedName,
          ...(payment.territorialScope ? { territorialScope: payment.territorialScope } : {}),
          ...(payment.serviceReference ? { serviceReference: payment.serviceReference } : {}),
        }),
      });
      const result = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
        payment?: { status?: string };
      };
      if (!response.ok || !result.checkoutUrl)
        throw new Error(result.error || "eGovPay could not open checkout.");
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      play("error");
      setPaymentError(error instanceof Error ? error.message : "eGovPay could not open checkout.");
      setOpening(false);
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <div className="flex flex-col items-center text-center">
          <span className="mb-2 grid size-12 place-items-center rounded-xl bg-secondary text-primary">
            <ShieldCheck className="size-[26px]" weight="duotone" />
          </span>
          <span className="text-xs font-bold text-primary">eGovPay</span>
          <DialogTitle className="mt-1 mb-1">Continue to secure payment</DialogTitle>
          <DialogDescription>
            You’ll continue to eGovPay in this tab. This demo will mark the fee paid while webhook
            support is being completed.
          </DialogDescription>
        </div>
        <div className="my-4 flex items-center justify-between gap-3 border-y border-border py-3">
          <span className="grid text-left">
            <small className="text-2xs text-muted-foreground">{payment.serviceLabel}</small>
            <strong className="text-xs">{payment.proposedName}</strong>
          </span>
          <strong className="text-xs tabular-nums">{payment.feeLabel}</strong>
        </div>
        {paymentError && (
          <p
            className="mb-4 rounded-md bg-destructive/10 px-2.5 py-2 text-xs leading-[1.4] text-destructive"
            role="alert"
          >
            {paymentError}
          </p>
        )}
        <Button block size="lg" onClick={openCheckout} disabled={opening}>
          <ShieldCheck weight="fill" /> {opening ? "Preparing checkout…" : "Continue to eGovPay"}
        </Button>
        <p className="mt-2 text-center text-2xs text-muted-foreground">
          Use “Back to merchant” after checkout to return to this saved chat.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function PdfPreviewDialog({
  artifact,
  onClose,
}: {
  artifact: BirFormArtifact;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="chat-dialog-layer pdf-preview-layer">
      <button
        className="chat-dialog-scrim"
        data-cuelume-toggle="droplet"
        onClick={onClose}
        aria-label="Close PDF preview"
      />
      <section
        className="pdf-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-preview-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header>
          <span>
            <FilePdf weight="fill" />
          </span>
          <div>
            <small>PDF preview</small>
            <h2 id="pdf-preview-title">BIR Form 1901</h2>
          </div>
          <button
            className="chat-dialog-close"
            data-cuelume-toggle="droplet"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </button>
        </header>
        <iframe src={artifact.url} title="BIR Form 1901 PDF preview" />
        <footer>
          <a data-cuelume-toggle="success" href={artifact.url} download={artifact.filename}>
            <DownloadSimple weight="bold" /> Download PDF
          </a>
          <a data-cuelume-toggle="page" href={artifact.url} target="_blank" rel="noreferrer">
            <ArrowSquareOut weight="bold" /> Open full screen
          </a>
        </footer>
      </section>
    </div>
  );
}

export function BusinessChatScreen({
  conversation,
  conversations,
  paymentStatus,
  paymentService,
  onBack,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}: {
  conversation: BusinessConversation;
  conversations: ConversationSummary[];
  profile: CitizenProfile | null;
  paymentStatus?: string | null;
  paymentService?: PaymentServiceType | null;
  onBack: () => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (conversation: ConversationSummary) => void;
}) {
  const [input, setInput] = useState("");
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [pdfArtifact, setPdfArtifact] = useState<BirFormArtifact | null>(null);
  const [localPaymentStatus, setLocalPaymentStatus] = useState(
    paymentStatus ?? conversation.paymentStatus ?? null,
  );
  const [localPaymentStatuses, setLocalPaymentStatuses] = useState(
    conversation.paymentStatuses ?? {},
  );
  const [continuationError, setContinuationError] = useState("");
  const [answeringToolCallId, setAnsweringToolCallId] = useState<string | null>(null);
  const answeredToolCalls = useRef(new Set<string>());
  const continuedPayment = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const initialPrompt = conversation.initialPrompt;
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/agent/chat", body: { initialPrompt } }),
    [initialPrompt],
  );
  const initialMessages = useMemo(
    () => uniqueMessagesById(conversation.messages),
    [conversation.messages],
  );
  const { messages, setMessages, sendMessage, resumeStream, status, stop, error, addToolOutput } =
    useChat<BusinessChatMessage>({
      id: conversation.id,
      messages: initialMessages,
      transport,
      resume: false,
    });
  const visibleMessages = useMemo(() => uniqueMessagesById(messages), [messages]);
  const busy = status === "submitted" || status === "streaming";
  const paid = /paid|success|complete/i.test(localPaymentStatus ?? "");
  const paidServices = useMemo(
    () =>
      new Set(
        (Object.entries(localPaymentStatuses) as [PaymentServiceType, string][])
          .filter(([, value]) => /paid|success|complete/i.test(value))
          .map(([service]) => service),
      ),
    [localPaymentStatuses],
  );
  const latestPlan = latestRegistrationPlan(visibleMessages);
  const registrationFinalized = visibleMessages.some((message) =>
    message.parts.some(
      (part) =>
        part.type === "tool-finalizeBusinessRegistration" && part.state === "output-available",
    ),
  );
  const completedPlanSteps =
    latestPlan?.plan.steps.filter((step) => step.status === "completed").length ?? 0;
  const previousStatus = useRef(status);
  const previousCompletedPlanSteps = useRef(completedPlanSteps);
  const wasRegistrationFinalized = useRef(registrationFinalized);
  const hadError = useRef(Boolean(error));
  const pending: PendingQuestion | null = (() => {
    for (const message of [...visibleMessages].reverse()) {
      for (const part of [...message.parts].reverse()) {
        if (part.type === "tool-askUser" && part.state === "input-available") {
          const current = part as ReadyAskUserPart;
          return {
            part: current,
            questions:
              current.input.questions ?? (current.input.question ? [current.input.question] : []),
          };
        }
      }
    }
    return null;
  })();

  useEffect(() => {
    // Reconnect and initial seeding are mutually exclusive. A persisted active
    // stream already contains the response to the user's latest message.
    if (seeded.current) return;
    seeded.current = true;
    if (conversation.activeStreamId) {
      void resumeStream().finally(() => setMessages((current) => uniqueMessagesById(current)));
    } else if (initialMessages.length === 0) {
      void sendMessage({ text: initialPrompt });
    }
  }, [
    conversation.activeStreamId,
    initialMessages.length,
    initialPrompt,
    resumeStream,
    sendMessage,
    setMessages,
  ]);
  useEffect(() => {
    if (messages.length !== visibleMessages.length) setMessages(visibleMessages);
  }, [messages.length, setMessages, visibleMessages]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleMessages, pending, status]);
  useEffect(() => {
    const previous = previousStatus.current;
    if (status === "submitted" && previous !== "submitted") play("loading");
    if (
      status === "ready" &&
      (previous === "submitted" || previous === "streaming") &&
      !registrationFinalized &&
      completedPlanSteps <= previousCompletedPlanSteps.current &&
      !error &&
      !continuationError
    )
      play("ready");
    previousStatus.current = status;
  }, [completedPlanSteps, continuationError, error, registrationFinalized, status]);
  useEffect(() => {
    if (completedPlanSteps > previousCompletedPlanSteps.current && !registrationFinalized)
      play("success");
    previousCompletedPlanSteps.current = completedPlanSteps;
  }, [completedPlanSteps, registrationFinalized]);
  useEffect(() => {
    if (registrationFinalized && !wasRegistrationFinalized.current) play("success");
    wasRegistrationFinalized.current = registrationFinalized;
  }, [registrationFinalized]);
  useEffect(() => {
    const failed = Boolean(error || continuationError);
    if (failed && !hadError.current) play("error");
    hadError.current = failed;
  }, [continuationError, error]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || pending) return;
    setInput("");
    void sendMessage({ text });
  };
  const answer = async (
    answers: { questionId: string; value: string | string[]; labels: string[] }[],
  ) => {
    if (!pending || answeredToolCalls.current.has(pending.part.toolCallId)) return;
    const toolCallId = pending.part.toolCallId;
    answeredToolCalls.current.add(toolCallId);
    setAnsweringToolCallId(toolCallId);
    try {
      await addToolOutput({ tool: "askUser", toolCallId, output: { answers } });
      await sendMessage();
    } catch {
      answeredToolCalls.current.delete(toolCallId);
    } finally {
      setAnsweringToolCallId(null);
    }
  };
  const continueAfterPayment = async (serviceType: PaymentServiceType = "dti-business-name") => {
    if (serviceType === "dti-business-name") setLocalPaymentStatus("paid");
    setLocalPaymentStatuses((current) => ({ ...current, [serviceType]: "paid" }));
    setContinuationError("");
    try {
      // Add a non-visual event message so useChat always starts a new request.
      // Calling sendMessage() without a message can be ignored after a completed
      // assistant turn by some chat-state transitions.
      await sendMessage(
        {
          role: "user",
          parts: [{ type: "data-paymentCompleted", data: { status: "paid", serviceType } }],
        },
        { body: { event: "payment-completed", paymentService: serviceType } },
      );
    } catch {
      setContinuationError("Payment is saved, but I couldn’t start the next step automatically.");
    }
  };

  useEffect(() => {
    if (!paymentService || !/paid|success|complete/i.test(paymentStatus ?? "")) return;
    const continuationKey = `${conversation.id}:${paymentService}`;
    if (continuedPayment.current === continuationKey) return;
    continuedPayment.current = continuationKey;
    void continueAfterPayment(paymentService);
  }, [conversation.id, paymentService, paymentStatus]);

  return (
    <div className="screen agent-chat-screen">
      {registrationFinalized && <CompletionConfetti />}
      <StatusBar />
      <header className="chat-header">
        <button data-cuelume-toggle="page" onClick={onBack} aria-label="Go back">
          <ArrowLeft />
        </button>
        <div className="chat-agent-avatar">
          <Headset weight="fill" />
        </div>
        <button
          className="chat-session-trigger"
          data-cuelume-toggle={historyOpen ? "droplet" : "bloom"}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <span>
            <h1>{conversation.title}</h1>
            <small>
              <ShieldCheck weight="fill" /> Saved registration plan
            </small>
          </span>
          <CaretDown />
        </button>
        <button
          className="chat-new-session"
          data-cuelume-toggle="page"
          onClick={onNewConversation}
          aria-label="Create a new registration plan"
        >
          <Plus />
        </button>
        {historyOpen && (
          <div className="chat-session-menu">
            {conversations.map((item) => (
              <div
                className={`chat-session-row ${item.id === conversation.id ? "active" : ""}`}
                key={item.id}
              >
                <button
                  className="chat-session-open"
                  data-cuelume-toggle="page"
                  onClick={() => {
                    setHistoryOpen(false);
                    onSelectConversation(item.id);
                  }}
                >
                  {item.title}
                </button>
                <button
                  className="chat-session-delete"
                  data-cuelume-toggle="droplet"
                  onClick={() => onDeleteConversation(item)}
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash />
                </button>
              </div>
            ))}
          </div>
        )}
      </header>
      <main className="chat-thread" ref={scrollRef} id="app-content">
        {localPaymentStatus && (
          <div className={`payment-return ${paid ? "success" : "pending"}`}>
            <CheckCircle weight="fill" />
            <span>
              <strong>{paid ? "Payment confirmed" : "Payment status updated"}</strong>
              <small>
                {paid
                  ? "Your saved workflow is advancing to the next service."
                  : `Status: ${localPaymentStatus}. You can continue in this saved chat.`}
              </small>
            </span>
          </div>
        )}
        <div className="chat-day">Saved automatically</div>
        {visibleMessages.map((message) => {
          const user = message.role === "user";
          const text = textOf(message);
          const hasVisibleTool = message.parts.some(
            (part) =>
              isToolUIPart(part) &&
              getToolName(part) !== "askUser" &&
              part.type !== "tool-updatePlan",
          );
          if (!text && !hasVisibleTool) return null;
          const streaming = busy && message.id === visibleMessages.at(-1)?.id;
          return (
            <article className={`chat-message ${user ? "user" : "assistant"}`} key={message.id}>
              {!user && <AgentDot />}
              <div className="message-content">
                {text &&
                  (user ? (
                    <div className="message-bubble">
                      <Markdown>{text}</Markdown>
                    </div>
                  ) : (
                    <div className="assistant-prose">
                      <Markdown streaming={streaming}>{text}</Markdown>
                    </div>
                  ))}
                {message.parts.map((part, index) =>
                  isToolUIPart(part) ? (
                    <ToolPart
                      key={`${message.id}-${index}`}
                      part={part}
                      paidServices={paidServices}
                      onSubmitPay={setPaymentRequest}
                      onPreviewPdf={setPdfArtifact}
                    />
                  ) : null,
                )}
              </div>
            </article>
          );
        })}
        {busy && (
          <div className="chat-working" role="status" aria-live="polite">
            <AgentDot />
            <div className="chat-working-shimmer">Preparing your next registration step…</div>
          </div>
        )}
        {(error || continuationError) && (
          <div className="chat-error">
            {continuationError || "I couldn’t continue. Please try again."}
            {paid && (
              <button
                type="button"
                data-cuelume-toggle="loading"
                onClick={() => void continueAfterPayment(paymentService ?? "dti-business-name")}
                disabled={busy}
              >
                Continue to next step
              </button>
            )}
          </div>
        )}
      </main>
      <footer className="chat-composer-shell">
        {latestPlan && (
          <PlanDock
            plan={latestPlan.plan}
            active={latestPlan.active}
            collapseKey={pending?.part.toolCallId}
          />
        )}
        {pending ? (
          <QuestionComposer
            key={pending.part.toolCallId}
            pending={pending}
            disabled={busy || answeringToolCallId === pending.part.toolCallId}
            onAnswer={answer}
          />
        ) : (
          <form
            className="overflow-hidden rounded-xl border border-input bg-white shadow-xs transition-colors focus-within:border-primary"
            onSubmit={submit}
          >
            <textarea
              className="max-h-[100px] min-h-[44px] w-full resize-none border-0 bg-transparent px-[13px] pt-3 pb-1 text-base leading-normal text-foreground outline-none placeholder:text-gray-500"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(event);
                }
              }}
              placeholder="Ask or correct your application…"
              aria-label="Message"
            />
            <div className="flex items-center justify-between gap-2 py-1.5 pr-1.5 pl-3">
              <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                <ShieldCheck className="size-[11px] text-success" weight="fill" /> You can correct
                any field here
              </span>
              {busy ? (
                <IconButton
                  className="size-9 bg-destructive text-white hover:bg-destructive-hover"
                  data-cuelume-toggle="droplet"
                  type="button"
                  onClick={() => void stop()}
                  aria-label="Stop"
                >
                  <StopCircle className="size-[18px]" weight="fill" />
                </IconButton>
              ) : (
                <IconButton
                  variant="primary"
                  className="size-9"
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send"
                >
                  <PaperPlaneRightIcon className="size-[18px]" weight="fill" />
                </IconButton>
              )}
            </div>
          </form>
        )}
      </footer>
      {paymentRequest && (
        <PaymentDialog
          payment={paymentRequest}
          conversationId={conversation.id}
          onClose={() => setPaymentRequest(null)}
        />
      )}
      {pdfArtifact && (
        <PdfPreviewDialog artifact={pdfArtifact} onClose={() => setPdfArtifact(null)} />
      )}
    </div>
  );
}
