"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BellSimple,
  Briefcase,
  Buildings,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  Clock,
  Coffee,
  CreditCard,
  DotsThree,
  DownloadSimple,
  FirstAid,
  House,
  IdentificationCard,
  Laptop,
  MapPin,
  MegaphoneSimple,
  Newspaper,
  QrCode,
  Receipt,
  ShieldCheck,
  ShoppingBagOpen,
  Sparkle,
  Storefront,
  SuitcaseRolling,
  UserCircle,
  Users,
  X,
} from "@phosphor-icons/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CitizenProfile, RegisteredBusiness, RegistrationAction } from "@/lib/mock-data";
import { mockActions } from "@/lib/mock-data";
import { agencyChecks } from "@/lib/business-rules";
import type { BusinessPlan, IntakeAnswer, IntakeQuestion, QuestionOption } from "@/lib/questions";
import { useMockApi } from "@/lib/use-mock-api";

type Screen = "home" | "business" | "intake" | "plan";
type Answer = string | string[];

const suggestions = [
  "I want to start a coffee subscription business in Makati",
  "I’m a freelancer and want to register with BIR",
  "Help me open a small online shop",
];

const serviceItems = [
  { label: "NGAs", icon: Buildings },
  { label: "LGUs", icon: Buildings },
  { label: "Jobs", icon: Briefcase, badge: "New" },
  { label: "Business", icon: Storefront, badge: "New", business: true },
  { label: "Travel", icon: SuitcaseRolling },
  { label: "Health", icon: FirstAid },
  { label: "Report", icon: MegaphoneSimple },
  { label: "More", icon: DotsThree },
];

const qrCells = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9);
  const column = index % 9;
  const finder =
    ((row <= 2 && column <= 2) || (row <= 2 && column >= 6) || (row >= 6 && column <= 2)) &&
    !(row === 1 && (column === 1 || column === 7)) &&
    !(row === 7 && column === 1);
  return finder || ((row * 7 + column * 3 + index) % 5 < 2 && !(row === 4 && column === 4));
});

function EGovLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`egov-logo ${compact ? "compact" : ""}`} aria-label="eGovPH">
      <span>eG</span><span className="logo-sun">O</span><span>V</span><small>PH</small>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <div className="status-icons"><span className="signal" /><span className="wifi">◒</span><span className="battery" /></div>
    </div>
  );
}

function BottomNav({ active = "home" }: { active?: "home" | "business" }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button className={active === "home" ? "active" : ""}><House weight={active === "home" ? "fill" : "regular"} /><span>Home</span></button>
      <button><Newspaper /><span>News</span></button>
      <button className="id-button" aria-label="Digital ID"><IdentificationCard weight="duotone" /></button>
      <button><Receipt /><i>5</i><span>History</span></button>
      <button><UserCircle /><span>Account</span></button>
    </nav>
  );
}

function Header({ title, onBack, profile }: { title?: string; onBack?: () => void; profile?: CitizenProfile | null }) {
  return (
    <header className="app-header">
      {onBack ? <button className="icon-button" onClick={onBack} aria-label="Go back"><ArrowLeft /></button> : <EGovLogo compact />}
      {title ? <h1>{title}</h1> : <span />}
      {profile ? (
        <Image className="header-avatar" src={profile.avatarUrl} width={36} height={36} alt={`${profile.fullName} profile`} />
      ) : (
        <button className="notification-button" aria-label="Notifications"><BellSimple weight="fill" /><i /></button>
      )}
    </header>
  );
}

function HomeScreen({ profile, onBusiness }: { profile: CitizenProfile | null; onBusiness: () => void }) {
  return (
    <div className="screen home-screen">
      <StatusBar />
      <div className="home-scroll" id="app-content">
        <Header />
        <section className="profile-hero">
          <div className="profile-copy">
            {profile ? <Image src={profile.avatarUrl} width={56} height={56} alt="" /> : <div className="avatar-skeleton" />}
            <div><strong>Hi, {profile?.firstName ?? "there"}</strong><span>{profile?.mobile ?? "Loading…"}</span></div>
          </div>
          <div className="sun-card" aria-hidden="true"><span className="sun-rays">✦</span><div className="sun-hill" /><div className="sun-wave" /></div>
        </section>

        <section className="service-grid" aria-label="eGovPH services">
          {serviceItems.map(({ label, icon: Icon, badge, business }) => (
            <button key={label} className={business ? "business-service" : ""} onClick={business ? onBusiness : undefined}>
              <span className="service-icon"><Icon weight="duotone" />{badge && <i>{badge}</i>}</span>
              <span>{label}</span>
            </button>
          ))}
        </section>

        <button className="business-banner" onClick={onBusiness}>
          <span className="banner-mark"><Storefront weight="duotone" /></span>
          <span><small>NEW IN eGovPH</small><strong>Start and grow your business</strong><em>One guided path across government services</em></span>
          <ArrowRight />
        </button>

        <section className="featured-section">
          <div className="section-heading"><div><small>CONNECTED SERVICES</small><h2>Featured for you</h2></div><button>See all</button></div>
          <div className="feature-cards">
            <article><span>National documents</span><strong>National Government Services</strong><div className="building-illustration"><Buildings weight="duotone" /></div></article>
            <article><span>Near your address</span><strong>Makati City Services</strong><div className="building-illustration"><MapPin weight="duotone" /></div></article>
          </div>
        </section>
      </div>
      <BottomNav />
    </div>
  );
}

