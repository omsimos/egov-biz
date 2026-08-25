"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightIcon,
  ArrowSquareOut,
  ArrowUpRightIcon,
  ArrowUUpLeftIcon,
  CheckCircle,
  CheckCircleIcon,
  CheckIcon,
  CalendarDotsIcon,
  CircleIcon,
  CircleNotch,
  Buildings,
  DownloadSimple,
  FilePdf,
  FileText,
  FolderOpenIcon,
  GlobeHemisphereWestIcon,
  InfoIcon,
  ListChecksIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PaperPlaneRightIcon,
  PencilSimple,
  PencilSimpleIcon,
  ShieldCheck,
  SparkleIcon,
  Storefront,
  StopCircle,
  CaretDown,
  CaretDownIcon,
  CaretUpIcon,
  Trash,
  X,
  XIcon,
} from "@phosphor-icons/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { play } from "cuelume";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { StatusBar } from "@/components/phone-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldHint } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, FOCUS_RING } from "@/lib/utils";
import { POPOVER_IN, POPOVER_OUT, SCRIM_IN, SCRIM_OUT, SHEET_IN, SHEET_OUT } from "@/lib/motion";
import type { BirFormArtifact } from "@/lib/bir-form/artifact";
import {
  isOptionalRegistrationStep,
  latestRegistrationPlan,
  planProgress,
  uniqueMessagesById,
  type BusinessChatMessage,
  type BusinessConversation,
  type ConversationSummary,
  type DtiBusinessNameForm,
  type LguPermitSummary,
  type PaymentServiceType,
  type RegistrationPlan,
} from "@/lib/business-chat";
import type { CitizenProfile } from "@/lib/citizen-profile";
import { initialIntakeQuestionValue, type IntakeQuestion } from "@/lib/questions";
import type { RegisteredBusiness } from "@/lib/registered-business";

type AskUserPart = Extract<BusinessChatMessage["parts"][number], { type: "tool-askUser" }>;
type ReadyAskUserPart = AskUserPart & {
  state: "input-available";
  input: { questions?: IntakeQuestion[]; question?: IntakeQuestion };
};
type PendingQuestion = { part: ReadyAskUserPart; questions: IntakeQuestion[] };
type IntakeOption = NonNullable<IntakeQuestion["options"]>[number];
export type PaymentRequest = {
  serviceType: PaymentServiceType;
  serviceLabel: string;
  proposedName: string;
  feeLabel: string;
  serviceReference?: string;
  /**
   * The fee broken into the lines the issuing service actually quotes, when it
   * quotes more than one. Absent means one line — never a split invented so the
   * sheet has more to show.
   */
  feeLines?: { label: string; amount: string }[];
};

function displayedIntakeOption(questionId: string, option: IntakeOption): IntakeOption {
  if (questionId !== "profile-address") return option;
  if (option.id === "use-profile-address")
    return {
      ...option,
      label: "Use my registered eGov address",
      description: "Prefill the verified address from my profile",
    };
  if (option.id === "use-different-address")
    return {
      ...option,
      label: "Use a different address",
      description: "I will enter the business address",
    };
  return option;
}

function birFormArtifactLabel(artifact: BirFormArtifact) {
  const formType =
    artifact.formType === "1905" || artifact.filename === "BIR-Form-1905.pdf" ? "1905" : "1901";
  return `BIR Form ${formType}`;
}

