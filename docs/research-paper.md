# Grounding the Gavel: A Multi-Agent Civic Platform for Understanding and Fact-Checking Philippine Congressional Proceedings

*Philippine eGov Hackathon — Concept & Feasibility Paper*
*Prepared 2026-07-21. Factual claims about data sources were verified against primary sources on this date; verification is a point-in-time snapshot and endpoints may change.*

---

## 1. Executive summary

Philippine congressional sessions and committee hearings are streamed publicly, yet they remain effectively closed to the citizens they serve: they run for hours, are conducted in Filipino and Taglish, and offer no way to tell whether what is said on the floor is true. Publicity is not the same as accessibility, and accessibility without verifiability is not the same as informed citizenship.

We — the Omsimos team — propose a civic platform that turns these proceedings into an accessible, comprehensible, and *verifiable* public record. A citizen can ask a plain-language question and be guided to the relevant hearings; open a session and receive a grounded summary of what was said and decided; and see every notable claim checked against authoritative government records — each returned as **claim → verdict → cited source → backing excerpt**. Surrounding the conversation are two structured surfaces that make the institution legible: an **agenda calendar** of sessions, hearings, and committee meetings, and a **legislative-data explorer** of bills, legislators, sessions, and statistics. Crucially, these surfaces are not decoration — they share the same authoritative data the fact-checker uses, so browsing and verification reinforce one another.

The design is deliberately *not* "transcribe and dump into a chatbot." A working transcription proof-of-concept already exists; on top of it Omsimos adds a text-refinement layer built on eGovPH's AI Assistant and Translator services, a multi-agent retrieval pipeline grounded in credible government data, and a fact-checker whose every verdict is traceable to a record. The government data backbone — legislative records, jurisprudence, and the national budget — is confirmed live and openly accessible today, so the premise is feasible now, not aspirational.

---

## 2. Problem statement