function BusinessLanding({
  profile,
  businesses,
  businessesLoading,
  initialPrompt,
  onBack,
  onSubmit,
}: {
  profile: CitizenProfile | null;
  businesses: RegisteredBusiness[] | null;
  businessesLoading: boolean;
  initialPrompt: string;
  onBack: () => void;
  onSubmit: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (prompt.trim()) onSubmit(prompt.trim());
  }

  return (
    <div className="screen business-screen">
      <StatusBar />
      <Header title="Business" onBack={onBack} profile={profile} />
      <div className="business-scroll" id="app-content">
        <section className="business-intro">
          <div className="assistant-orbit"><Sparkle weight="fill" /><i /><i /></div>
          <span className="secure-label"><ShieldCheck weight="fill" /> eGovPH</span>
          <h2>Describe your business</h2>
          <p>Tell us what you want to sell or do.</p>
        </section>

        <form className="prompt-box" onSubmit={submit}>
          <textarea ref={inputRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe your business idea…" rows={3} aria-label="Describe your business idea" />
          <div><span><ShieldCheck weight="fill" /> Your details stay private</span><button type="submit" disabled={!prompt.trim()} aria-label="Continue"><ArrowRight weight="bold" /></button></div>
        </form>

        <section className="suggestions-section">
          <h3>Try asking</h3>
          <div className="suggestion-list">
            {suggestions.map((suggestion, index) => (
              <button key={suggestion} onClick={() => { setPrompt(suggestion); inputRef.current?.focus(); }}>
                <span>{index === 0 ? <Coffee /> : index === 1 ? <Laptop /> : <ShoppingBagOpen />}</span>
                {suggestion}<ArrowRight />
              </button>
            ))}
          </div>
        </section>

        <section className="linked-businesses">
          <div className="section-heading"><div><small>LINKED TO YOUR TIN</small><h2>Your businesses</h2></div><button aria-label="Show business options"><DotsThree /></button></div>
          {businessesLoading ? <div className="business-record skeleton-card" /> : businesses?.map((business) => (
            <article className="business-record" key={business.id}>
              <span className="record-icon"><Briefcase weight="duotone" /></span>
              <div><strong>{business.name}</strong><span>{business.type}</span><small>{business.registrationNumber}</small></div>
              <i>{business.status}</i>
            </article>
          ))}
          <p><ShieldCheck weight="fill" /> Matched to your eGovPH account.</p>
        </section>
      </div>
      <BottomNav active="business" />
    </div>
  );
}

function optionIcon(option: QuestionOption) {
  const icons = { store: Storefront, laptop: Laptop, coffee: Coffee, home: House, pin: MapPin, calendar: CalendarBlank };
  const Icon = icons[option.icon ?? "store"];
  return <Icon weight="duotone" />;
}

function QuestionTool({ question, answer, onChange }: { question: IntakeQuestion; answer?: Answer; onChange: (answer: Answer) => void }) {
  if (question.type === "text") {
    return (
      <div className="text-tool">
        <textarea
          rows={3}
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder ?? "Type your answer"}
          autoFocus
        />
      </div>
    );
  }

  if (question.type === "number") {
    const value = typeof answer === "string" ? answer : "";
    const numeric = Number(value || question.minimum || 1);
    return (
      <div className="number-tool">
        <button onClick={() => onChange(String(Math.max(question.minimum ?? 0, numeric - 1)))} aria-label="Decrease"><span>−</span></button>
        <label><input type="number" min={question.minimum} max={question.maximum} placeholder={question.placeholder} value={value} onChange={(event) => onChange(event.target.value)} autoFocus /><span>{numeric === 1 ? question.suffix : `${question.suffix}s`}</span></label>
        <button onClick={() => onChange(String(Math.min(question.maximum ?? 999, numeric + 1)))} aria-label="Increase"><span>+</span></button>
      </div>
    );
  }

  const selected = Array.isArray(answer) ? answer : answer ? [answer] : [];
  return (
    <div className={`question-options ${question.type === "multi" ? "multi" : ""}`}>
      {question.options?.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button key={option.id} className={isSelected ? "selected" : ""} onClick={() => {
            if (question.type === "single") onChange(option.id);
            else onChange(isSelected ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
          }} aria-pressed={isSelected}>
            <span className="option-icon">{optionIcon(option)}</span>
            <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
            <i>{question.type === "multi" ? (isSelected ? <Check weight="bold" /> : null) : <span />}</i>
          </button>
        );
      })}
    </div>
  );
}