function textOf(message: BusinessChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
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

function BusinessFinalizedCard({
  businessId,
  businessName,
  registrationNumber,
  onOpenBusiness,
}: {
  businessId: string;
  businessName: string;
  registrationNumber: string;
  onOpenBusiness: (businessId: string) => void;
}) {
  return (
    <button
      className="business-finalized-card"
      data-cuelume-toggle="page"
      onClick={() => onOpenBusiness(businessId)}
      type="button"
    >
      <span>
        <Storefront weight="duotone" />
      </span>
      <div>
        <small>All set up</small>
        <strong>{businessName}</strong>
        <p>{registrationNumber}</p>
        <p>Open records and tax calendar</p>
      </div>
      <ArrowRight weight="bold" />
    </button>
  );
}

export function LguPermitCard({
  permit,
  paid,
  onPay,
}: {
  permit: LguPermitSummary;
  paid: boolean;
  onPay: (request: PaymentRequest) => void;
}) {
  const issued = permit.state === "COMPLETED";
  return (
    <article className={`local-permit-card ebpls ${issued ? "approved" : "payment-due"}`}>
      <header>
        <span>
          <Buildings weight="duotone" />
        </span>
        <div>
          <small>DX LGU</small>
          <strong>Business permit + barangay clearance</strong>
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
        <strong>One authoritative local-permit flow</strong>
        <span>
          {issued
            ? "DX issued both documents after verifying the eGovPay transaction."
            : "The BNRS credential passed validation and one combined LGU fee is ready."}
        </span>
      </p>
      <DetailRows
        rows={
          issued
            ? [
                ["Business", permit.businessName],
                ["Issuing city", permit.city],
                ["Business permit", permit.businessPermitNumber ?? "Issued"],
                ["Barangay clearance", permit.barangayClearanceNumber ?? "Approved"],
                [
                  "Valid until",
                  permit.validUntil
                    ? new Date(permit.validUntil).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "See issued documents",
                ],
              ]
            : [
                ["Business", permit.businessName],
                ["Issuing city", permit.city],
                ["Includes", "Business permit and barangay clearance"],
                ["Assessed fee", permit.feeLabel],
              ]
        }
      />
      {!issued && (
        <footer className="local-permit-payment">
          <div>
            <small>Combined LGU fee</small>
            <strong>{permit.feeLabel}</strong>
          </div>
          <button
            type="button"
            disabled={paid}
            onClick={() =>
              onPay({
                serviceType: "lgu-business-permit",
                serviceLabel: "DX LGU Business Permit",
                proposedName: permit.businessName,
                feeLabel: permit.feeLabel,
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

function Markdown({ children, streaming = false }: { children: string; streaming?: boolean }) {
  return (
    <Streamdown controls={false} isAnimating={streaming} mode={streaming ? "streaming" : "static"}>
      {children}
    </Streamdown>
  );
}

/**
 * The screen's one progress system, in the header. It used to be two: a
 * "Current task 0/10" dock stacked on the composer *and* a "Question 2 of 5"
 * line inside the question card, with the plan total disagreeing between
 * screens. Whichever is live gets the bar — the questions while a batch is
 * being answered, the plan the rest of the time — so there is never more than
 * one count on screen.
 */
function ProgressRow({
  completed,
  expandable,
  expanded,
  onToggle,
  total,
}: {
  completed: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  total: number;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const bar = (
    <>
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-[5px] rounded-full bg-primary transition-[width] duration-[400ms] ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="flex-none text-meta font-extrabold tabular-nums text-muted-foreground">
        {completed} of {total}
      </span>
    </>
  );
  if (!expandable)
    return (
      <div
        aria-label={`${completed} of ${total} answered`}
        className="flex items-center gap-2.5"
        role="img"
      >
        {bar}
      </div>
    );
  return (
    <button
      aria-controls="registration-plan-items"
      aria-expanded={expanded}
      className={cn("flex w-full items-center gap-2.5 rounded-md", FOCUS_RING)}
      data-cuelume-toggle={expanded ? "droplet" : "bloom"}
      onClick={onToggle}
      type="button"
    >
      {bar}
      {expanded ? (
        <CaretUpIcon className="size-3.5 flex-none text-gray-600" weight="bold" />
      ) : (
        <CaretDownIcon className="size-3.5 flex-none text-gray-600" weight="bold" />
      )}
    </button>
  );
}

/**
 * The full plan, opened from the progress row above it. Optional steps are
 * labelled rather than hidden: the count in the header covers required
 * checkpoints only, so a ten-row list against "2 of 7" has to say which three
 * rows are the difference.
 */
function PlanChecklist({ plan }: { plan: RegistrationPlan }) {
  const current =
    plan.steps.find((step) => step.status === "in_progress") ??
    plan.steps.find((step) => step.status === "pending");
  return (
    <div
      className="flex max-h-[340px] flex-col gap-0.5 overflow-y-auto border-y border-[var(--line-soft)] bg-white px-4 py-3.5"
      id="registration-plan-items"
    >
      <span className="px-0.5 pb-[9px] text-copy font-extrabold -tracking-[.3px]">
        {plan.title}
      </span>
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {plan.steps.map((step) => {
          const done = step.status === "completed";
          const skipped = step.status === "skipped";
          const now = step === current;
          return (
            <li
              aria-current={now ? "step" : undefined}
              className={cn(
                "grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-[11px] rounded-[10px] px-1 py-[9px]",
                now && "bg-[var(--gray-50)]",
              )}
              key={step.id}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-[22px] place-items-center rounded-full border-[1.5px]",
                  done
                    ? "border-success bg-success text-white"
                    : skipped
                      ? "border-gray-300 bg-gray-100 text-gray-600"
                      : now
                        ? "border-primary bg-secondary text-primary"
                        : "border-input-strong bg-white",
                )}
              >
                {done ? (
                  <CheckIcon className="size-3" weight="bold" />
                ) : skipped ? (
                  <MinusIcon className="size-[11px]" weight="bold" />
                ) : now ? (
                  <CircleIcon className="size-[7px]" weight="fill" />
                ) : null}
              </span>
              <span
                className={cn(
                  "text-copy leading-[1.35]",
                  now
                    ? "font-extrabold"
                    : done
                      ? "font-semibold text-muted-foreground"
                      : "font-semibold text-gray-600",
                )}
              >
                {step.label}
                {isOptionalRegistrationStep(step) && (
                  <small className="text-gray-500 italic"> (optional)</small>
                )}
                {skipped && <small className="text-gray-500 italic"> (skipped)</small>}
              </span>
              {now && (
                <span className="flex-none rounded-full bg-primary px-[9px] py-[3px] text-xs font-extrabold text-white">
                  Now
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * One question, as a card in the thread with its own sticky footer — not a form
 * crammed into the composer. The composer had to cap at min(76dvh, 680px) and
 * scroll itself, which is why a five-option question with help text used to
 * clip its own buttons off the bottom.
 *
 * `index` is lifted so the header can draw the count and `onValidityChange`
 * so the footer can disable Next: the bar, the question and the button have to
 * agree, and the way for them to disagree is for each to keep its own copy.
 */
function QuestionCard({
  disabled,
  index,
  onAnswer,
  onIndexChange,
  onValidityChange,
  pending,
}: {
  disabled: boolean;
  index: number;
  onAnswer: (answers: { questionId: string; value: string | string[]; labels: string[] }[]) => void;
  onIndexChange: (index: number) => void;
  onValidityChange: (valid: boolean) => void;
  pending: PendingQuestion;
}) {
  const [values, setValues] = useState<Record<string, string | string[]>>(() =>
    Object.fromEntries(
      pending.questions.map((question) => [question.id, initialIntakeQuestionValue(question)]),
    ),
  );
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [expandedOptionLists, setExpandedOptionLists] = useState<Record<string, boolean>>({});
  const question = pending.questions[index];
  const complete = (question: IntakeQuestion) => {
    const value = values[question.id];
    const text =
      question.type === "single" && value === "__other__"
        ? (custom[question.id]?.trim() ?? "")
        : Array.isArray(value)
          ? value.join(" ")
          : (value?.trim() ?? "");
    if (!text) return false;
    if (question.id === "business-dominant-name") return text.length >= 3;
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
  const lastQuestion = index === pending.questions.length - 1;
  const allAnswered = pending.questions.every(complete);
  useEffect(() => {
    onValidityChange(canContinue);
  }, [canContinue, onValidityChange]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canContinue || disabled) return;
    if (!lastQuestion) {
      play("page");
      onIndexChange(index + 1);
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
          labels: items.map((item) => {
            const option = question.options?.find((option) => option.id === item);
            return option ? displayedIntakeOption(question.id, option).label : item;
          }),
        };
      }),
    );
  };

  const value = values[question.id];
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const enteredText = Array.isArray(value) ? "" : (value?.trim() ?? "");
  const savedOptions = (question.options ?? []).map((option) =>
    displayedIntakeOption(question.id, option),
  );
  const options =
    question.type === "single" && question.allowOther !== false
      ? [
          ...savedOptions,
          {
            id: "__other__",
            label: "Other — type your answer",
            description: "Enter a different answer",
          },
        ]
      : savedOptions;
  const isDescriptorQuestion = question.id === "business-descriptor";
  const orderedOptions =
    isDescriptorQuestion && question.suggestedOptionId
      ? [
          ...options.filter((option) => option.id === question.suggestedOptionId),
          ...options.filter((option) => option.id !== question.suggestedOptionId),
        ]
      : options;
  const hasMoreDescriptorOptions = isDescriptorQuestion && orderedOptions.length > 4;
  const descriptorOptionsExpanded = Boolean(expandedOptionLists[question.id]);
  const displayedOptions =
    hasMoreDescriptorOptions && !descriptorOptionsExpanded
      ? orderedOptions.slice(0, 4)
      : orderedOptions;

  // 56px min-height and a 1.5px border, because these rows are the single
  // most-tapped control in the product — every answer the agent needs comes
  // through one. The press dip happens while the finger is still down; a colour
  // change alone lands after it has lifted.
  // `scale`, not `transform`, in the transition list: Tailwind v4 compiles
  // scale-* to the standalone `scale:` property, so transition-[transform,…]
  // names a property that never changes and the dip snaps.
  const optionRow = (checked: boolean) =>
    cn(
      "flex min-h-[56px] cursor-pointer items-center gap-[13px] rounded-[14px] border-[1.5px] px-[15px] py-[13px]",
      "transition-[scale,border-color,background-color] duration-150 ease-[var(--ease-out)] active:scale-[var(--press-lg)]",
      checked
        ? "border-primary bg-secondary"
        : "border-border bg-white hover:border-primary-border-strong",
    );
  const optionCopy = (label: string, description?: string) => (
    <span className="flex min-w-0 flex-col gap-0.5">
      <strong className="text-[16px] font-semibold">{label}</strong>
      {description && <span className="text-sm text-gray-600">{description}</span>}
    </span>
  );

  return (
    <form className="flex flex-col gap-4" id="intake-question" onSubmit={submit}>
      <section
        className="animate-[chat-arrive_0.2s_ease-out] rounded-[20px] border border-border bg-white px-[18px] pt-[22px] pb-5 motion-reduce:animate-none!"
        // Remounts on every advance, so the arrival keyframe replays with no
        // state to track.
        key={question.id}
      >
        {/* --text-lg, and the only thing at that size on the screen. The
            question used to sit at the same size as its own help text. */}
        <h2 className="m-0 text-lg leading-[1.35] font-extrabold -tracking-[.3px]">
          {question.title}
        </h2>
        {question.helpText && (
          <p className="mt-2.5 text-copy leading-[1.6] text-muted-foreground">
            {question.helpText}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {question.type === "single" ? (
            <>
              <RadioGroup
                aria-label={question.title}
                className="gap-2"
                id={hasMoreDescriptorOptions ? "business-descriptor-options" : undefined}
                onValueChange={(next) =>
                  setValues((current) => ({ ...current, [question.id]: String(next) }))
                }
                value={Array.isArray(value) ? "" : (value ?? "")}
              >
                {displayedOptions.map((option) => (
                  <label
                    className={optionRow(value === option.id)}
                    data-cuelume-toggle="toggle"
                    key={option.id}
                  >
                    <RadioGroupItem ring value={option.id} />
                    {optionCopy(
                      option.label,
                      // The hint under "Other" is instructions for a field that
                      // is now open below it.
                      value === option.id && option.id === "__other__"
                        ? undefined
                        : option.description,
                    )}
                  </label>
                ))}
              </RadioGroup>
              {hasMoreDescriptorOptions && (
                <Button
                  aria-controls="business-descriptor-options"
                  aria-expanded={descriptorOptionsExpanded}
                  className="h-11 w-full rounded-[12px] text-[15px] text-primary"
                  data-cuelume-toggle={descriptorOptionsExpanded ? "droplet" : "bloom"}
                  onClick={() =>
                    setExpandedOptionLists((current) => ({
                      ...current,
                      [question.id]: !descriptorOptionsExpanded,
                    }))
                  }
                  type="button"
                  variant="ghost"
                >
                  {descriptorOptionsExpanded ? "Show fewer options" : "More options"}
                  {descriptorOptionsExpanded ? (
                    <CaretUpIcon weight="bold" />
                  ) : (
                    <CaretDownIcon weight="bold" />
                  )}
                </Button>
              )}
              {value === "__other__" && (
                <Input
                  aria-label="Your answer"
                  autoFocus
                  className="h-[52px] rounded-[14px] border-[1.5px] border-primary px-[15px] text-[16px] font-semibold shadow-[0_0_0_4px_rgba(7,85,233,.1)]"
                  onChange={(event) =>
                    setCustom((current) => ({ ...current, [question.id]: event.target.value }))
                  }
                  placeholder="Type your answer"
                  value={custom[question.id] ?? ""}
                />
              )}
            </>
          ) : question.type === "multi" ? (
            <div aria-label={question.title} className="flex flex-col gap-2" role="group">
              {options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                  <label
                    className={optionRow(checked)}
                    data-cuelume-toggle="toggle"
                    key={option.id}
                  >
                    <Checkbox
                      checked={checked}
                      className="size-[21px]"
                      onCheckedChange={() =>
                        setValues((current) => ({
                          ...current,
                          [question.id]: checked
                            ? selected.filter((id) => id !== option.id)
                            : [...selected, option.id],
                        }))
                      }
                    />
                    {optionCopy(option.label, option.description)}
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Input
                autoFocus
                className="h-[52px] rounded-[14px] border-[1.5px] px-[15px] text-[16px] font-semibold"
                error={Boolean(enteredText && !complete(question))}
                max={question.maximum}
                min={question.minimum}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [question.id]: event.target.value }))
                }
                placeholder={question.placeholder ?? "Type your answer"}
                type={question.type === "number" ? "number" : "text"}
                value={Array.isArray(value) ? "" : (value ?? "")}
              />
              {enteredText && !complete(question) && (
                <FieldHint className="mt-0" error role="alert">
                  {question.id === "business-address"
                    ? "Enter the full street, building, or unit and barangay."
                    : "Enter a distinctive dominant business name."}
                </FieldHint>
              )}
            </div>
          )}
        </div>
      </section>
      {allAnswered && pending.questions.length > 1 && (
        <div className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5">
          <span className="grid size-[26px] place-items-center rounded-full bg-success-soft text-success">
            <CheckCircleIcon className="size-[15px]" weight="fill" />
          </span>
          <span className="text-copy leading-[1.45] font-bold text-success-ink">
            All {pending.questions.length} answered — your plan is ready to build.
          </span>
        </div>
      )}
    </form>
  );
}

/**
 * The question's footer, rendered where the composer normally sits so the two
 * never stack. Separate from the card because the card scrolls with the thread
 * and this must not; the two are joined by `form="intake-question"`, which is
 * what lets a submit button outside the form still submit it.
 */
function QuestionFooter({
  canContinue,
  disabled,
  index,
  lastQuestion,
  onBack,
}: {
  canContinue: boolean;
  disabled: boolean;
  index: number;
  lastQuestion: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex gap-2.5">
      <Button
        className="h-[52px] min-w-[106px] rounded-[14px] border-[1.5px] px-[18px] text-[16px] text-foreground hover:border-primary-border-strong disabled:bg-white disabled:text-gray-400"
        disabled={index === 0 || disabled}
        onClick={onBack}
        type="button"
        variant="outline"
      >
        <ArrowLeft weight="bold" /> Back
      </Button>
      <Button
        className="h-[52px] min-w-0 flex-1 shrink rounded-[14px] text-[17px]"
        disabled={!canContinue || disabled}
        form="intake-question"
        type="submit"
      >
        {lastQuestion ? "Build my plan" : "Next question"}
        <ArrowRightIcon weight="bold" />
      </Button>
    </div>
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

function taxReminderMessageFromInput(input: {
  businessName?: string;
  dueDate?: string;
  formCode?: string;
  taxTitle?: string;
}) {
  const business = input.businessName ? ` for ${input.businessName}` : "";
  const tax = input.taxTitle || input.formCode || "tax payment";
  const form = input.taxTitle && input.formCode ? ` (${input.formCode})` : "";
  const due = input.dueDate
    ? ` due on ${new Date(`${input.dueDate}T00:00:00Z`).toLocaleDateString("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Manila",
      })}`
    : "";
  return `SIMULATION — eGov tax reminder${business}: Your upcoming ${tax}${form} is${due || " approaching"}. Please review your BIR tax calendar and pay on or before the deadline. Confirm the filing and deadline with BIR.`;
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

/** One label/value pair as the DTI form card renders it. */
type DtiRow = [string, string];

/**
 * What changing a field actually costs, per field. The draft used to say "to
 * change anything, type it below", which is true and useless: it put the whole
 * form behind one free-text instruction and told the citizen nothing about
 * which fields are consequential. Each row now opens its own editor and states
 * the consequence of the value it holds.
 */
const FIELD_CONSEQUENCES: ReadonlyMap<string, string> = new Map([
  ["Business activity", "Changing this can change which permits your plan includes."],
  ["Business address", "Your city hall issues the mayor’s permit for this address."],
  ["Owner", "Must match the name on your eGovPH record."],
  ["Proposed business name", "DTI checks this against its name database when you submit."],
  [
    "Territorial scope",
    "Scope sets the DTI filing fee — barangay ₱200, city ₱500, national ₱2,000.",
  ],
]);

function DtiFieldRow({
  edited,
  editing,
  label,
  onCancel,
  onEdit,
  onSave,
  value,
}: {
  edited: boolean;
  editing: boolean;
  label: string;
  onCancel: () => void;
  onEdit: () => void;
  onSave: (next: string) => void;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  // Opening the editor, and the agent applying a save, both put the draft back
  // to the value the row is showing. Adjusting during render instead of in an
  // effect means the stale draft never paints for a frame first.
  const [draftSource, setDraftSource] = useState({ editing, value });
  if (draftSource.editing !== editing || draftSource.value !== value) {
    setDraftSource({ editing, value });
    setDraft(value);
  }
  const note = FIELD_CONSEQUENCES.get(label);
  const canSave = draft.trim().length > 1 && draft.trim() !== value;

  if (!editing)
    return (
      <div className="border-b border-[var(--line-soft)] last:border-b-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-[13px]">
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-sm text-gray-600">{label}</span>
            <strong
              className={cn(
                "text-base leading-[1.35] break-words",
                edited ? "text-primary" : "text-foreground",
              )}
            >
              {value}
            </strong>
            {edited && (
              <span className="mt-0.5 inline-flex items-center gap-[5px] text-meta font-bold text-orange-ink">
                <PencilSimpleIcon className="size-[11px]" weight="fill" />
                Edited — will be filed with this value
              </span>
            )}
          </span>
          {note && (
            <button
              className={cn(
                "inline-flex flex-none items-center gap-[5px] rounded-full bg-[var(--gray-100)] px-2.5 py-[5px] text-meta font-extrabold text-primary",
                "transition-colors duration-150 hover:bg-primary-tint",
                FOCUS_RING,
              )}
              data-cuelume-toggle="bloom"
              onClick={onEdit}
              type="button"
            >
              <PencilSimpleIcon className="size-3" weight="bold" />
              Edit
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div className="border-b border-[var(--line-soft)] last:border-b-0">
      <div className="my-[9px] mb-[13px] flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-primary-border bg-[var(--gray-50)] p-[13px]">
        <span className="text-sm font-extrabold -tracking-[.1px] text-primary">{label}</span>
        <Input
          aria-label={label}
          autoFocus
          className="min-h-[46px] rounded-xl border-[1.5px] border-primary px-3.5 py-3 font-bold shadow-[0_0_0_4px_rgba(7,85,233,.12)]"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSave) {
              event.preventDefault();
              onSave(draft.trim());
            }
            if (event.key === "Escape") onCancel();
          }}
          value={draft}
        />
        <span className="flex items-start gap-[7px] text-meta leading-[1.4] text-gray-800">
          <InfoIcon className="mt-px size-[13px] flex-none text-primary" weight="fill" />
          {note}
        </span>
        <div className="flex gap-2">
          <Button
            className="h-[42px] flex-none rounded-xl px-4 text-foreground"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="h-[42px] min-w-0 flex-1 shrink rounded-xl text-base"
            disabled={!canSave}
            onClick={() => onSave(draft.trim())}
            type="button"
          >
            <CheckIcon weight="bold" /> Save change
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DtiFormCard({
  editedFields,
  form,
  onEditField,
  paid,
  onSubmitPay,
}: {
  /** Labels whose value the citizen changed in this session. */
  editedFields: Set<string>;
  form: DtiBusinessNameForm;
  onEditField: (label: string, value: string) => void;
  paid: boolean;
  onSubmitPay: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const rows: DtiRow[] = [
    ...(form.dominantName ? [["Dominant name", form.dominantName] satisfies DtiRow] : []),
    ...(form.descriptorLabel ? [["Descriptor", form.descriptorLabel] satisfies DtiRow] : []),
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
    <div className="w-full overflow-hidden rounded-[20px] border border-border bg-white">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 bg-[linear-gradient(120deg,var(--gray-50)_0%,var(--surface)_60%)] p-4">
        <span className="grid size-11 place-items-center rounded-full bg-primary-deeper text-sm font-black tracking-[.02em] text-white">
          DTI
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-muted-foreground">
            Business name registration
          </span>
          <strong className="text-[18px] leading-[1.3] font-extrabold -tracking-[.2px]">
            Application draft
          </strong>
        </div>
        <Badge className="text-meta" variant={paid ? "success" : "primary"}>
          {paid ? "Filed" : "Ready"}
        </Badge>
      </div>
      <p className="m-0 flex items-center gap-2 border-y border-[var(--line-soft)] bg-[var(--gray-50)] px-4 py-[9px] text-sm text-gray-800">
        <PencilSimpleIcon className="size-3.5 flex-none text-primary" />
        Prepared from your profile and confirmed answers
      </p>
      <div className="flex flex-col px-4 pt-1 pb-3">
        {rows.map(([label, value]) => (
          <DtiFieldRow
            edited={editedFields.has(label)}
            editing={editing === label}
            key={label}
            label={label}
            onCancel={() => setEditing(null)}
            onEdit={() => setEditing(label)}
            onSave={(next) => {
              setEditing(null);
              onEditField(label, next);
            }}
            value={value}
          />
        ))}
      </div>
      {form.termsAndConditions && (
        <details className="mx-4 mb-3 rounded-xl border border-[var(--line-soft)] bg-muted px-3 py-2 text-sm">
          <summary className="cursor-pointer font-extrabold">
            BNRS terms and name requirements
          </summary>
          <p className="mt-2 leading-[1.45] text-gray-800">{form.termsAndConditions}</p>
          {form.businessNameRequirements?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-gray-800">
              {form.businessNameRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          ) : null}
        </details>
      )}
      <div className="flex flex-col gap-2.5 border-t border-[var(--line-soft)] bg-[var(--gray-50)] px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <strong className="text-base">DTI filing fee</strong>
            <span className="text-meta text-gray-600">
              Government fee · {form.territorialScope.toLowerCase()} scope
            </span>
          </span>
          <strong className="flex-none text-lg tabular-nums -tracking-[.4px]">
            {form.feeLabel}
          </strong>
        </div>
        {/* Once paid this is a receipt, not a control: a disabled primary button
            still reads as the next thing to do. */}
        {paid ? (
          <div className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-success-soft text-[17px] font-extrabold text-success-ink">
            <CheckCircleIcon className="size-[17px]" weight="fill" />
            Payment received · {form.feeLabel}
          </div>
        ) : (
          <Button
            block
            className="h-[52px] rounded-[14px] text-[17px]"
            data-cuelume-toggle="bloom"
            onClick={onSubmitPay}
          >
            <LockSimpleIcon className="size-[17px]" weight="fill" />
            Submit and pay {form.feeLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function BirFormArtifactCard({
  artifact,
  dstPaid,
  enableRegistrationPayment,
  onPay,
  onPreview,
}: {
  artifact: BirFormArtifact;
  dstPaid: boolean;
  enableRegistrationPayment: boolean;
  onPay: (request: PaymentRequest) => void;
  onPreview: () => void;
}) {
  const formLabel = birFormArtifactLabel(artifact);
  const needsDstPayment = enableRegistrationPayment && artifact.formType === "1901";
  return (
    <article className={cn("bir-form-artifact", needsDstPayment && "with-payment")}>
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
          <strong>{formLabel}</strong>
          <span>
            {artifact.pageCount} pages · {Math.max(1, Math.round(artifact.size / 1024))} KB
          </span>
        </span>
        <span className="pdf-artifact-action">
          Preview <ArrowRight weight="bold" />
        </span>
      </button>
      {needsDstPayment && (
        <footer className="local-permit-payment">
          <div>
            <small>Final registration payment · Documentary Stamp Tax</small>
            <strong>₱30.00</strong>
          </div>
          <button
            type="button"
            disabled={dstPaid}
            onClick={() =>
              onPay({
                serviceType: "bir-documentary-stamp-tax",
                serviceLabel: "BIR Documentary Stamp Tax",
                proposedName: formLabel,
                feeLabel: "₱30.00",
                serviceReference: artifact.artifactId,
              })
            }
          >
            {dstPaid ? "Paid" : "Pay with eGovPay"} <ArrowRight weight="bold" />
          </button>
        </footer>
      )}
    </article>
  );
}

function ToolPart({
  part,
  editedFields,
  enableBirPayment,
  paidServices,
  onEditField,
  onOpenBusiness,
  onSubmitPay,
  onPreviewPdf,
}: {
  part: BusinessChatMessage["parts"][number];
  editedFields: Set<string>;
  enableBirPayment: boolean;
  paidServices: Set<PaymentServiceType>;
  onEditField: (label: string, value: string) => void;
  onOpenBusiness: (businessId: string) => void;
  onSubmitPay: (request: PaymentRequest) => void;
  onPreviewPdf: (artifact: BirFormArtifact) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  if (name === "askUser") return null;
  if (part.type === "tool-send_sms_message" || part.type === "tool-simulate_tax_payment_reminder") {
    const reminder = part.type === "tool-simulate_tax_payment_reminder";
    if (part.state === "output-error")
      return (
        <div className="chat-tool-row error">
          <X />
          <div>
            <small>{reminder ? "Tax reminder not sent" : "SMS not sent"}</small>
            <span>Check the recipient and eMessage configuration</span>
          </div>
          <PaperPlaneRightIcon />
        </div>
      );
    if (part.state === "output-available") {
      const sentMessage =
        part.output.message ||
        (reminder ? taxReminderMessageFromInput(part.input) : part.input.message) ||
        "Message text is unavailable for this earlier result.";
      return (
        <details className="chat-tool-disclosure">
          <summary className="chat-tool-row complete">
            <CheckCircle weight="fill" />
            <div>
              <small>
                {reminder ? "Simulated tax reminder accepted" : "SMS accepted by eMessage"}
              </small>
              <span>{part.output.recipient} · Handset delivery not confirmed</span>
            </div>
            <CaretDownIcon className="chat-tool-disclosure-caret" />
          </summary>
          <div className="chat-tool-disclosure-body">
            <small>Message sent</small>
            <p>{sentMessage}</p>
          </div>
        </details>
      );
    }
    return (
      <div className="chat-tool-row active">
        <CircleNotch className="spin" />
        <div>
          <small>{reminder ? "Sending simulated tax reminder" : "Sending SMS"}</small>
          <span className="chat-shimmer">Using eMessage securely</span>
        </div>
        <PaperPlaneRightIcon />
      </div>
    );
  }
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
          dstPaid={paidServices.has("bir-documentary-stamp-tax")}
          enableRegistrationPayment={enableBirPayment}
          onPay={onSubmitPay}
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
    // Every state of a tool part carries `input`, partial while it streams.
    const formType = part.input?.type === "1905" ? "1905" : "1901";
    return (
      <div className="chat-tool-row active">
        <CircleNotch className="spin" />
        <div>
          <small>Generating BIR Form {formType}</small>
          <span className="chat-shimmer">Prefilling the authenticated profile</span>
        </div>
        <FilePdf />
      </div>
    );
  }
  if (
    part.type === "tool-prepareLguBusinessPermit" ||
    part.type === "tool-issueLguBusinessPermit"
  ) {
    if (part.state === "output-available")
      return (
        <LguPermitCard
          permit={part.output.permit}
          paid={paidServices.has("lgu-business-permit")}
          onPay={onSubmitPay}
        />
      );
    return (
      <div className="local-permit-processing ebpls" role="status">
        <span>
          <CircleNotch className="spin" />
        </span>
        <div>
          <small>DX LGU business permit</small>
          <strong>Validating the BNRS credential…</strong>
          <em>Preparing the combined permit and barangay-clearance assessment</em>
        </div>
      </div>
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
  if (part.type === "tool-finalizeBusinessRegistration") {
    if (part.state !== "output-available") return null;
    return (
      <BusinessFinalizedCard
        businessId={part.output.businessId}
        businessName={part.output.businessName}
        onOpenBusiness={onOpenBusiness}
        registrationNumber={part.output.registrationNumber}
      />
    );
  }
  if (part.type === "tool-webSearch") return <SearchTool part={part} />;
  if (part.type === "tool-updatePlan") return null;
  if (part.type === "tool-editDtiBusinessNameForm") {
    if (part.state === "output-available" && part.output.form) {
      const form = part.output.form;
      return (
        <DtiFormCard
          editedFields={editedFields}
          form={form}
          onEditField={onEditField}
          paid={paidServices.has("dti-business-name")}
          onSubmitPay={() =>
            onSubmitPay({
              serviceType: "dti-business-name",
              serviceLabel: "DTI Business Name Registration",
              proposedName: form.proposedName,
              feeLabel: form.feeLabel,
              feeLines: form.feeBreakdown
                ? [
                    { amount: form.feeBreakdown.registration, label: form.proposedName },
                    { amount: form.feeBreakdown.documentaryStamp, label: "Documentary stamp" },
                  ]
                : undefined,
            })
          }
        />
      );
    }
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

/**
 * A bottom sheet inside the phone, not a centred modal. Paying is the last step
 * of the draft directly above it, and a dialog floating in the middle of the
 * screen cut that thread — the sheet rises out of the button that opened it and
 * leaves the draft visible behind the scrim.
 */
export function PaymentSheet({
  payment,
  conversationId,
  onClose,
  onCheckoutFailed,
  onOpeningCheckout,
}: {
  payment: PaymentRequest;
  conversationId: string;
  onClose: () => void;
  /** Fired if the redirect never happens, so the island stops claiming it did. */
  onCheckoutFailed?: () => void;
  /** Fired before the redirect, so the island can show the payment in flight. */
  onOpeningCheckout?: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  // One line when the service quotes one fee, and the real split when it quotes
  // a split. Never invented: the DTI total is a registration fee plus a
  // documentary stamp because BNRS says so, and the LGU assessment is one
  // number because DX LGU returns one.
  const lines = payment.feeLines ?? [{ amount: payment.feeLabel, label: payment.proposedName }];
  const openCheckout = async () => {
    play("loading");
    setOpening(true);
    setPaymentError("");
    onOpeningCheckout?.();
    try {
      const response = await fetch("/api/payments/egovpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, serviceType: payment.serviceType }),
      });
      // SAFETY: the body comes from this app's own `/api/payments/egovpay` route,
      // which answers with `{ checkoutUrl, payment }` or `{ error }`; every field
      // read below is declared optional, so a shorter body is still handled.
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
      onCheckoutFailed?.();
    }
  };

  return (
    <div className="chat-dialog-layer">
      <motion.button
        animate={{ opacity: 1, transition: SCRIM_IN }}
        aria-label="Dismiss payment"
        className="chat-dialog-scrim bg-[rgba(12,22,45,.42)]!"
        data-cuelume-toggle="droplet"
        exit={{ opacity: 0, transition: SCRIM_OUT }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.section
        animate={{ transform: "translateY(0%)", transition: SHEET_IN }}
        aria-labelledby="payment-sheet-title"
        aria-modal="true"
        className="relative z-[1] flex w-full flex-col rounded-t-[26px] bg-white px-5 pt-2.5 pb-[26px] shadow-[0_-20px_50px_-20px_rgba(12,22,45,.4)]"
        exit={{ transform: "translateY(100%)", transition: SHEET_OUT }}
        initial={{ transform: "translateY(100%)" }}
        role="dialog"
      >
        <span
          aria-hidden="true"
          className="h-1 w-[38px] flex-none self-center rounded-full bg-gray-300"
        />
        <div className="mt-4 flex flex-none items-center gap-[11px]">
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-secondary text-primary">
            <ShieldCheck className="size-[22px]" weight="duotone" />
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <span className="text-sm font-extrabold -tracking-[.1px] text-primary">eGovPay</span>
            <h2
              className="text-[19px] leading-[1.3] font-extrabold -tracking-[.3px]"
              id="payment-sheet-title"
            >
              Pay the {payment.serviceLabel.replace(/^(DTI|BIR|DX)\s+/, "").toLowerCase()}
            </h2>
          </span>
        </div>
        <div className="mt-4 flex flex-none flex-col gap-[11px] rounded-2xl bg-[var(--gray-50)] p-3.5">
          {lines.map(({ amount, label }, index) => (
            <div className="flex items-baseline justify-between gap-3" key={label}>
              <span className="flex min-w-0 flex-col gap-0.5">
                {index === 0 && (
                  <span className="text-sm text-muted-foreground">{payment.serviceLabel}</span>
                )}
                <strong
                  className={cn(
                    "truncate",
                    index === 0 ? "text-base" : "text-sm font-normal text-muted-foreground",
                  )}
                >
                  {label}
                </strong>
              </span>
              <span className="flex-none text-base font-extrabold tabular-nums">{amount}</span>
            </div>
          ))}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-3">
            <strong className="text-base">Total due</strong>
            <strong className="text-[22px] tabular-nums -tracking-[.6px]">
              {payment.feeLabel}
            </strong>
          </div>
        </div>
        {paymentError && (
          <p
            className="mt-3 flex-none rounded-xl bg-destructive-soft px-2.5 py-2 text-sm leading-[1.4] text-destructive-ink"
            role="alert"
          >
            {paymentError}
          </p>
        )}
        <Button
          block
          className="mt-4 h-[54px] rounded-[15px] text-[17px]"
          data-cuelume-toggle="bloom"
          disabled={opening}
          onClick={openCheckout}
        >
          <LockSimpleIcon className="size-[17px]" weight="fill" />
          {opening ? "Preparing checkout…" : "Continue to eGovPay"}
        </Button>
        <span className="mt-3 flex flex-none items-center justify-center gap-[7px] text-center text-meta leading-[1.45] text-gray-600">
          <ArrowUUpLeftIcon className="size-[13px] flex-none text-primary" weight="fill" />
          You return to this plan automatically once payment clears.
        </span>
      </motion.section>
    </div>
  );
}

export type IslandState = "idle" | "paying" | "paid";

// What the island calls each service. The conversation title is the citizen's
// own prompt, not a reference number, and using it here read as one.
const PAID_SERVICE_LABELS = {
  "bir-documentary-stamp-tax": "BIR documentary stamp tax",
  "dti-business-name": "DTI business name registration",
  "lgu-business-permit": "LGU business permit",
} satisfies Record<PaymentServiceType, string>;

/**
 * Payment status over the top of the screen instead of a modal in front of it,
 * so the plan stays readable while eGovPay works. Two states, two fixed sizes:
 * animating one element's width and height between them was a rendering bug in
 * the prototype it comes from.
 *
 * The resting state is the frame's own .dynamic-island in phone-chrome.tsx, not
 * a third state here — it is there on every screen, payment or not. This panel
 * shares its origin and is larger on both axes, so it covers it rather than
 * needing it hidden.
 */
function PaymentIsland({
  amount,
  onOpen,
  service,
  state,
}: {
  /**
   * Omitted once the citizen is back from checkout: at that point the screen
   * knows *which* service cleared but not what it quoted, and the DTI fee is
   * not the documentary stamp's.
   */
  amount?: string;
  onOpen: () => void;
  service: PaymentServiceType | null;
  state: IslandState;
}) {
  if (state === "idle") return null;
  const paid = state === "paid";
  const label = service ? PAID_SERVICE_LABELS[service] : "filing fee";
  return (
    <button
      aria-live="polite"
      className={cn(
        "absolute top-[9px] left-1/2 z-[60] h-[60px] w-[330px] -translate-x-1/2 overflow-hidden rounded-[22px] bg-[var(--overlay-ink)] text-left text-white shadow-[0_10px_26px_-12px_rgba(6,10,20,.6)]",
        FOCUS_RING,
      )}
      onClick={onOpen}
      type="button"
    >
      <span className="grid h-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-[15px] py-[13px]">
        <span
          className={cn(
            "grid size-[34px] flex-none place-items-center rounded-full",
            paid ? "animate-[payment-ring_1.6s_ease-out_2] bg-success" : "bg-primary",
          )}
        >
          {paid ? (
            <CheckIcon className="size-[18px]" weight="bold" />
          ) : (
            <span className="size-[17px] animate-[chat-spin_.8s_linear_infinite] rounded-full border-[2.5px] border-white/30 border-t-white" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <strong className="truncate text-copy -tracking-[.2px]">
            {paid ? "Payment received" : `Paying the ${label}`}
          </strong>
          <span className="truncate text-meta text-gray-500">
            {paid ? `${label} · recorded` : "eGovPay · secure checkout"}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-0.5">
          {amount && <strong className="text-base tabular-nums -tracking-[.3px]">{amount}</strong>}
          <span
            className={cn(
              "text-xs font-extrabold",
              paid ? "text-[var(--overlay-success)]" : "text-gray-500",
            )}
          >
            {paid ? "Paid" : "Processing"}
          </span>
        </span>
      </span>
    </button>
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
  const formLabel = birFormArtifactLabel(artifact);
  useEffect(() => {
    dialogRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    // The enter used to be `animation: chat-sheet-in` in chat.css and the exit
    // did not exist, so the sheet eased up over 250ms and then disappeared in a
    // single frame — and the backdrop did the opposite, snapping to 55% black
    // while the sheet was still travelling. Both halves now animate together
    // and both leave the way they arrived, faster on the way out.
    <div className="chat-dialog-layer pdf-preview-layer">
      <motion.button
        animate={{ opacity: 1, transition: SCRIM_IN }}
        aria-label="Close PDF preview"
        className="chat-dialog-scrim"
        data-cuelume-toggle="droplet"
        exit={{ opacity: 0, transition: SCRIM_OUT }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.section
        animate={{ opacity: 1, transform: "translateY(0px)", transition: SHEET_IN }}
        aria-labelledby="pdf-preview-title"
        aria-modal="true"
        className="pdf-preview-dialog"
        exit={{ opacity: 0, transform: "translateY(20px)", transition: SHEET_OUT }}
        initial={{ opacity: 0, transform: "translateY(20px)" }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <span>
            <FilePdf weight="fill" />
          </span>
          <div>
            <small>PDF preview</small>
            <h2 id="pdf-preview-title">{formLabel}</h2>
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
        <iframe src={artifact.url} title={`${formLabel} PDF preview`} />
        <footer>
          <a data-cuelume-toggle="success" href={artifact.url} download={artifact.filename}>
            <DownloadSimple weight="bold" /> Download PDF
          </a>
          <a data-cuelume-toggle="page" href={artifact.url} target="_blank" rel="noreferrer">
            <ArrowSquareOut weight="bold" /> Open full screen
          </a>
        </footer>
      </motion.section>
    </div>
  );
}

export function BusinessChatScreen({
  business,
  conversation,
  conversations,
  paymentStatus,
  paymentService,
  onBack,
  onOpenBusiness,
  onSelectConversation,
  onDeleteConversation,
}: {
  business?: RegisteredBusiness | null;
  conversation: BusinessConversation;
  conversations: ConversationSummary[];
  profile: CitizenProfile | null;
  paymentStatus?: string | null;
  paymentService?: PaymentServiceType | null;
  onBack: () => void;
  onOpenBusiness: (businessId: string) => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (conversation: ConversationSummary) => void;
}) {
  const management = conversation.purpose === "management";
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
  const recoveredBusinessRecord = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  // Lifted out of the question card so the header's progress bar and the
  // footer's Next button read the same numbers the card does.
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionValid, setQuestionValid] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  // Which draft fields the citizen changed *and the agent then applied*. The
  // value at the moment they hit save is kept, so "Edited" appears only once
  // the form comes back different — saying it on submit would be a claim about
  // a change the agent had not made yet.
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({});
  const [island, setIsland] = useState<IslandState>("idle");
  // Adding an exit animation exposed that there was no way to trigger one: the
  // only thing that closed this menu was the trigger itself, so tapping the
  // thread behind it left it hanging over the conversation. Escape and an
  // outside press are what a menu is expected to answer to.
  useEffect(() => {
    if (!historyOpen) return;
    // pointerdown rather than click, so a press that starts on the scrim of the
    // thread dismisses on the way down instead of waiting for mouseup.
    const dismiss = (event: PointerEvent) => {
      // SAFETY: this listener is attached to `document`, so its target is always
      // a DOM node — `EventTarget` is only wider to cover targets such as
      // `XMLHttpRequest`, which never dispatch a pointerdown.
      if (!headerRef.current?.contains(event.target as Node)) setHistoryOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [historyOpen]);
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
        // SAFETY: `localPaymentStatuses` is a `Partial<Record<PaymentServiceType,
        // string>>` filled only from that key set, and `Object.entries` merely
        // widens the key back to `string`.
        (Object.entries(localPaymentStatuses) as [PaymentServiceType, string][])
          .filter(([, value]) => /paid|success|complete/i.test(value))
          .map(([service]) => service),
      ),
    [localPaymentStatuses],
  );
  const latestPlan = latestRegistrationPlan(visibleMessages);
  const latestProgress = latestPlan ? planProgress(latestPlan.plan) : null;
  const hasFinalizedBusinessCard = visibleMessages.some((message) =>
    message.parts.some(
      (part) =>
        part.type === "tool-finalizeBusinessRegistration" && part.state === "output-available",
    ),
  );
  const completedPlanSteps =
    latestPlan?.plan.steps.filter((step) => step.status === "completed").length ?? 0;
  const previousStatus = useRef(status);
  const previousCompletedPlanSteps = useRef(completedPlanSteps);
  const hadError = useRef(Boolean(error));
  const pendingQuestion: PendingQuestion | null = (() => {
    for (const message of [...visibleMessages].reverse()) {
      for (const part of [...message.parts].reverse()) {
        if (part.type === "tool-askUser" && part.state === "input-available") {
          // SAFETY: the guard above establishes both members `ReadyAskUserPart`
          // adds to `AskUserPart`; the `input` shape it restates is the askUser
          // tool's own declared input.
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
  const legacyBirConsentPending =
    pendingQuestion?.questions.length === 1 &&
    ["bir-form-consent", "self-employed-bir-form-consent"].includes(
      pendingQuestion.questions[0]?.id ?? "",
    );
  const pending = legacyBirConsentPending ? null : pendingQuestion;

  useEffect(() => {
    // Reconnect and initial seeding are mutually exclusive. A persisted active
    // stream already contains the response to the user's latest message.
    if (seeded.current) return;
    seeded.current = true;
    if (conversation.activeStreamId) {
      void resumeStream().finally(() => setMessages((current) => uniqueMessagesById(current)));
    } else if (initialMessages.length === 0 && !management) {
      void sendMessage({ text: initialPrompt });
    }
  }, [
    conversation.activeStreamId,
    initialMessages.length,
    initialPrompt,
    management,
    resumeStream,
    sendMessage,
    setMessages,
  ]);
  useEffect(() => {
    if (messages.length !== visibleMessages.length) setMessages(visibleMessages);
  }, [messages.length, setMessages, visibleMessages]);
  // A new batch starts at its first question, and the plan checklist yields:
  // the two share the header's progress row, and an open checklist would push
  // the question the citizen has to answer off the top of the thread.
  // Adjusted during render rather than in an effect: the card is keyed by the
  // tool call id, so a post-commit reset would mount the new batch on the old
  // index for a frame — with a shorter batch that index is out of range.
  const pendingToolCallId = pending?.part.toolCallId;
  const [questionBatchId, setQuestionBatchId] = useState(pendingToolCallId);
  if (questionBatchId !== pendingToolCallId) {
    setQuestionBatchId(pendingToolCallId);
    setQuestionIndex(0);
    setQuestionValid(false);
    if (pendingToolCallId) setPlanOpen(false);
  }
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleMessages, pending, status]);
  useEffect(() => {
    const previous = previousStatus.current;
    if (status === "submitted" && previous !== "submitted") play("loading");
    if (
      status === "ready" &&
      (previous === "submitted" || previous === "streaming") &&
      completedPlanSteps <= previousCompletedPlanSteps.current &&
      !error &&
      !continuationError
    )
      play("ready");
    previousStatus.current = status;
  }, [completedPlanSteps, continuationError, error, status]);
  useEffect(() => {
    if (completedPlanSteps > previousCompletedPlanSteps.current) play("success");
    previousCompletedPlanSteps.current = completedPlanSteps;
  }, [completedPlanSteps]);
  useEffect(() => {
    const failed = Boolean(error || continuationError);
    if (failed && !hadError.current) play("error");
    hadError.current = failed;
  }, [continuationError, error]);
  // Coming back from a cleared checkout, the island says so and then gets out of
  // the way. The timer is the only thing dismissing it, so it is cleared on
  // unmount — a setState on a screen the citizen has already left is a leak.
  useEffect(() => {
    if (!/paid|success|complete/i.test(paymentStatus ?? "")) return;
    // The checkout redirect is already resolved by the time this screen mounts,
    // so seeding "paid" at initialisation would render the header spacer at its
    // full height; showing it one commit later is what makes the spacer animate.
    // oxlint-disable-next-line react/set-state-in-effect
    setIsland("paid");
    const timer = setTimeout(() => setIsland("idle"), 4500);
    return () => clearTimeout(timer);
  }, [paymentStatus]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || pending || legacyBirConsentPending) return;
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
  useEffect(() => {
    if (
      !legacyBirConsentPending ||
      !pendingQuestion ||
      busy ||
      answeredToolCalls.current.has(pendingQuestion.part.toolCallId)
    )
      return;

    const toolCallId = pendingQuestion.part.toolCallId;
    const questionId = pendingQuestion.questions[0]?.id;
    if (!questionId) return;
    answeredToolCalls.current.add(toolCallId);
    // No user event to hang this on: the stream delivering a legacy consent
    // question is what starts the round trip, and this marks it in flight so the
    // question controls disable while it runs.
    // oxlint-disable-next-line react/set-state-in-effect
    setAnsweringToolCallId(toolCallId);
    void (async () => {
      try {
        await addToolOutput({
          tool: "askUser",
          toolCallId,
          output: {
            answers: [{ questionId, value: "yes", labels: ["Generate immediately"] }],
          },
        });
        await sendMessage();
      } catch {
        answeredToolCalls.current.delete(toolCallId);
      } finally {
        setAnsweringToolCallId(null);
      }
    })();
  }, [addToolOutput, busy, legacyBirConsentPending, pendingQuestion, sendMessage]);
  const continueAfterPayment = useCallback(
    async (serviceType: PaymentServiceType = "dti-business-name") => {
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
    },
    [sendMessage],
  );

  const automaticPaymentService =
    paymentService ??
    (!latestProgress?.done && paidServices.has("bir-documentary-stamp-tax")
      ? "bir-documentary-stamp-tax"
      : null);

  useEffect(() => {
    if (!automaticPaymentService) return;
    if (
      automaticPaymentService === paymentService &&
      !/paid|success|complete/i.test(paymentStatus ?? "")
    )
      return;
    const continuationKey = `${conversation.id}:${automaticPaymentService}`;
    if (continuedPayment.current === continuationKey) return;
    continuedPayment.current = continuationKey;
    void continueAfterPayment(automaticPaymentService);
  }, [
    automaticPaymentService,
    continueAfterPayment,
    conversation.id,
    paymentService,
    paymentStatus,
  ]);
  useEffect(() => {
    if (
      management ||
      !latestProgress?.done ||
      hasFinalizedBusinessCard ||
      business ||
      conversation.businessId ||
      busy ||
      recoveredBusinessRecord.current
    )
      return;
    recoveredBusinessRecord.current = true;
    void sendMessage(
      {
        role: "user",
        parts: [{ type: "data-registrationCompleted", data: { status: "complete" } }],
      },
      { body: { event: "registration-completed" } },
    ).catch(() => {
      recoveredBusinessRecord.current = false;
      setContinuationError("Registration is complete, but its business record could not load.");
    });
  }, [
    business,
    busy,
    conversation.businessId,
    hasFinalizedBusinessCard,
    latestProgress?.done,
    management,
    sendMessage,
  ]);

  // The draft the citizen is looking at, and the value each editable row holds.
  // Derived from the thread rather than kept in a ref: a ref written during
  // render is read by the memo below on the render *before* the one that set it,
  // so the "Edited" note would only appear if some later render happened to
  // arrive — which, at the end of a stream, it does not.
  const latestDtiForm = useMemo(() => {
    for (const message of [...visibleMessages].reverse())
      for (const part of [...message.parts].reverse())
        if (part.type === "tool-editDtiBusinessNameForm" && part.state === "output-available")
          if (part.output.form) return part.output.form;
    return null;
  }, [visibleMessages]);
  const draftFieldValues = useMemo(() => {
    const values: Record<string, string> = {};
    if (!latestDtiForm) return values;
    values["Business activity"] = latestDtiForm.businessActivity;
    values["Business address"] = latestDtiForm.businessAddress;
    values.Owner = latestDtiForm.ownerName;
    values["Proposed business name"] = latestDtiForm.proposedName;
    values["Territorial scope"] = latestDtiForm.territorialScope;
    return values;
  }, [latestDtiForm]);
  // A field counts as edited once its value differs from what it held when the
  // citizen pressed save — the only evidence the agent actually applied it.
  // Saying so on submit would be a claim about a change not yet made.
  const editedFields = useMemo(() => {
    const applied = new Set<string>();
    for (const [label, previous] of Object.entries(fieldEdits))
      if ((draftFieldValues[label] ?? previous) !== previous) applied.add(label);
    return applied;
  }, [draftFieldValues, fieldEdits]);
  // What the field editor asks the agent for. Free text because that is the one
  // interface the agent has for a correction — the Edit chip is a shortcut to
  // saying it, not a second write path around the tool that owns the form.
  const editDraftField = (label: string, value: string) => {
    setFieldEdits((current) => ({ ...current, [label]: draftFieldValues[label] ?? "" }));
    void sendMessage({ text: `Change the ${label.toLowerCase()} to “${value}”.` });
  };

  const questionCount = pending?.questions.length ?? 0;
  const lastQuestion = questionIndex === questionCount - 1;

  return (
    <div className={cn("screen agent-chat-screen", management && "management-chat")}>
      <StatusBar />
      <PaymentIsland
        amount={island === "paying" ? paymentRequest?.feeLabel : undefined}
        onOpen={() => setIsland("idle")}
        service={
          island === "paying" ? (paymentRequest?.serviceType ?? null) : (paymentService ?? null)
        }
        state={island}
      />
      <div className="min-h-0">
        {/* Pushes the thread clear of the island rather than letting it sit over
            the first card. Height, not a transform: the rows below have to move
            with it, and a transform would slide them under the header. */}
        <div
          aria-hidden="true"
          className="transition-[height] duration-[420ms] ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ height: island === "idle" ? 0 : 38 }}
        />
        <header className="chat-header" ref={headerRef}>
          <IconButton
            aria-label="Go back"
            className="size-[38px]"
            data-cuelume-toggle="page"
            onClick={onBack}
            variant="plain"
          >
            <ArrowLeft className="size-[19px]" weight="bold" />
          </IconButton>
          {/* The centre column is the session switcher, so the plan title is
              both the heading and the control that changes it. The caret only
              appears when there is somewhere else to go. */}
          <button
            aria-expanded={historyOpen}
            className="chat-session-trigger"
            data-cuelume-toggle={historyOpen ? "droplet" : "bloom"}
            disabled={conversations.length < 2}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <span>
              <h1>{conversation.title}</h1>
              <small>
                <ShieldCheck weight="fill" />
                {management ? "Uses this business’s saved records" : "Saved plan"}
              </small>
            </span>
            {conversations.length > 1 && (
              <CaretDown
                className={cn(
                  "transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
                  historyOpen && "rotate-180",
                )}
              />
            )}
          </button>
          {/* Empty, and the same width as the back button, so the plan title
              stays optically centred. Starting a plan belongs to the Business
              home's composer and a business chat to the record's own controls;
              a second entry point here was one the citizen had no reason to
              reach for mid-conversation. */}
          <span />
          {/* The one job motion is here for: this menu is a conditional render, so
              before AnimatePresence it could fade in but never out — it vanished
              in a single frame while its own trigger was still animating. The
              origin is the trigger (top left, set in chat.css), so it grows out
              of the control that opened it rather than out of its own middle. */}
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                animate={{
                  opacity: 1,
                  transform: "scale(1) translateY(0px)",
                  transition: POPOVER_IN,
                }}
                className="chat-session-menu"
                exit={{
                  opacity: 0,
                  transform: "scale(0.97) translateY(-6px)",
                  transition: POPOVER_OUT,
                }}
                initial={{ opacity: 0, transform: "scale(0.97) translateY(-6px)" }}
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </header>
        {/* Exactly one progress system, and the live one wins: the questions
            while a batch is open, the plan the rest of the time. */}
        {!management && (
          <div className="bg-white/97 px-4 pt-3 pb-2.5">
            {pending ? (
              <ProgressRow
                completed={questionIndex + (questionValid ? 1 : 0)}
                total={questionCount}
              />
            ) : latestProgress ? (
              <ProgressRow
                completed={latestProgress.completed}
                expandable
                expanded={planOpen}
                onToggle={() => setPlanOpen((open) => !open)}
                total={latestProgress.total}
              />
            ) : null}
          </div>
        )}
        {!management && planOpen && latestPlan && <PlanChecklist plan={latestPlan.plan} />}
      </div>
      <main className="chat-thread" ref={scrollRef} id="app-content">
        {localPaymentStatus && !paid && (
          <div className="payment-return pending">
            <CheckCircle weight="fill" />
            <span>
              <strong>Payment status updated</strong>
              <small>Status: {localPaymentStatus}. You can continue in this saved chat.</small>
            </span>
          </div>
        )}
        <div className="chat-day">
          {management ? `About ${business?.name ?? "this business"}` : "Saved automatically"}
        </div>
        {management && visibleMessages.length === 0 && !busy && (
          <>
            <section className="flex flex-col gap-2.5 rounded-[18px] border border-border bg-white p-4">
              <span className="grid size-[38px] place-items-center rounded-[11px] bg-secondary text-primary">
                <Buildings className="size-5" weight="duotone" />
              </span>
              <h2 className="text-[19px] leading-[1.3] font-extrabold -tracking-[.3px]">
                What do you need for {business?.name ?? "this business"}?
              </h2>
              <p className="m-0 text-copy leading-[1.6] text-muted-foreground">
                {business
                  ? `I can read its ${business.records.length} records, ${business.files.length} files and filing calendar — ask in your own words.`
                  : "Ask about this business’s records, files and filing calendar in your own words."}
              </p>
            </section>
            <div className="mt-3.5 flex flex-col gap-2">
              {BUSINESS_CHAT_STARTERS.map(({ icon: Icon, text }) => (
                <button
                  className={cn(
                    "grid grid-cols-[24px_minmax(0,1fr)_14px] items-center gap-[11px] rounded-[14px] border border-border bg-white px-3.5 py-[13px] text-left text-copy font-bold",
                    "transition-[scale,border-color] duration-150 ease-[var(--ease-out)] hover:border-primary-border active:scale-[var(--press-lg)]",
                    FOCUS_RING,
                  )}
                  data-cuelume-toggle="toggle"
                  key={text}
                  onClick={() => setInput(text)}
                  type="button"
                >
                  <Icon className="size-[17px] text-primary" />
                  {text}
                  <ArrowUpRightIcon className="size-3 text-gray-500" weight="bold" />
                </button>
              ))}
            </div>
          </>
        )}
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
                    <>
                      <div className="assistant-prose">
                        <Markdown streaming={streaming}>{text}</Markdown>
                      </div>
                      {/* Under the answer, not in the composer: it is a claim
                          about where this reply came from, and the composer's
                          copy of it was a claim about nothing yet written. */}
                      {management && !streaming && (
                        <span className="chat-answer-source">
                          <ShieldCheck weight="fill" />
                          Answered from this business’s saved records
                        </span>
                      )}
                    </>
                  ))}
                {message.parts.map((part, index) =>
                  isToolUIPart(part) ? (
                    <ToolPart
                      key={`${message.id}-${index}`}
                      part={part}
                      editedFields={editedFields}
                      enableBirPayment={Boolean(latestPlan)}
                      paidServices={paidServices}
                      onEditField={editDraftField}
                      onOpenBusiness={onOpenBusiness}
                      onSubmitPay={setPaymentRequest}
                      onPreviewPdf={setPdfArtifact}
                    />
                  ) : null,
                )}
              </div>
            </article>
          );
        })}
        {paid && (
          <div className="payment-return success">
            <CheckCircle weight="fill" />
            <span>
              <strong>Payment confirmed</strong>
              <small>
                The certificate lands in Your businesses once the agent finishes this step.
              </small>
            </span>
          </div>
        )}
        {!management && latestProgress?.done && business && !hasFinalizedBusinessCard && (
          <BusinessFinalizedCard
            businessId={business.id}
            businessName={business.name}
            onOpenBusiness={onOpenBusiness}
            registrationNumber={business.registrationNumber}
          />
        )}
        {/* The question is the last thing in the thread, not a form folded into
            the composer: the composer capped at min(76dvh, 680px) and scrolled
            itself, which is how a five-option question came to clip its own
            buttons off the bottom. */}
        {!management && pending && (
          <div className="mt-1.5">
            <QuestionCard
              disabled={busy || answeringToolCallId === pending.part.toolCallId}
              index={questionIndex}
              key={pending.part.toolCallId}
              onAnswer={answer}
              onIndexChange={setQuestionIndex}
              onValidityChange={setQuestionValid}
              pending={pending}
            />
          </div>
        )}
        {busy && (
          <div className="chat-working" role="status" aria-live="polite">
            <AgentDot />
            <div className="chat-working-shimmer">
              {management
                ? "Reviewing your saved business records…"
                : "Preparing your next registration step…"}
            </div>
          </div>
        )}
        {(error || continuationError) && (
          <div className="chat-error">
            {continuationError || "I couldn’t continue. Please try again."}
            {(paid || automaticPaymentService) && (
              <button
                type="button"
                data-cuelume-toggle="loading"
                onClick={() =>
                  void continueAfterPayment(automaticPaymentService ?? "dti-business-name")
                }
                disabled={busy}
              >
                Continue to next step
              </button>
            )}
          </div>
        )}
      </main>
      <footer className="chat-composer-shell">
        {!management && pending ? (
          <QuestionFooter
            canContinue={questionValid}
            disabled={busy || answeringToolCallId === pending.part.toolCallId}
            index={questionIndex}
            lastQuestion={lastQuestion}
            onBack={() => setQuestionIndex((current) => Math.max(0, current - 1))}
          />
        ) : (
          <form
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border-[1.5px] bg-white py-[9px] pr-[9px] pl-[15px] transition-colors",
              input.trim() ? "border-primary" : "border-input-strong",
            )}
            onSubmit={submit}
          >
            <textarea
              className="max-h-[100px] min-h-[26px] flex-1 resize-none border-0 bg-transparent text-base leading-normal font-semibold text-foreground outline-none placeholder:text-gray-500"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(event);
                }
              }}
              placeholder={management ? "Ask about your business…" : "Ask or correct anything"}
              aria-label="Message"
            />
            {/* The composer's caption is gone: every draft row carries its own
                Edit chip now, so "you can correct any field here" was a second,
                vaguer version of an affordance already on the field. */}
            {busy ? (
              <IconButton
                className="size-[38px] bg-destructive text-white hover:bg-destructive-hover"
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
                className={cn("size-[38px]", !input.trim() && "bg-muted text-gray-500 shadow-none")}
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
              >
                <PaperPlaneRightIcon className="size-[18px]" weight="fill" />
              </IconButton>
            )}
          </form>
        )}
      </footer>
      {/* AnimatePresence has to sit outside the condition — it is what keeps each
          sheet mounted long enough for its exit to play. */}
      <AnimatePresence>
        {!management && paymentRequest && (
          <PaymentSheet
            conversationId={conversation.id}
            onCheckoutFailed={() => setIsland("idle")}
            onClose={() => {
              setPaymentRequest(null);
              setIsland("idle");
            }}
            onOpeningCheckout={() => setIsland("paying")}
            payment={paymentRequest}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pdfArtifact && (
          <PdfPreviewDialog artifact={pdfArtifact} onClose={() => setPdfArtifact(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Fill the composer rather than send: the citizen usually wants to change a word
// before asking, and a row that fires a request on one tap takes that away.
const BUSINESS_CHAT_STARTERS = [
  { icon: CalendarDotsIcon, text: "What’s next on my tax calendar?" },
  { icon: FolderOpenIcon, text: "Which files do I already have?" },
  { icon: ListChecksIcon, text: "Anything left to complete?" },
];