Both chambers of Congress broadcast their proceedings. The House of Representatives operates an official streaming page ([congress.gov.ph/streaming](https://www.congress.gov.ph/streaming/)) and YouTube channel ([@HouseofRepresentativesPH](https://www.youtube.com/@HouseofRepresentativesPH/streams)); the Senate streams on YouTube ([@senateofthephilippines](https://www.youtube.com/@senateofthephilippines/streams)). The raw material of democratic accountability is, in principle, already public.

In practice, four barriers stand between a citizen and that material:

1. **Duration.** Sessions and hearings run for hours. A single session captured by our proof-of-concept — "19th Congress 3rd Regular Session #07" — runs ~97 minutes (5,840 seconds); full hearing days routinely run far longer. Few citizens can watch proceedings end to end to learn what was decided.

2. **Comprehension.** Proceedings are conducted in Filipino and Taglish (Tagalog-English code-switching). Filipino is under-resourced in language technology relative to major languages — the very gap the *Batayan* Filipino NLP benchmark was built to measure ([arXiv:2502.14911](https://arxiv.org/abs/2502.14911)) — and automatic captions reflect it: our sample auto-caption output contains visibly degraded fragments. Raw captions are a weak substitute for understanding.

3. **Verifiability.** Even a citizen who watches an entire hearing cannot easily check whether a floor statement — "this bill already passed on third reading," "the agency's budget was cut," "the Supreme Court already ruled on this" — is accurate. Claims are not linked to the records that would confirm or refute them.

4. **Navigability.** There is no single, citizen-friendly way to see *what is being discussed, when, and by whom* — to move from "I care about education spending" to the specific hearings, bills, and legislators involved. The information exists across separate government portals; connecting it is manual, expert work.

The accessibility gap is therefore not merely "too long to watch." It is the absence of a fast, comprehensible, verifiable, and navigable rendering of what government is doing — and, downstream, an electorate forced to judge its representatives on rhetoric and virality rather than record. In an information environment where misinformation spreads faster than correction, that gap is a direct threat to the quality of civic decisions, including how people vote.

---

## 3. Proposed solution and integration with eGovPH

### 3.1 What the platform is

A civic platform with two tightly integrated halves:

- **A conversational agent** that helps citizens *find, understand, and verify* congressional activity.
- **Structured views** — an agenda calendar and a legislative-data explorer — that make the institution browsable and that share their data with the agent.

The connective tissue is a shared, authoritative data foundation (§5): the same government records power the views, ground the agent's answers, and back the fact-checker's verdicts. Nothing the platform asserts is unsourced.

### 3.2 Conversational discovery and session-scoped agents

The agent operates at two levels of scope, matching how a citizen actually engages:

- **General discovery.** A user asks a plain-language question — *"What is Congress doing about flood-control funding?"* — and the agent searches the legislative data and trusted sources, then **suggests the relevant hearings, sessions, and bills**, with a short grounded explanation of each and why it matches. Discovery turns a vague civic interest into concrete, cited entry points.

- **Session-scoped conversation.** The user opens a specific hearing and the agent **narrows its scope to that session**: it works from that session's transcript (§4.1) and its associated bills, committee, and participants, answering questions about *this* proceeding and fact-checking *its* claims. Scoping keeps answers precise and citations tight, and prevents the context-dilution that makes a general chatbot vague.

### 3.3 Structured views: agenda calendar and legislative-data explorer

Two browsable surfaces complement the conversation:

**Agenda calendar.** A unified calendar of **plenary sessions, committee hearings, and committee meetings** across both chambers — what is scheduled, what has occurred, and links into the corresponding streams and transcripts. Meeting schedules are ingested from the official House committee-meetings listing ([congress.gov.ph/committees/committee-meetings](https://congress.gov.ph/committees/committee-meetings)) and joined to the structured committee and legislator data from the backbone (§5.1), so a scheduled meeting resolves to its committee, its members, and — once it airs — its transcript. This answers "what is happening and when," and is the natural jumping-off point into a session-scoped conversation.

**Legislative-data explorer.** Structured, filterable views over the legislative record:
- **Bills** — all measures, with **House bills** and **Senate bills** distinguished, filterable by congress, type, author, status, and date, and searchable.
- **People in government** — **senators and representatives**, with their authored measures and committee memberships.
- **Congressional sessions** — the congresses and their sittings.
- **Member counts and legislative statistics** — aggregate figures (bill totals by chamber, legislator and committee counts) that give citizens and journalists a factual baseline.

These views are powered directly by the government data backbone (§5.1), so the numbers a citizen browses are the same numbers the agent reasons over.

### 3.4 How the views and the agent reinforce each other

The views are not a separate product bolted onto a chatbot — they and the agent **share one data layer and continuously supplement each other**:

- When the agent fact-checks a floor claim about a bill's status, it draws on the *same* legislative records the Bills view exposes; a user can click from a verdict straight into the underlying bill.
- When the agent suggests hearings during discovery, those suggestions land the user in the calendar and the relevant legislative entities.
- When a user browses a legislator or a bill, the agent can summarize and contextualize it, and surface the hearings where it was discussed.

The result is a loop: **structured data makes the agent's answers verifiable; the agent makes the structured data legible.** Each raises the validity and usefulness of the other, and both anchor the fact-checker in records rather than opinion.

### 3.5 Integration with eGovPH

The platform is designed as an eGovPH-native civic service. Omsimos maintains an in-repo typed SDK (`packages/egov/`) that already wraps nine eGovPH services; the product uses a deliberate subset:

- **Government data as the source of truth.** Legislative records, jurisprudence, and budget data come from open Philippine government and civic-tech data services (§5.1) — including the authenticated **eGov Compass** partner API for the national budget — not from a model's memory or generic web content.
- **eGov AI as building blocks.** Omsimos uses **AI Assistant**, **Translator**, and **Document Extractor** as the building blocks of its refinement layer (§4.2, §5.3). eGov AI offers no speech-to-text, so it does not replace the transcription source, and its Filipino/Taglish quality must be validated empirically.
- **eMessage for reach.** SMS notifications (via the eMessage service, confirmed in the SDK) turn the platform from pull to push — alerting citizens when a followed hearing is scheduled (tied to the agenda calendar) or a fact-check digest is ready.
- **Optional: eGovChain.** The EVM-compatible eGovChain client can anchor a transcript/verdict hash on-ledger for tamper-evidence — a credibility feature, not a core dependency.
- **eGovPH distribution.** As an eGov platform service, the tool can reach citizens through the eGovPH ecosystem, with all partner credentials held strictly server-side under the applicable data-sharing terms.

Services the product deliberately does **not** use — eVerify, eGov SSO (unless verified accounts are later needed), eGovPay, and Face Liveness — belong to identity/payment/biometric flows outside a public transparency tool's scope.

---

## 4. Technical architecture

The system narrows uncertainty and attaches provenance at every stage. It is described here at the architecture level; this is a concept paper, not an implementation.

### 4.1 Transcription layer (already built)

A working proof-of-concept (`packages/transcript-scraper/`, dependency-free TypeScript) extracts a YouTube video's public transcript. It reads the watch page's embedded data and the internal `get_panel` endpoint to retrieve the segment list, selects the auto-generated (ASR) caption track when present, and returns a `TranscriptResult` with timestamped `segments[]` (`{ start, text, timestamp }`), generated `srt`, an `autogenerated` flag, `languageCode`, `durationSeconds`, `title`, and `watchUrl`. It handles Filipino auto-captions (validated on a ~97-min session, "19th Congress 3rd Regular Session #07"). Two known constraints: it depends on an undocumented YouTube endpoint that may change, and Filipino auto-caption quality is low — motivating the refinement middleware below. See [`architecture.md`](./architecture.md) §2 for the implemented detail.

### 4.2 Transcription-refinement middleware (built on eGovPH AI services)

Before the transcript reaches the agent, it passes through a server-side refinement middleware — an Omsimos component built on eGovPH's AI Assistant and Translator — that performs **one pass with three outputs**:
1. **Repair (eGov AI Assistant).** An LLM cleans each caption segment *in place* — fixing garble, restoring punctuation and casing — operating **within** segment boundaries so timestamps are preserved.
2. **Confidence flagging.** Spans the pass cannot confidently reconstruct are tagged; these flags travel downstream so the fact-checker can *flag, not force-check* unreliable spans rather than fabricate a verdict.
3. **Translation (eGov Translator).** A clean parallel version (e.g. English alongside Filipino) supports accessibility and claim extraction.

Two invariants make this safe: **the raw caption is retained as source-of-truth** (repair is a display/aid layer, never presented as ground truth), and **timestamp alignment is non-negotiable** (so every claim still maps to the moment it was spoken). eGov improves the transcript *as text*, not its acoustic accuracy; raising raw accuracy is future work (§8).

### 4.3 Multi-agent pipeline and RAG

```
YouTube transcription  (timestamped FIL/Taglish captions)
        │
        ▼
   refinement middleware  (repair · flag · translate)
        │   [Omsimos component, on eGovPH AI Assistant + Translator]
        │   raw + cleaned + flags + timestamps
        ▼
   Agent  (language-aware: Filipino + Taglish)
        │   general discovery  |  session-scoped
        ▼
┌──────────────────────────────────────────────┐
│  Grounding mix                                  │
│  • AUTHORITATIVE PRIMARY LAYER (government data) │
│      BetterGov Open Congress · Juris.ph · COMPASS│
│  • CORROBORATION LAYER                           │
│      trusted-source web search                   │
└──────────────────────────────────────────────┘
        │
        ▼
   RAG (on-demand, record-level)  ──►  Fact-checker
                                          │
                                          ▼
   For each claim:  claim → verdict → cited source → backing excerpt
```

- **Agent layer (specialized subagents, orchestrated by eve).** Rather than one monolithic prompt, the agent layer is a set of **specialized subagents**, each owning one source and its access protocol, coordinated by an orchestrator built with **eve** (the team's agent framework): an **eGov AI subagent** (its own endpoint — repair/translate/summarize/OCR), a **BetterGov + Juris subagent** with **direct MCP access** to jurisprudence and legislative records, a **Compass budget subagent** over the typed SDK, and a **web-search subagent** restricted to the trusted allowlist for corroboration. The orchestrator classifies each claim, dispatches it to the subagent that owns the authoritative source, and aggregates the verdicts. Every subagent is **language-aware** — proceedings are Filipino with frequent Taglish code-switching — and leans on the translation and flag layers. Isolating each source in its own subagent keeps credentials/tools scoped and lets a source's protocol (REST, MCP, SDK) stay encapsulated. See [`architecture.md`](./architecture.md) §4.1.
- **Grounding mix.** Retrieval prioritizes the **authoritative government data layer** (§5.1) and uses **trusted-source web search** (§5.2) only to corroborate or fill gaps — never as a substitute for an authoritative record. Verdicts grounded only in web search are labeled lower-tier.
- **RAG.** Rather than dumping a whole transcript plus generic knowledge into a prompt, the RAG layer fetches the *specific* records relevant to a claim (a specific bill, decision, or budget line) and passes them, with identifiers and source URLs, as the evidence the model reasons over. Retrieval is on-demand and record-level — small context, current data, full attribution.

### 4.4 Fact-checking methodology

For each check-worthy statement, the fact-checker produces a structured, traceable result:

1. **Claim extraction.** The agent scans the timestamped transcript — reading it as Filipino/Taglish and using the middleware's repaired text and translation — and extracts factual assertions (not opinion or procedure), each retaining its timestamp and (where available) speaker. Extraction is conservative and driven by the confidence-flag layer: low-confidence spans are surfaced, not force-checked.
2. **Classification and routing.** Each claim is typed and routed: *legislative status* → BetterGov Open Congress; *legal claim* (a ruling or Republic Act) → Juris.ph; *budget figure* → DBM COMPASS; *general factual* → trusted-source web search (corroboration).
3. **Verdict production.** The claim is compared to the retrieved record and returned as **claim → verdict → cited source → backing excerpt**, where *verdict* is one of *supported / contradicted / partially accurate / unverified*, *cited source* is the record's URL and identifier, and *backing excerpt* is the specific passage that justifies it.
4. **Reliability handling.** No verdict is stronger than its evidence: partial or low-confidence matches are downgraded to *partially accurate* or *unverified* rather than asserted, and high-stakes verdicts defer to canonical full text over any AI-generated summary. The output is always "what the authoritative record says, with a citation" — never an unbacked opinion.

**Why this beats naive transcribe-and-dump:** answers are constructed from *retrieved authoritative records*, every claim carries a verifiable citation, the chain from spoken sentence to confirming record is explicit and inspectable, and an unsupported assertion is returned as *unverified* rather than fabricated — because a verdict with no backing excerpt cannot be issued.

---

## 5. Data foundation

The platform stands on two tiers of source: an **authoritative government-data backbone** that powers the views, grounds the agent, and backs verdicts; and a **curated set of trusted web sources** used for corroborating web search. This section is not a survey of every possible API — it establishes that the sources the platform actually relies on are real and usable.

### 5.1 Authoritative government data backbone (verified live, 2026-07-21)

Three sources form the backbone. All were confirmed reachable and openly accessible on the verification date.

**BetterGov Open Congress API — legislative records.** A public REST API at `https://open-congress-api.bettergov.ph/api`, with a machine-readable OpenAPI spec and open source ([github.com/bettergovph/open-congress-api](https://github.com/bettergovph/open-congress-api), CC0). No authentication; JSON with pagination and filters. It exposes exactly the entities the legislative-data views need: bills (`/documents`, `/search/documents`), legislators (`/people`), sessions (`/congresses`), committees, and aggregate statistics (`/stats`). Confirmed coverage: **~165,162 bills (143,156 House / 22,006 Senate) across the 8th–20th Congress; 1,179 legislators; 200 committees.** This single API drives the Bills, House/Senate Bills, People, Sessions, and Statistics views, and is the fact-checker's backbone for legislative-status claims. *Caveat:* the maintainers note data is manually encoded and some fields may be sparse, so high-stakes checks defer to the linked official document.

**Juris.ph — jurisprudence and Republic Acts.** A live Model Context Protocol server at `https://juris.ph/mcp` (JSON-RPC, no auth), exposing `search_jurisprudence`, `search_republic_acts`, `get_case`, and `get_republic_act`, returning structured records that link to official PDFs. Content is sourced from lawphil.net (Arellano Law Foundation, CC BY-NC 4.0); AI-generated summaries are treated as retrieval aids, with the linked full text as authority. This grounds legal claims made in hearings.

**eGov Compass (DBM) — national budget.** Omsimos uses the **authenticated eGov Compass partner API** (`dbm-ws.oueg.info`, `EGOVCOMPASS_API_KEY`), accessed through the in-repo typed SDK (`packages/egov/src/eGovCompass`). It returns structured budget data: **SAAODB** records and a dashboard exposing the full appropriations → allotments → obligations → disbursements cascade with obligation/disbursement **rates** and expense-class breakdown (PS/MOOE/CO/FINEX); **SARO** (release orders), **NCA** (cash allocations), and **LGSF** (local government support fund) records and dashboards — queryable by report year, period (FY/Q1–Q4), scope (agency/SUCs/summary), and entity. This is the sanctioned, richer counterpart to the public *Centralized Open Monitoring Platform for Appropriations and Spending Statistics* ([compass.dbm.gov.ph](https://compass.dbm.gov.ph), launched 26 June 2026 per [PIA](https://pia.gov.ph/press-release/pbbm-launches-dbm-compass-to-strengthen-transparency-accountability-in-government-spending/)) and grounds every budget-figure claim. *Caveat:* the SDK currently targets the hackathon/staging host and defers to the enacted GAA / prior-year sources for years the endpoint does not serve.

### 5.2 Trusted web-search sources

Beyond the backbone, the agent performs **web search restricted to a curated list of authoritative Philippine sources**, used to corroborate and contextualize — never as the sole basis for a verdict. These are trusted *sources*, not scraping targets: the agent reads and cites them the way a careful researcher would, and cross-references anything material against the government-data backbone above. The curated list includes:

- **Laws, issuances, jurisprudence:** Official Gazette ([officialgazette.gov.ph](https://www.officialgazette.gov.ph/)), LawPhil ([lawphil.net](https://lawphil.net/)), the Supreme Court and its E-Library ([sc.judiciary.gov.ph](https://sc.judiciary.gov.ph/), [elibrary.judiciary.gov.ph](https://elibrary.judiciary.gov.ph/)).
- **Legislative primary sources:** House of Representatives ([congress.gov.ph](https://www.congress.gov.ph/)) and Senate ([legacy.senate.gov.ph](https://legacy.senate.gov.ph/), [ldr.senate.gov.ph](https://ldr.senate.gov.ph/)).
- **Budget, audit, procurement, statistics:** DBM ([dbm.gov.ph](https://www.dbm.gov.ph/)), Commission on Audit ([coa.gov.ph](https://www.coa.gov.ph/)), PhilGEPS ([philgeps.gov.ph](https://www.philgeps.gov.ph/)), the Philippine Statistics Authority ([psa.gov.ph](https://psa.gov.ph/)), and the Bangko Sentral ng Pilipinas ([bsp.gov.ph](https://www.bsp.gov.ph/)).
- **Open-data hubs:** [data.gov.ph](https://data.gov.ph/), [open.gov.ph](https://open.gov.ph/), and BetterGov ([bettergov.ph](https://bettergov.ph/)).

Restricting web search to this allowlist is a deliberate trust control: it keeps corroboration within institutional sources and out of the open, unverified web.

### 5.3 eGov AI services

Omsimos's partner access to eGov AI provides the building blocks for the refinement middleware (§4.2), wired in the in-repo SDK (`packages/egov/src/eGovAi`): **AI Assistant** (`ai_assistant`; listed as "Chat AI" on the public catalog) for transcript repair and summarization, **Translator** (`translator`, ISO-639, returns translated + transliterated text) for Filipino↔English, and **Document Extractor** (`document_extractor`) for OCR of bill/COA/GAA PDFs. The service is **token-based and credit-metered**: an access code mints a short-lived bearer token carrying a finite credit balance (`getTokenCredits` reports usage). eGov AI offers **no speech-to-text**, so the middleware operates on text the transcription POC already produced; and the Filipino/Taglish quality of these services is **unverified** (no capability detail is documented) and must be validated empirically against real hearing captions. Credentials remain server-side under the data-sharing agreement. See [`architecture.md`](./architecture.md) §3.2.

---

## 6. Impact, value, and cost-benefit

### 6.1 Impact to society

The platform's impact compounds along a chain — from access, to understanding, to awareness, to better civic decisions:

- **Accessibility.** Hours of untracked video become minutes of grounded, timestamped substance, in a language the citizen can read. A right that existed only on paper becomes one a person can actually exercise.
- **Comprehension.** Summaries explain what a measure *does*, where it *stands*, and what was *contested* — converting procedural noise into civic meaning, and teaching how the legislative process works.
- **Awareness of country, laws, and governance.** By linking floor claims to bills, laws, jurisprudence, and the budget — with citations — the platform doubles as civic education, drawing citizens into the primary sources of Philippine law and public spending.
- **Fact-based electoral choice.** Because every verdict is traceable (**claim → verdict → cited source → backing excerpt**), voters, journalists, and civil-society groups can judge officials on verifiable conduct rather than rhetoric. Against an information environment where disinformation outpaces correction, a tool whose every output cites an authoritative government record is a direct counterweight.
- **Good governance and accountability.** Routine, cheap, citable scrutiny of the floor raises the reputational cost of misstatement and the visibility of good work, strengthening the citizen-representative feedback loop that accountability depends on.

**Boundary of the claim:** the platform *informs* civic judgment; it does not render it. It reports what the record says, with citations — it is not an arbiter of political truth, a replacement for journalism, or a voting-recommendation engine.

### 6.2 Value proposition

- **For citizens:** a single place to find, understand, and trust what Congress is doing.
- **For journalists and researchers:** fact-checking and legislative research that would take hours of manual cross-referencing, returned in seconds with citations.
- **For government and eGovPH:** a flagship transparency service that makes existing open data *useful*, increasing the return on the data agencies already publish.

### 6.3 Cost-benefit

The economics are favorable because the expensive inputs are already free or already owned:

| Cost driver | Nature | Notes |
|---|---|---|
| Transcription | Near-zero | Public YouTube captions; no ASR licensing |
| Government data access | Zero | Open, no-auth APIs (BetterGov, Juris.ph, COMPASS) |
| eGov AI credits | Metered, finite | Every AI Assistant/Translator/OCR call draws down a finite team credit balance — the hard quota to manage |
| Agent / LLM inference | Dominant, variable | Reasoning and fact-check calls; scales with sessions processed and claims checked |
| Hosting / storage | Modest | Transcripts, cached records, view indexes |

The **dominant marginal cost is AI inference** — the agent's reasoning/fact-check calls plus the eGov AI credits consumed by the refinement layer. It is bounded per session (a session yields a finite set of check-worthy claims) and **falls with caching**: legislative records, once retrieved, are reused across sessions and views, and repaired/translated transcripts are stored so eGov AI credits are spent once per session, not per view. Because eGov AI credits are a finite, metered balance (§5.3), credit monitoring and caching are first-class design concerns, not afterthoughts. Against this sits a large public benefit: the manual alternative (a staffer or reporter watching a full hearing and cross-checking each claim against multiple portals) costs hours of expert time per session, and most citizens cannot perform it at all. The platform converts a task that is effectively impossible at citizen scale into a routine, low-marginal-cost service. *(Figures above describe cost structure, not a priced budget; exact costs depend on volume and model choice.)*

---

## 7. Implementation and scalability

### 7.1 Phased implementation

**Foundation already in place (see [`architecture.md`](./architecture.md)):** a Bun/Turborepo monorepo with a working transcript-scraper and a typed eGov SDK covering nine services, each with unit tests and a live smoke harness that already exercises eGov AI, Compass, eGovChain, eReport, and eVerify against real endpoints. The building blocks are wired; the phases below assemble the product on top of them.

- **Phase 1 — Hackathon MVP.** End-to-end on a single archived session: transcribe → eGov AI refine → eve-orchestrated subagents → fact-check with the three-tier verdict; plus the legislative-data views and a basic agenda calendar, both backed by the BetterGov API; and a reviewer UI showing transcript, summary, and verdict cards.
- **Phase 2 — Discovery and breadth.** General-question discovery across sessions; both chambers; committee meetings on the calendar; richer legislative statistics.
- **Phase 3 — Scale and depth.** Historical backlog processing; trusted-source web-search corroboration at full breadth; deeper analytics (legislator activity, budget tracing).

### 7.2 Scalability

The architecture scales along several independent axes without redesign:

- **Retrieval is on-demand and record-level**, so per-session context stays small regardless of how much government data exists — the system does not need to hold the corpus in a prompt.
- **Legislative data is cacheable and shared** across the views and the agent; a record fetched once serves many sessions, so cost per session declines as coverage grows.
- **Sessions are independent units**, so archived-backlog processing and new-session ingestion parallelize trivially, and new sittings are processed incrementally as they are published.
- **Sources are isolated behind adapters**, so an undocumented endpoint (YouTube transcript, COMPASS) or a scraped page can change without touching the rest of the system, and new sources can be added to the grounding mix without altering the agent. The committee-meeting schedule scraper is one such adapter: the House listing sits behind Cloudflare, so it is fetched with a headless browser on a schedule and cached, keeping that fragility contained to a single component.
- **The two-chamber, multi-committee structure is already modeled** by the backbone data (House/Senate split, 200 committees, 8th–20th Congress), so extending coverage is a matter of ingestion, not architecture.

---

## 8. Risks and limitations

- **Filipino / Taglish ASR quality (the load-bearing risk).** The transcription foundation is YouTube auto-captions, which for Filipino are visibly degraded — a real risk to claim extraction, since a garbled claim cannot be reliably checked. Filipino remains under-resourced for language technology ([arXiv:2502.14911](https://arxiv.org/abs/2502.14911)). *Mitigation (in scope):* the refinement middleware (built on eGovPH AI Assistant) repairs the transcript as text and flags low-confidence spans; extraction is conservative. *Future work (out of scope):* a stronger acoustic Filipino/Taglish speech model (e.g. a Whisper-class or Taglish-tuned ASR) on the source audio — the only lever that fixes the root cause rather than the symptom.
- **Undocumented / unstable endpoints.** The YouTube transcript endpoint (`get_panel`) and the public DBM COMPASS backend are undocumented internal endpoints with no stability contract. Usable today; isolated behind adapters and monitored for breakage.
- **eGov AI credit quota.** eGov AI is credit-metered (§5.3); heavy transcript-repair/translation traffic can exhaust the balance. *Mitigation:* cache repaired/translated transcripts (spend once per session), monitor via `getTokenCredits`, and degrade gracefully to raw captions when credits are low.
- **Hackathon/staging endpoints.** The eGov SDK currently targets hackathon/staging hosts (`hackathon-*.e.gov.ph`, `*.oueg.info`); production deployment requires promoting to production endpoints and credentials.
- **Data coverage and provenance.** COMPASS currently exposes FY2026 only; prior-year budget claims need other sources. BetterGov data is community-encoded with uneven metadata completeness, and Juris.ph summaries are AI-generated — so high-stakes verdicts defer to canonical full text and the provenance disclaimer is surfaced rather than hidden.
- **eGovPH dependency (available, constrained).** eGovPH AI text services (AI Assistant, Translator) are available to Omsimos via partner access but bound by the data-sharing agreement, with credentials server-side; eGovPH provides no speech-to-text, so it must never be presented as the transcription engine, and its Filipino/Taglish quality is unverified pending the partner docs. A refinement-middleware outage degrades readability/translation but does not stop fact-checking, which can fall back to raw captions.
- **Legal and ethical.** (a) Automated scrutiny of public officials is sensitive: verdicts are framed as "matches / does not match the authoritative record, see citation," never accusations, and the *unverified* state is kept prominent. (b) Licensing: LawPhil/Juris content is CC BY-NC 4.0 (attribution, non-commercial); BetterGov data is CC0 — terms are respected. (c) Attribution integrity: speaker attribution from noisy ASR can err, so it is shown only when the transcript supports it. (d) Neutrality: fidelity to the cited record over editorializing is the primary safeguard against bias in claim and source selection.

---

## 9. References

Primary sources verified 2026-07-21; "live" entries were confirmed by direct request on that date.

- BetterGov Open Congress API (live): https://open-congress-api.bettergov.ph/ — OpenAPI: https://open-congress-api.bettergov.ph/api/doc — stats: https://open-congress-api.bettergov.ph/api/stats
- BetterGov Open Congress source: https://github.com/bettergovph/open-congress-api — data: https://github.com/bettergovph/open-congress-data
- Juris.ph: https://juris.ph — MCP (live JSON-RPC): https://juris.ph/mcp
- DBM COMPASS: https://compass.dbm.gov.ph — launch (PIA): https://pia.gov.ph/press-release/pbbm-launches-dbm-compass-to-strengthen-transparency-accountability-in-government-spending/
- Trusted web-search sources: Official Gazette https://www.officialgazette.gov.ph/ · LawPhil https://lawphil.net/ · Supreme Court https://sc.judiciary.gov.ph/ · SC E-Library https://elibrary.judiciary.gov.ph/ · House of Representatives https://www.congress.gov.ph/ · Senate https://legacy.senate.gov.ph/ , https://ldr.senate.gov.ph/ · DBM https://www.dbm.gov.ph/ · COA https://www.coa.gov.ph/ · PhilGEPS https://www.philgeps.gov.ph/ · PSA https://psa.gov.ph/ · BSP https://www.bsp.gov.ph/ · data.gov.ph https://data.gov.ph/ · open.gov.ph https://open.gov.ph/ · BetterGov https://bettergov.ph/
- House of Representatives streaming: https://www.congress.gov.ph/streaming/ — YouTube: https://www.youtube.com/@HouseofRepresentativesPH/streams — committee-meeting schedules: https://congress.gov.ph/committees/committee-meetings
- Senate YouTube: https://www.youtube.com/@senateofthephilippines/streams
- eGov AI developers: https://egov-ai.e.gov.ph/developers — eGov Marketplace: https://platforms.e.gov.ph/
- Batayan: A Filipino NLP benchmark for evaluating LLMs — arXiv:2502.14911 — https://arxiv.org/abs/2502.14911
- Transcription POC (in-repo): `packages/transcript-scraper/` · eGov SDK (in-repo): `packages/egov/` · implemented architecture: [`architecture.md`](./architecture.md)
