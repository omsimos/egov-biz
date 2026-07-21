"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Check,
  CheckCircle,
  CircleNotch,
  Buildings,
  CalendarDots,
  Certificate,
  DownloadSimple,
  FilePdf,
  FileText,
  FlagCheckered,
  GlobeHemisphereWest,
  Headset,
  Info,
  ListChecks,
  MagnifyingGlass,
  Minus,
  PaperPlaneRight,
  PencilSimple,
  ShieldCheck,
  Storefront,
  StopCircle,
  Plus,
  CaretDown,
  Trash,
  X,
} from "@phosphor-icons/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { StatusBar } from "@/components/phone-chrome";
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
type PaymentRequest = {
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

function ComplianceResultCard({
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
          <small>DEMO RESULT</small>
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

function BarangayClearanceCard({
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
          <small>ELECTRONIC BARANGAY CLEARANCE</small>
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
        <small>DOCUMENTS SUBMITTED</small>
        <ul>
          {clearance.supportingDocuments.map((document) => (
            <li key={document}>
              <FileText /> {document}
            </li>
          ))}
        </ul>
      </section>
      <section className="local-permit-use">
        <small>USED FOR</small>
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
            <small>BARANGAY CLEARANCE FEE</small>
            <strong>{clearance.feeLabel}</strong>
          </div>
          <button
            type="button"
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

function EbplsPermitCard({
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
        <small>ATTACHMENTS SENT</small>
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
            <small>ASSESSED LGU FEES</small>
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

function PlanDock({ plan, active }: { plan: RegistrationPlan; active: boolean }) {
  const [expanded, setExpanded] = useState(false);
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
    <section
      className={`registration-plan-dock ${expanded ? "expanded" : "collapsed"} ${active ? "active" : ""}`}
      aria-label="Registration plan"
    >
      <button
        className="registration-plan-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls="registration-plan-items"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={`registration-plan-status ${current?.status ?? "pending"}`}>
          {allResolved || current?.status === "completed" ? (
            <Check weight="bold" />
          ) : current?.status === "in_progress" ? (
            <ArrowRight weight="bold" />
          ) : (
            <ListChecks weight="duotone" />
          )}
        </span>
        <span className="registration-plan-summary">
          <small>{expanded ? "REGISTRATION PLAN" : "CURRENT TASK"}</small>
          <strong>{expanded ? plan.title : currentLabel}</strong>
        </span>
        <span
          className="registration-plan-count"
          aria-label={`${completed} of ${plan.steps.length} tasks completed`}
        >
          {completed}/{plan.steps.length}
        </span>
        <CaretDown className="registration-plan-caret" weight="bold" />
      </button>
      <div
        className="registration-plan-reveal"
        id="registration-plan-items"
        aria-hidden={!expanded}
      >
        <div className="registration-plan-items">
          <ol>
            {plan.steps.map((step, index) => {
              const finishLine = index === plan.steps.length - 1;
              return (
                <li
                  className={`${step.status}${finishLine ? " finish-line" : ""}`}
                  key={step.id}
                  aria-current={step.status === "in_progress" ? "step" : undefined}
                  aria-label={step.status === "skipped" ? `${step.label} — skipped` : undefined}
                >
                  <i aria-hidden="true">
                    {step.status === "skipped" ? (
                      <Minus weight="bold" />
                    ) : finishLine ? (
                      <FlagCheckered weight={step.status === "completed" ? "fill" : "duotone"} />
                    ) : step.status === "completed" ? (
                      <Check weight="bold" />
                    ) : step.status === "in_progress" ? (
                      <ArrowRight weight="bold" />
                    ) : null}
                  </i>
                  <span>
                    {step.label}
                    {step.status === "skipped" && (
                      <small className="registration-plan-skipped-label"> (skipped)</small>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
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
    <form className="hitl-composer" onSubmit={submit}>
      <div className="hitl-batch-intro">
        <ListChecks weight="bold" />
        <span>
          <strong>Complete this checkpoint</strong>
          <small>
            Question {questionIndex + 1} of {pending.questions.length}
          </small>
        </span>
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
        return (
          <section className="hitl-question" key={question.id}>
            <div className="hitl-copy">
              <b>{questionIndex + 1}</b>
              <div>
                <strong>{question.title}</strong>
                <small>{question.helpText}</small>
              </div>
            </div>
            {question.type === "single" || question.type === "multi" ? (
              <>
                <fieldset className="hitl-options">
                  <legend>
                    {question.type === "multi" ? "Choose all that apply" : "Choose one"}
                  </legend>
                  {options.map((option, index) => {
                    const checked = selected.includes(option.id);
                    return (
                      <label key={option.id} className={checked ? "selected" : ""}>
                        <input
                          type={question.type === "multi" ? "checkbox" : "radio"}
                          name={question.id}
                          value={option.id}
                          checked={checked}
                          onChange={() =>
                            setValues((current) => ({
                              ...current,
                              [question.id]:
                                question.type === "multi"
                                  ? checked
                                    ? selected.filter((id) => id !== option.id)
                                    : [...selected, option.id]
                                  : option.id,
                            }))
                          }
                        />
                        <i>{checked && <Check weight="bold" />}</i>
                        <span>
                          <b>{String.fromCharCode(65 + index)}</b>
                          <strong>{option.label}</strong>
                          {option.description && <small>{option.description}</small>}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
                {question.type === "single" && value === "__other__" && (
                  <label className="hitl-input custom">
                    <span>Your answer</span>
                    <input
                      value={custom[question.id] ?? ""}
                      onChange={(event) =>
                        setCustom((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                      placeholder="Type your answer"
                      autoFocus
                    />
                  </label>
                )}
              </>
            ) : (
              <label className="hitl-input">
                <span>Your answer</span>
                <input
                  type={question.type === "number" ? "number" : "text"}
                  min={question.minimum}
                  max={question.maximum}
                  placeholder={question.placeholder ?? "Type your answer"}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [question.id]: event.target.value }))
                  }
                  autoFocus
                />
                {enteredText && !complete(question) && (
                  <small role="alert">
                    {question.id === "business-address"
                      ? "Enter the full street, building, or unit and barangay."
                      : "Enter the complete proposed business name."}
                  </small>
                )}
              </label>
            )}
          </section>
        );
      })()}
      <div className="hitl-navigation">
        {questionIndex > 0 && (
          <button
            type="button"
            onClick={() => setQuestionIndex((current) => current - 1)}
            disabled={disabled}
          >
            <ArrowLeft /> Back
          </button>
        )}
        <button className="chat-submit-answer" type="submit" disabled={!canContinue || disabled}>
          {lastQuestion ? "Complete details" : "Next question"} <ArrowRight weight="bold" />
        </button>
      </div>
    </form>
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
    <div className={`chat-tool-row ${complete ? "complete" : failed ? "error" : "active"}`}>
      {complete ? <CheckCircle weight="fill" /> : failed ? <X /> : <MagnifyingGlass />}
      <div>
        <small>
          {complete
            ? "Searched official sources"
            : failed
              ? "Search unavailable"
              : "Searching official sources"}
        </small>
        {"input" in part && part.input && (
          <span className={!complete && !failed ? "chat-shimmer" : ""}>{part.input.query}</span>
        )}
      </div>
      <GlobeHemisphereWest />
    </div>
  );
}

function DtiFormCard({
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
    <article className={`dti-form-card ${paid ? "paid" : ""}`}>
      <header>
        <span className="dti-seal">DTI</span>
        <div>
          <small>BUSINESS NAME REGISTRATION</small>
          <strong>Application draft</strong>
        </div>
        <i className={paid ? "paid" : "ready"}>{paid ? "Paid" : "Ready"}</i>
      </header>
      {note && (
        <p className="dti-note">
          <PencilSimple /> {note}
        </p>
      )}
      <div className="dti-fields">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="dti-help">
        <Info weight="fill" />
        <span>
          {paid
            ? "Payment recorded. This application checkpoint is complete."
            : "To change anything, type it below. For example: “Use the name Reyes Coffee Club.”"}
        </span>
      </div>
      <footer>
        <div>
          <small>PAYMENT</small>
          <strong>{form.feeLabel}</strong>
        </div>
        <button onClick={onSubmitPay} disabled={paid}>
          {paid ? (
            <>
              <CheckCircle weight="fill" /> Paid
            </>
          ) : (
            <>
              Submit and pay <ArrowRight weight="bold" />
            </>
          )}
        </button>
      </footer>
    </article>
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
    <button className="pdf-artifact-card" type="button" onClick={onPreview}>
      <span className="pdf-artifact-icon">
        <FilePdf weight="fill" />
      </span>
      <span className="pdf-artifact-copy">
        <small>PDF ARTIFACT</small>
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
            <small>BIR REGISTRATION CHECKPOINT</small>
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
    if (part.state !== "output-available") return null;
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
      <a className="business-finalized-card" href={`/?business=${part.output.businessId}`}>
        <span>
          <Storefront weight="duotone" />
        </span>
        <div>
          <small>ALL SET UP · DEMO COMPLETE</small>
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

function PaymentDialog({
  payment,
  conversationId,
  onClose,
}: {
  payment: PaymentRequest;
  conversationId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  useEffect(() => {
    dialogRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const openCheckout = async () => {
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
      setPaymentError(error instanceof Error ? error.message : "eGovPay could not open checkout.");
      setOpening(false);
    }
  };

  return (
    <div className="chat-dialog-layer">
      <button className="chat-dialog-scrim" onClick={onClose} aria-label="Close payment" />
      <section
        className="chat-payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <button className="chat-dialog-close" onClick={onClose} aria-label="Close">
          <X />
        </button>
        <div className="payment-service">
          <span>
            <ShieldCheck weight="duotone" />
          </span>
          <small>eGovPay</small>
          <h2 id="payment-title">Continue to secure payment</h2>
          <p>
            You’ll continue to eGovPay in this tab. This demo will mark the fee paid while webhook
            support is being completed.
          </p>
        </div>
        <div className="payment-summary">
          <span>
            <small>{payment.serviceLabel}</small>
            <strong>{payment.proposedName}</strong>
          </span>
          <strong>{payment.feeLabel}</strong>
        </div>
        {paymentError && (
          <p className="payment-inline-error" role="alert">
            {paymentError}
          </p>
        )}
        <button className="payment-confirm" onClick={openCheckout} disabled={opening}>
          <ShieldCheck weight="fill" /> {opening ? "Preparing checkout…" : "Continue to eGovPay"}
        </button>
        <p className="payment-disclaimer">
          Use “Back to merchant” after checkout to return to this saved chat.
        </p>
      </section>
    </div>
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
      <button className="chat-dialog-scrim" onClick={onClose} aria-label="Close PDF preview" />
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
            <small>PDF PREVIEW</small>
            <h2 id="pdf-preview-title">BIR Form 1901</h2>
          </div>
          <button className="chat-dialog-close" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <iframe src={artifact.url} title="BIR Form 1901 PDF preview" />
        <footer>
          <a href={artifact.url} download={artifact.filename}>
            <DownloadSimple weight="bold" /> Download PDF
          </a>
          <a href={artifact.url} target="_blank" rel="noreferrer">
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
        <button onClick={onBack} aria-label="Go back">
          <ArrowLeft />
        </button>
        <div className="chat-agent-avatar">
          <Headset weight="fill" />
        </div>
        <button className="chat-session-trigger" onClick={() => setHistoryOpen((open) => !open)}>
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
                  onClick={() => {
                    setHistoryOpen(false);
                    onSelectConversation(item.id);
                  }}
                >
                  {item.title}
                </button>
                <button
                  className="chat-session-delete"
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
            <div className="chat-working-shimmer">Preparing your next registration step…</div>
          </div>
        )}
        {(error || continuationError) && (
          <div className="chat-error">
            {continuationError || "I couldn’t continue. Please try again."}
            {paid && (
              <button
                type="button"
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
        {latestPlan && <PlanDock plan={latestPlan.plan} active={latestPlan.active} />}
        {pending ? (
          <QuestionComposer
            key={pending.part.toolCallId}
            pending={pending}
            disabled={busy || answeringToolCallId === pending.part.toolCallId}
            onAnswer={answer}
          />
        ) : (
          <form className="chat-composer" onSubmit={submit}>
            <textarea
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
            <div>
              <span>
                <ShieldCheck weight="fill" /> Saved automatically
              </span>
              {busy ? (
                <button
                  className="chat-stop"
                  type="button"
                  onClick={() => void stop()}
                  aria-label="Stop"
                >
                  <StopCircle weight="fill" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} aria-label="Send">
                  <PaperPlaneRight weight="fill" />
                </button>
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