type QuestionDecision =
  | { status: "question"; question: IntakeQuestion; source?: string }
  | { status: "ready"; plan: BusinessPlan; source?: string };

function answerRecord(question: IntakeQuestion, value: Answer): IntakeAnswer {
  const values = Array.isArray(value) ? value : [value];
  return {
    questionId: question.id,
    question: question.title,
    value,
    labels: values.map((item) => question.options?.find((option) => option.id === item)?.label ?? item),
  };
}

function IntakeScreen({ initialQuestion, prompt, city, onBack, onComplete }: { initialQuestion: IntakeQuestion; prompt: string; city: string; onBack: () => void; onComplete: (plan: BusinessPlan) => void }) {
  const [questions, setQuestions] = useState<IntakeQuestion[]>([initialQuestion]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [checking, setChecking] = useState(false);
  const question = questions[step];
  const answer = answers[question.id];
  const canContinue = Array.isArray(answer) ? answer.length > 0 : Boolean(answer);

  async function next() {
    if (!canContinue) return;
    const history = questions.slice(0, step + 1).map((item) => answerRecord(item, answers[item.id]));
    setChecking(true);
    try {
      const response = await fetch("/api/agent/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, city, answers: history }),
      });
      if (!response.ok) throw new Error("Could not continue");
      const decision = (await response.json()) as QuestionDecision;
      if (decision.status === "ready") {
        onComplete(decision.plan);
        return;
      }
      setQuestions((current) => [...current.slice(0, step + 1), decision.question]);
      setStep((current) => current + 1);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="screen intake-screen">
      <StatusBar />
      <header className="intake-header">
        <button className="icon-button" onClick={step ? () => setStep(step - 1) : onBack} aria-label="Go back"><ArrowLeft /></button>
        <div className="progress-track"><span style={{ width: `${Math.min(90, 24 + step * 16)}%` }} /></div>
        <span>Question {step + 1}</span>
      </header>
      <div className="intake-scroll" id="app-content">
        <div className="intent-pill"><Coffee weight="fill" /><span>{prompt}</span></div>
        <section className="question-copy" key={`${question.id}-copy`}>
          <small><Sparkle weight="fill" /> {question.eyebrow}</small>
          <h1>{question.title}</h1>
          <p>{question.helpText}</p>
        </section>
        <section className="question-tool" key={question.id}>
          <div className="tool-label"><span>{question.type === "multi" ? "Choose all that apply" : question.type === "number" ? "Enter a number" : "Choose one"}</span></div>
          <QuestionTool question={question} answer={answer} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
        </section>
      </div>
      <div className="intake-footer">
        <button onClick={next} disabled={!canContinue || checking}>{checking ? "Checking…" : "Continue"}{!checking && <ArrowRight weight="bold" />}</button>
        <span>You can go back and change an answer.</span>
      </div>
    </div>
  );
}

function LoadingIntake() {
  return (
    <div className="screen intake-screen loading-screen">
      <StatusBar /><div className="loading-agent"><div className="assistant-orbit"><Sparkle weight="fill" /><i /><i /></div><h1>Getting the right questions…</h1><div className="loading-bars"><span /><span /><span /></div></div>
    </div>
  );
}

function ActionStatus({ action, completed }: { action: RegistrationAction; completed: boolean }) {
  if (completed) return <span className="action-status completed"><CheckCircle weight="fill" /> Done</span>;
  if (action.status === "ready") return <span className="action-status ready"><Sparkle weight="fill" /> Ready</span>;
  if (action.status === "up-next") return <span className="action-status upcoming">Up next</span>;
  return <span className="action-status locked">Later</span>;
}

function QRGraphic() {
  return <div className="qr-graphic" aria-label="Mock payment QR code">{qrCells.map((filled, index) => <i key={index} className={filled ? "filled" : ""} />)}<span><EGovLogo compact /></span></div>;
}

function ActionSheet({ action, profile, completed, onClose, onComplete }: { action: RegistrationAction; profile: CitizenProfile | null; completed: boolean; onClose: () => void; onComplete: () => void }) {
  const [payment, setPayment] = useState(false);
  return (
    <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={action.title}>
      <button className="sheet-scrim" onClick={onClose} aria-label="Close" />
      <section className="action-sheet">
        <div className="sheet-handle" /><button className="sheet-close" onClick={onClose} aria-label="Close"><X /></button>
        {!payment ? <>
          <div className="agency-seal">{action.agency === "DTI" ? "DTI" : action.agency === "BIR" ? "BIR" : "LGU"}</div>
          <small>{action.agency} DIGITAL SERVICE</small><h2>{action.title}</h2><p>{action.description}</p>
          <div className="action-facts"><span><MapPin weight="fill" /><small>WHERE</small><strong>{action.location}</strong></span><span><Clock weight="fill" /><small>ESTIMATED TIME</small><strong>{action.eta}</strong></span><span><CreditCard weight="fill" /><small>FEE</small><strong>{action.fee}</strong></span></div>
          <div className="requirements"><h3>I’ll prepare these details</h3>{action.requirements.map((requirement, index) => <div key={requirement}><CheckCircle weight="fill" /><span>{requirement}</span>{index < 2 && <small>From eGovPH</small>}</div>)}</div>
          <div className="identity-note"><ShieldCheck weight="fill" /><span><strong>Your identity is ready</strong><small>{profile?.fullName} · {profile?.tinMasked}</small></span></div>
          <button className="primary-action" disabled={completed || action.status === "locked"} onClick={() => action.id === "dti" ? setPayment(true) : onComplete()}>{completed ? "Application completed" : action.status === "locked" ? "Complete earlier steps first" : "Start this application"}<ArrowRight weight="bold" /></button>
        </> : <>
          <div className="payment-header"><span><QrCode weight="duotone" /></span><small>PAYMENT</small><h2>Pay the DTI registration fee</h2><p>Scan with your banking app.</p></div>
          <QRGraphic />
          <div className="payment-total"><span>DTI name registration<div>NCR scope + documentary stamp</div></span><strong>₱530.00</strong></div>
          <button className="primary-action" onClick={onComplete}>Confirm payment<ShieldCheck weight="fill" /></button>
          <p className="mock-disclaimer">Demo only. No payment will be made.</p>
        </>}
      </section>
    </div>
  );
}

function PlanScreen({ profile, plan, onHome }: { profile: CitizenProfile | null; plan: BusinessPlan; onHome: () => void }) {
  const [selected, setSelected] = useState<RegistrationAction | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const actions = useMemo(() => {
    const baseActions = plan.registrationType === "Self-employed"
      ? mockActions.filter((action) => action.id === "bir").map((action) => ({
          ...action,
          status: "ready" as const,
          title: "Register as self-employed",
          description: "Register your professional activity under your individual TIN.",
        }))
      : mockActions.map((action, index) => ({
          ...action,
          description: action.id === "dti" ? `Register ${plan.businessLabel} as a sole proprietorship.` : action.description,
          status: index === 1 && completed.includes("dti") ? "ready" as const : action.status,
        }));
    const extraActions: RegistrationAction[] = agencyChecks
      .filter((check) => plan.flags.includes(check.appliesWhen))
      .map((check) => ({
        id: check.id,
        agency: check.agency,
        title: check.title,
        description: check.description,
        location: check.agency,
        fee: "To be assessed",
        eta: "Check with agency",
        status: "up-next",
        requirements: check.note ? [check.note, "Valid government ID", "Business registration records"] : ["Valid government ID", "Business registration records"],
      }));
    return [...baseActions, ...extraActions];
  }, [completed, plan]);

  function complete(action: RegistrationAction) {
    setCompleted((current) => current.includes(action.id) ? current : [...current, action.id]);
    setSelected(null);
  }

  return (
    <div className="screen plan-screen">
      <StatusBar /><Header title="Your business plan" onBack={onHome} profile={profile} />
      <div className="plan-scroll" id="app-content">
        <section className="agent-summary">
          <span className="agent-avatar"><Sparkle weight="fill" /></span>
          <div><p>Your path is ready for <strong>{plan.businessLabel}</strong> in {plan.city}.</p><span><ShieldCheck weight="fill" /> Details checked</span></div>
        </section>
        <div className="plan-title"><h1>Ready, {profile?.firstName ?? "Mara"}.</h1><p>Complete these steps in order.</p></div>
        <div className="plan-chips"><span><Storefront /> {plan.registrationType}</span><span><MapPin /> {plan.city}</span><span><Users /> {plan.people} {plan.people === 1 ? "person" : "people"}</span></div>

        <section className="action-list">
          {actions.map((action, index) => {
            const isCompleted = completed.includes(action.id);
            return (
              <article key={action.id} className={`${action.status} ${isCompleted ? "is-completed" : ""}`}>
                <div className="step-rail"><span>{isCompleted ? <Check weight="bold" /> : index + 1}</span>{index < actions.length - 1 && <i />}</div>
                <button onClick={() => setSelected(action)} disabled={action.status === "locked"}>
                  <div className="action-top"><span className="agency-tag">{action.agency}</span><ActionStatus action={action} completed={isCompleted} /></div>
                  <h2>{action.title}</h2><p>{action.description}</p>
                  <div className="action-meta"><span><MapPin /> {action.location}</span><span><Clock /> {action.eta}</span></div>
                  <div className="action-bottom"><strong>{isCompleted ? "View receipt" : action.status === "ready" ? "Open service" : action.status === "locked" ? "Complete prior steps" : "Review requirements"}</strong><ArrowRight /></div>
                </button>
              </article>
            );
          })}
        </section>
        <section className="requirements-overview"><span><DownloadSimple /></span><div><small>YOUR REQUIREMENTS</small><strong>5 documents found in eGovPH</strong><p>2 more will be created as you complete the plan.</p></div><CaretDown /></section>
        <p className="prototype-note">Demo only. Check final fees with the agency.</p>
      </div>
      {selected && <ActionSheet action={selected} profile={profile} completed={completed.includes(selected.id)} onClose={() => setSelected(null)} onComplete={() => complete(selected)} />}
    </div>
  );
}

export function EgaphBusinessApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [prompt, setPrompt] = useState("");
  const [firstQuestion, setFirstQuestion] = useState<IntakeQuestion | null>(null);
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const { data: profile } = useMockApi<CitizenProfile>("/api/profile");
  const { data: businesses, loading: businessesLoading } = useMockApi<RegisteredBusiness[]>("/api/businesses");

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  async function startIntake(value: string) {
    setPrompt(value); setLoadingQuestions(true); setScreen("intake");
    try {
      const response = await fetch("/api/agent/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: value, city: profile?.city ?? "Makati City" }) });
      if (!response.ok) throw new Error("Could not start");
      const decision = (await response.json()) as QuestionDecision;
      if (decision.status === "ready") {
        setPlan(decision.plan);
        setScreen("plan");
      } else {
        setFirstQuestion(decision.question);
      }
    } catch {
      setFirstQuestion({
        id: "business-type",
        eyebrow: "First",
        title: "Will you run the business yourself?",
        helpText: "Choose the closest match.",
        type: "single",
        options: [
          { id: "alone", label: "Yes, by myself", icon: "store" },
          { id: "partners", label: "No, with partners", icon: "coffee" },
        ],
      });
    } finally { setLoadingQuestions(false); }
  }

  return (
    <div className="prototype-stage">
      <div className="context-panel" aria-hidden="true">
        <EGovLogo /><p>Business</p><h2>Start your business,<br />step by step.</h2><span>One clear path through government services.</span>
        <div className="context-foot"><i /><span>Demo</span></div>
      </div>
      <div className="phone-shell">
        {screen === "home" && <HomeScreen profile={profile} onBusiness={() => setScreen("business")} />}
        {screen === "business" && <BusinessLanding profile={profile} businesses={businesses} businessesLoading={businessesLoading} initialPrompt={prompt} onBack={() => setScreen("home")} onSubmit={startIntake} />}
        {screen === "intake" && (loadingQuestions || !firstQuestion ? <LoadingIntake /> : <IntakeScreen initialQuestion={firstQuestion} prompt={prompt} city={profile?.city ?? "Makati City"} onBack={() => setScreen("business")} onComplete={(nextPlan) => { setPlan(nextPlan); setScreen("plan"); }} />)}
        {screen === "plan" && plan && <PlanScreen profile={profile} plan={plan} onHome={() => setScreen("business")} />}
      </div>
    </div>
  );
}
