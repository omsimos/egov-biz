"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Check,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  FilePdf,
  GlobeHemisphereWest,
  ListChecks,
  MagnifyingGlass,
  PaperPlaneRight,
  PencilSimple,
  ShieldCheck,
  Sparkle,
  StopCircle,
  X,
} from "@phosphor-icons/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { ProfileAvatar } from "@/components/profile-avatar";
import type { BirFormArtifact } from "@/lib/bir-form/artifact";
import type {
  BusinessChatMessage,
  DtiBusinessNameForm,
  RegistrationPlan,
} from "@/lib/business-chat";
import type { CitizenProfile } from "@/lib/citizen-profile";
import type { IntakeQuestion } from "@/lib/questions";

type AskUserPart = Extract<BusinessChatMessage["parts"][number], { type: "tool-askUser" }>;
type ReadyAskUserPart = AskUserPart & {
  state: "input-available";
  input: { question: IntakeQuestion };
};
type PendingQuestion = { part: ReadyAskUserPart; question: IntakeQuestion };

function textOf(message: BusinessChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function Markdown({ children, streaming = false }: { children: string; streaming?: boolean }) {
  return (
    <Streamdown controls={false} isAnimating={streaming} mode={streaming ? "streaming" : "static"}>
      {children}
    </Streamdown>
  );
}

function latestPlanToolCallId(messages: BusinessChatMessage[]) {
  for (const message of [...messages].reverse())
    for (const part of [...message.parts].reverse()) {
      if (
        part.type === "tool-updatePlan" &&
        (part.state === "output-available" || part.state === "input-available")
      )
        return part.toolCallId;
    }
  return null;
}

function PlanCard({ plan, active }: { plan: RegistrationPlan; active: boolean }) {
  return (
    <article className={`agent-plan-card ${active ? "active" : ""}`}>
      <header>
        <ListChecks weight="duotone" />
        <div>
          <small>REGISTRATION PLAN</small>
          <strong>{plan.title}</strong>
        </div>
      </header>
      <ol>
        {plan.steps.map((step) => (
          <li className={step.status} key={step.id}>
            <i>
              {step.status === "completed" ? (
                <Check weight="bold" />
              ) : step.status === "in_progress" ? (
                <CircleNotch className="spin" />
              ) : null}
            </i>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function QuestionComposer({
  pending,
  disabled,
  onAnswer,
}: {
  pending: PendingQuestion;
  disabled: boolean;
  onAnswer: (value: string | string[], labels: string[]) => void;
}) {
  const { question } = pending;
  const [value, setValue] = useState<string | string[]>(question.type === "multi" ? [] : "");
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const canSend = Array.isArray(value) ? value.length > 0 : Boolean(value.trim());
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || disabled) return;
    const values = Array.isArray(value) ? value : [value];
    onAnswer(
      value,
      values.map((item) => question.options?.find((option) => option.id === item)?.label ?? item),
    );
  };

  return (
    <form className="hitl-composer" onSubmit={submit}>
      <div className="hitl-copy">
        <span>
          <Sparkle weight="fill" />
        </span>
        <div>
          <strong>{question.title}</strong>
          <small>{question.helpText}</small>
        </div>
      </div>
      {question.type === "single" || question.type === "multi" ? (
        <fieldset className="hitl-options">
          <legend>{question.type === "multi" ? "Choose all that apply" : "Choose one"}</legend>
          {question.options?.map((option, index) => {
            const checked = selected.includes(option.id);
            return (
              <label key={option.id} className={checked ? "selected" : ""}>
                <input
                  type={question.type === "multi" ? "checkbox" : "radio"}
                  name={question.id}
                  value={option.id}
                  checked={checked}
                  onChange={() =>
                    setValue(
                      question.type === "multi"
                        ? checked
                          ? selected.filter((id) => id !== option.id)
                          : [...selected, option.id]
                        : option.id,
                    )
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
      ) : (
        <label className="hitl-input">
          <span>Your answer</span>
          <input
            type={question.type === "number" ? "number" : "text"}
            min={question.minimum}
            max={question.maximum}
            placeholder={question.placeholder ?? "Type your answer"}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
        </label>
      )}
      <button className="chat-submit-answer" type="submit" disabled={!canSend || disabled}>
        Continue <ArrowRight weight="bold" />
      </button>
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
  onSubmitPay,
}: {
  form: DtiBusinessNameForm;
  note?: string;
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
  return (
    <article className="dti-form-card">
      <header>
        <span className="dti-seal">DTI</span>
        <div>
          <small>BUSINESS NAME REGISTRATION</small>
          <strong>Application draft</strong>
        </div>
        <i className={form.missingFields.length ? "draft" : "ready"}>
          {form.missingFields.length ? "Needs input" : "Ready"}
        </i>
      </header>
      {note && (
        <p className="dti-note">
          <PencilSimple /> {note}
        </p>
      )}
      <div className="dti-fields">
        {rows.map(([label, value]) => (
          <div key={label} className={!value || value === "Needs your answer" ? "missing" : ""}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="dti-help">
        <Sparkle weight="fill" />
        <span>
          To change anything, type it below. For example: “Use the name Reyes Coffee Club.”
        </span>
      </div>
      <footer>
        <div>
          <small>PAYMENT</small>
          <strong>{form.feeLabel}</strong>
        </div>
        <button onClick={onSubmitPay} disabled={form.missingFields.length > 0}>
          Submit and pay <ArrowRight weight="bold" />
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
  latestPlanId,
  onSubmitPay,
  onPreviewPdf,
}: {
  part: BusinessChatMessage["parts"][number];
  latestPlanId: string | null;
  onSubmitPay: (form: DtiBusinessNameForm) => void;
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
  if (part.type === "tool-webSearch") return <SearchTool part={part} />;
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
  if (part.type === "tool-updatePlan") {
    if (part.toolCallId !== latestPlanId) return null;
    if (part.state === "output-available")
      return <PlanCard plan={part.output.plan} active={false} />;
    if (part.state === "input-available")
      return <PlanCard plan={{ title: part.input.title, steps: part.input.steps }} active />;
  }
  if (part.type === "tool-editDtiBusinessNameForm") {
    if (part.state === "output-available")
      return (
        <DtiFormCard
          form={part.output.form}
          note={part.input.note}
          onSubmitPay={() => onSubmitPay(part.output.form)}
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

function PaymentDialog({ form, onClose }: { form: DtiBusinessNameForm; onClose: () => void }) {
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
          proposedName: form.proposedName,
          territorialScope: form.territorialScope,
        }),
      });
      const result = (await response.json()) as { checkoutUrl?: string; error?: string };
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
          <p>You’ll choose an available payment method on eGovPay.</p>
        </div>
        <div className="payment-summary">
          <span>
            <small>DTI application</small>
            <strong>{form.proposedName}</strong>
          </span>
          <strong>{form.feeLabel}</strong>
        </div>
        {paymentError && (
          <p className="payment-inline-error" role="alert">
            {paymentError}
          </p>
        )}
        <button className="payment-confirm" onClick={openCheckout} disabled={opening}>
          <ShieldCheck weight="fill" /> {opening ? "Opening eGovPay…" : "Continue to eGovPay"}
        </button>
        <p className="payment-disclaimer">Payment is completed on the secure eGovPay page.</p>
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
  initialPrompt,
  profile,
  onBack,
}: {
  initialPrompt: string;
  profile: CitizenProfile | null;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const [paymentForm, setPaymentForm] = useState<DtiBusinessNameForm | null>(null);
  const [pdfArtifact, setPdfArtifact] = useState<BirFormArtifact | null>(null);
  const [answeringToolCallId, setAnsweringToolCallId] = useState<string | null>(null);
  const answeredToolCalls = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/agent/chat", body: { initialPrompt } }),
    [initialPrompt],
  );
  const { messages, sendMessage, status, stop, error, addToolOutput } =
    useChat<BusinessChatMessage>({
      id: `business-${initialPrompt.slice(0, 32)}`,
      transport,
    });
  const busy = status === "submitted" || status === "streaming";
  const latestPlanId = latestPlanToolCallId(messages);
  const pending: PendingQuestion | null = (() => {
    for (const message of [...messages].reverse()) {
      for (const part of [...message.parts].reverse()) {
        if (part.type === "tool-askUser" && part.state === "input-available") {
          const current = part as ReadyAskUserPart;
          return { part: current, question: current.input.question };
        }
      }
    }
    return null;
  })();

  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      void sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, sendMessage]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, status]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || pending) return;
    setInput("");
    void sendMessage({ text });
  };
  const answer = async (value: string | string[], labels: string[]) => {
    if (!pending || answeredToolCalls.current.has(pending.part.toolCallId)) return;
    const toolCallId = pending.part.toolCallId;
    answeredToolCalls.current.add(toolCallId);
    setAnsweringToolCallId(toolCallId);
    try {
      await addToolOutput({ tool: "askUser", toolCallId, output: { value, labels } });
      await sendMessage();
    } catch {
      answeredToolCalls.current.delete(toolCallId);
    } finally {
      setAnsweringToolCallId(null);
    }
  };

  return (
    <div className="screen agent-chat-screen">
      <div className="chat-status-bar" aria-hidden="true">
        <span>9:41</span>
        <span>● ◒ ▰</span>
      </div>
      <header className="chat-header">
        <button onClick={onBack} aria-label="Go back">
          <ArrowLeft />
        </button>
        <div className="chat-agent-avatar">
          <Sparkle weight="fill" />
          <i />
        </div>
        <div>
          <h1>Business registration</h1>
          <span>
            <ShieldCheck weight="fill" /> eGovPH service
          </span>
        </div>
        {profile && <ProfileAvatar profile={profile} />}
      </header>
      <main className="chat-thread" ref={scrollRef} id="app-content">
        <div className="chat-day">Today</div>
        {messages.map((message) => {
          const user = message.role === "user";
          const text = textOf(message);
          const hasVisibleTool = message.parts.some(
            (part) =>
              isToolUIPart(part) &&
              getToolName(part) !== "askUser" &&
              (part.type !== "tool-updatePlan" || part.toolCallId === latestPlanId),
          );
          if (!text && !hasVisibleTool) return null;
          const streaming = busy && message.id === messages.at(-1)?.id;
          return (
            <article className={`chat-message ${user ? "user" : "assistant"}`} key={message.id}>
              {!user && (
                <span className="message-avatar">
                  <Sparkle weight="fill" />
                </span>
              )}
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
                      latestPlanId={latestPlanId}
                      onSubmitPay={setPaymentForm}
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
            <span className="message-avatar">
              <Sparkle weight="fill" />
            </span>
            <div className="chat-working-shimmer">Working on the next step…</div>
          </div>
        )}
        {error && <div className="chat-error">I couldn’t continue. Please try again.</div>}
      </main>
      <footer className="chat-composer-shell">
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
                <ShieldCheck weight="fill" /> You can correct any field here
              </span>
              {busy ? (
                <button type="button" onClick={() => void stop()} aria-label="Stop">
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
      {paymentForm && <PaymentDialog form={paymentForm} onClose={() => setPaymentForm(null)} />}
      {pdfArtifact && (
        <PdfPreviewDialog artifact={pdfArtifact} onClose={() => setPdfArtifact(null)} />
      )}
    </div>
  );
}
