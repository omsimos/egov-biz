export function aiPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="egov-environment" content="STAGING" />
    <title>eGov AI Sample</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        --mono: ui-monospace, "SF Mono", Menlo, "Courier New", monospace;
        --paper: #f4f1e8;
        --paper-deep: #eae6dc;
        --ink: #17171a;
        --ink-60: rgb(23 23 26 / 60%);
        --ink-40: rgb(23 23 26 / 40%);
        --ink-15: rgb(23 23 26 / 15%);
        --blue: #1f3faa;
        --red: #b3261e;
        --green: #1d6b3c;
        --amber: #8a6100;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--paper); color: var(--ink); -webkit-font-smoothing: antialiased; }
      ::selection { background: rgb(31 63 170 / 20%); }
      main { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(940px, calc(100% - 40px)); min-height: 100vh; margin: 0 auto; }
      .masthead { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; min-height: 62px; border-bottom: 2px solid var(--ink); }
      .wordmark { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: -0.01em; }
      .wordmark span { color: var(--ink-60); font-weight: 500; }
      .form-no { margin: 0; color: var(--ink-60); font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
      .mast-actions { display: flex; align-items: center; justify-content: flex-end; gap: 18px; }
      .back-link { color: var(--ink-60); font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.13em; text-decoration: none; text-transform: uppercase; }
      .stamp { margin: 0; padding: 4px 9px; border: 2px solid var(--red); color: var(--red); font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; transform: rotate(-3deg); }
      .chat { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; margin: 22px 0 14px; border: 2px solid var(--ink); background: var(--paper-deep); }
      .chat-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 18px; border-bottom: 2px solid var(--ink); background: var(--paper); }
      .chat-identity { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
      .chat-title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
      .chat-context { margin: 0; overflow: hidden; color: var(--ink-40); font-family: var(--mono); font-size: 9px; letter-spacing: 0.13em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
      .status { margin: 0; flex: 0 0 auto; color: var(--ink-60); font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; text-align: right; text-transform: uppercase; }
      .status::before { content: "\\25CF\\00A0"; }
      .status[data-state="loading"] { color: var(--amber); }
      .status[data-state="loading"]::before { animation: blink 1s steps(2, start) infinite; }
      .status[data-state="success"] { color: var(--green); }
      .status[data-state="error"] { color: var(--red); }
      @keyframes blink { 50% { opacity: 0; } }
      .conversation { display: flex; flex-direction: column; gap: 18px; min-height: 0; padding: 24px; overflow-y: auto; overscroll-behavior: contain; scrollbar-color: var(--ink-40) transparent; }
      .empty-state { display: grid; flex: 1; place-content: center; justify-items: center; margin: 0; color: var(--ink-40); text-align: center; }
      .empty-mark { display: grid; width: 42px; height: 42px; place-items: center; margin-bottom: 13px; border: 2px solid var(--ink-40); border-radius: 50%; font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; }
      .empty-title { margin: 0; color: var(--ink-60); font-size: 14px; font-weight: 700; }
      .empty-help { margin: 5px 0 0; font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; }
      .message { display: flex; flex-direction: column; align-items: flex-start; width: min(76%, 640px); }
      .message[data-role="user"] { align-self: flex-end; align-items: flex-end; }
      .message-label { margin: 0 0 6px; color: var(--ink-60); font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; }
      .message-label::before { content: attr(data-message-no); display: inline-block; min-width: 2.8em; color: var(--ink-40); }
      .message[data-role="assistant"] .message-label { color: var(--blue); }
      .message-body { margin: 0; padding: 12px 14px; border: 1.5px solid var(--ink); background: var(--paper); overflow-wrap: anywhere; white-space: pre-wrap; font-size: 14px; line-height: 1.58; }
      .message[data-role="assistant"] .message-body { border-left: 4px solid var(--blue); }
      .message[data-role="user"] .message-body { background: var(--ink); color: var(--paper); }
      .message-body strong { font-weight: 750; }
      .composer { display: grid; gap: 8px; padding: 14px 16px 12px; border-top: 2px solid var(--ink); background: var(--paper); }
      .composer-row { display: flex; gap: 10px; align-items: stretch; }
      .composer textarea { flex: 1; min-width: 0; min-height: 48px; max-height: 130px; resize: vertical; padding: 12px 13px; border: 1.5px solid var(--ink); border-radius: 0; background: transparent; color: var(--ink); font: inherit; font-size: 14px; line-height: 1.45; transition: border-color 120ms ease, background-color 120ms ease; }
      .composer textarea::placeholder { color: var(--ink-40); }
      .composer textarea:focus { border-color: var(--blue); outline: 1px solid var(--blue); outline-offset: -2px; background: rgb(31 63 170 / 4%); }
      .submit-button { flex: 0 0 104px; padding: 0 18px; border: 2px solid var(--ink); background: var(--ink); color: var(--paper); font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; transition: background-color 120ms ease, color 120ms ease, transform 100ms cubic-bezier(0.23, 1, 0.32, 1); }
      .submit-button:disabled { opacity: 0.4; cursor: default; }
      .submit-button:focus-visible, .back-link:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
      .composer-meta { display: flex; justify-content: space-between; gap: 16px; margin: 0; color: var(--ink-40); font-family: var(--mono); font-size: 9px; letter-spacing: 0.07em; text-transform: uppercase; }
      .credits { text-align: right; }
      .page-foot { display: flex; justify-content: space-between; gap: 20px; padding: 0 0 12px; color: var(--ink-40); font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
      @media (hover: hover) and (pointer: fine) {
        .submit-button:hover:not(:disabled) { background: var(--paper); color: var(--ink); }
        .submit-button:active:not(:disabled) { transform: scale(0.97); }
        .back-link:hover { color: var(--blue); }
      }
      @media (prefers-reduced-motion: reduce) {
        .status[data-state="loading"]::before { animation: none; }
        .submit-button { transition: background-color 120ms ease, color 120ms ease; }
      }
      @media (max-width: 640px) {
        main { width: calc(100% - 24px); min-height: 100dvh; }
        .masthead { grid-template-columns: 1fr auto; min-height: 54px; }
        .form-no, .back-link { display: none; }
        .chat { margin: 12px 0 8px; }
        .chat-head { align-items: flex-start; padding: 12px; }
        .chat-identity { display: block; }
        .chat-context { margin-top: 3px; }
        .status { max-width: 44%; }
        .conversation { gap: 14px; padding: 16px 12px; }
        .message { width: 88%; }
        .composer { padding: 10px; }
        .composer-row { gap: 7px; }
        .submit-button { flex-basis: 74px; padding: 0 10px; }
        .composer-meta span:first-child { display: none; }
        .credits { margin-left: auto; }
        .page-foot { padding-bottom: 8px; }
        .page-foot span:last-child { display: none; }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="masthead">
        <p class="wordmark">eGovPH <span>/ AI</span></p>
        <p class="form-no">Form No. AI-01 · Bun runtime</p>
        <div class="mast-actions">
          <a class="back-link" href="/">← SSO record</a>
          <p class="stamp">Staging</p>
        </div>
      </header>
      <section class="chat" aria-label="eGov AI chat">
        <header class="chat-head">
          <div class="chat-identity">
            <h1 class="chat-title">eGov AI</h1>
            <p class="chat-context">Philippine government assistant · PH</p>
          </div>
          <p class="status" id="ai-status" data-ai-status data-state="idle" aria-live="polite">Ready</p>
        </header>
        <div class="conversation" data-conversation aria-live="polite">
          <div class="empty-state" data-empty-state>
            <span class="empty-mark">AI</span>
            <p class="empty-title">Start a conversation</p>
            <p class="empty-help">Ask about services, agencies, or laws</p>
          </div>
        </div>
        <form class="composer" data-chat-form>
          <div class="composer-row">
            <label hidden for="message">Message to eGov AI</label>
            <textarea id="message" data-message-input maxlength="4000" required placeholder="Message eGov AI…"></textarea>
            <button class="submit-button" data-submit-button type="submit">Send</button>
          </div>
          <p class="composer-meta">
            <span>Enter to send · Shift + Enter for a new line</span>
            <span class="credits" data-credits>Live credits</span>
          </p>
        </form>
      </section>
      <footer class="page-foot">
        <span>Live staging service</span>
        <span>Credentials stay server-side · Messages clear on refresh</span>
      </footer>
    </main>
    <script src="/ai/client.js"></script>
  </body>
</html>`;
}
