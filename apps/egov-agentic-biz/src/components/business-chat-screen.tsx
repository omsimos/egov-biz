"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  CircleNotch,
  GlobeHemisphereWest,
  ListChecks,
  MagnifyingGlass,
  PaperPlaneRight,
  PencilSimple,
  ShieldCheck,
  Sparkle,
  StopCircle,
  Plus,
  CaretDown,
  Trash,
  X,
} from "@phosphor-icons/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import type {
  BusinessChatMessage,
  BusinessConversation,
  ConversationSummary,
  DtiBusinessNameForm,
  RegistrationPlan,
} from "@/lib/business-chat";
import type { CitizenProfile } from "@/lib/citizen-profile";
import type { IntakeQuestion } from "@/lib/questions";

type AskUserPart = Extract<BusinessChatMessage["parts"][number], { type: "tool-askUser" }>;
type ReadyAskUserPart = AskUserPart & {
  state: "input-available";
  input: { questions?: IntakeQuestion[]; question?: IntakeQuestion };
};
type PendingQuestion = { part: ReadyAskUserPart; questions: IntakeQuestion[] };

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
  const allCompleted = plan.steps.length > 0 && completed === plan.steps.length;
  const current =
    plan.steps.find((step) => step.status === "in_progress") ??
    plan.steps.find((step) => step.status === "pending") ??
    plan.steps.at(-1);
  const currentLabel = allCompleted
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
          {allCompleted || current?.status === "completed" ? (
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
            {plan.steps.map((step) => (
              <li
                className={step.status}
                key={step.id}
                aria-current={step.status === "in_progress" ? "step" : undefined}
              >
                <i>
                  {step.status === "completed" ? (
                    <Check weight="bold" />
                  ) : step.status === "in_progress" ? (
                    <ArrowRight weight="bold" />
                  ) : null}
                </i>
                <span>{step.label}</span>
              </li>
            ))}
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
    if (question.type === "single" && value === "__other__")
      return Boolean(custom[question.id]?.trim());
    return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
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
        <Sparkle weight="fill" />
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
  return (
    <article className={`dti-form-card ${paid ? "paid" : ""}`}>
      <header>
        <span className="dti-seal">DTI</span>
        <div>
          <small>BUSINESS NAME REGISTRATION</small>
          <strong>Application draft</strong>
        </div>
        <i className={paid ? "paid" : form.missingFields.length ? "draft" : "ready"}>
          {paid ? "Paid" : form.missingFields.length ? "Needs input" : "Ready"}
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
        <button onClick={onSubmitPay} disabled={paid || form.missingFields.length > 0}>
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

function ToolPart({
  part,
  paid,
  onSubmitPay,
}: {
  part: BusinessChatMessage["parts"][number];
  paid: boolean;
  onSubmitPay: (form: DtiBusinessNameForm) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  if (name === "askUser") return null;
  if (part.type === "tool-webSearch") return <SearchTool part={part} />;
  if (part.type === "tool-updatePlan") return null;
  if (part.type === "tool-editDtiBusinessNameForm") {
    if (part.state === "output-available")
      return (
        <DtiFormCard
          form={part.output.form}
          note={part.input.note}
          paid={paid}
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

function PaymentDialog({
  form,
  profile,
  conversationId,
  onClose,
  onPaid,
}: {
  form: DtiBusinessNameForm;
  profile: CitizenProfile | null;
  conversationId: string;
  onClose: () => void;
  onPaid: () => Promise<void>;
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
          proposedName: form.proposedName,
          territorialScope: form.territorialScope,
          ownerName: form.ownerName,
          mobile: profile?.mobile,
        }),
      });
      const result = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
        payment?: { status?: string };
      };
      if (!response.ok || !result.checkoutUrl)
        throw new Error(result.error || "eGovPay could not open checkout.");
      await onPaid();
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
            You’ll continue to eGovPay in this tab. This demo will mark the application paid while
            webhook support is being completed.
          </p>
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
          <ShieldCheck weight="fill" /> {opening ? "Preparing checkout…" : "Continue to eGovPay"}
        </button>
        <p className="payment-disclaimer">
          Use “Back to merchant” after checkout to return to this saved chat.
        </p>
      </section>
    </div>
  );
}

export function BusinessChatScreen({
  conversation,
  conversations,
  profile,
  paymentStatus,
  onBack,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}: {
  conversation: BusinessConversation;
  conversations: ConversationSummary[];
  profile: CitizenProfile | null;
  paymentStatus?: string | null;
  onBack: () => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (conversation: ConversationSummary) => void;
}) {
  const [input, setInput] = useState("");
  const [paymentForm, setPaymentForm] = useState<DtiBusinessNameForm | null>(null);
  const [localPaymentStatus, setLocalPaymentStatus] = useState(
    paymentStatus ?? conversation.paymentStatus ?? null,
  );
  const [continuationError, setContinuationError] = useState("");
  const [answeringToolCallId, setAnsweringToolCallId] = useState<string | null>(null);
  const answeredToolCalls = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const initialPrompt = conversation.initialPrompt;
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/agent/chat", body: { profile, initialPrompt } }),
    [initialPrompt, profile],
  );
  const { messages, sendMessage, status, stop, error, addToolOutput } =
    useChat<BusinessChatMessage>({
      id: conversation.id,
      messages: conversation.messages,
      transport,
      resume: true,
    });
  const busy = status === "submitted" || status === "streaming";
  const paid = /paid|success|complete/i.test(localPaymentStatus ?? "");
  const latestPlan = latestRegistrationPlan(messages);
  const pending: PendingQuestion | null = (() => {
    for (const message of [...messages].reverse()) {
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
    if (conversation.messages.length === 0 && !seeded.current) {
      seeded.current = true;
      void sendMessage({ text: initialPrompt });
    }
  }, [conversation.messages.length, initialPrompt, sendMessage]);
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
  const continueAfterPayment = async () => {
    setLocalPaymentStatus("paid");
    setContinuationError("");
    try {
      // Add a non-visual event message so useChat always starts a new request.
      // Calling sendMessage() without a message can be ignored after a completed
      // assistant turn by some chat-state transitions.
      await sendMessage(
        {
          role: "user",
          parts: [{ type: "data-paymentCompleted", data: { status: "paid" } }],
        },
        { body: { event: "payment-completed" } },
      );
    } catch {
      setContinuationError("Payment is saved, but I couldn’t start the next step automatically.");
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
                  ? "Your plan is advancing to barangay clearance and local permit requirements."
                  : `Status: ${localPaymentStatus}. You can continue in this saved chat.`}
              </small>
            </span>
          </div>
        )}
        <div className="chat-day">Saved automatically</div>
        {messages.map((message) => {
          const user = message.role === "user";
          const text = textOf(message);
          const hasVisibleTool = message.parts.some(
            (part) =>
              isToolUIPart(part) &&
              getToolName(part) !== "askUser" &&
              part.type !== "tool-updatePlan",
          );
          if (!text && !hasVisibleTool) return null;
          const streaming = busy && message.id === messages.at(-1)?.id;
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
                      paid={paid}
                      onSubmitPay={setPaymentForm}
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
              <button type="button" onClick={() => void continueAfterPayment()} disabled={busy}>
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
      {paymentForm && (
        <PaymentDialog
          form={paymentForm}
          profile={profile}
          conversationId={conversation.id}
          onClose={() => setPaymentForm(null)}
          onPaid={continueAfterPayment}
        />
      )}
    </div>
  );
}
