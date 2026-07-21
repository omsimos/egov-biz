interface ChatSuccess {
  answer: string;
  creditsRemaining?: number;
  creditsTotal?: number;
  sessionId: string;
}

const form = document.querySelector<HTMLFormElement>("[data-chat-form]");
const input = document.querySelector<HTMLTextAreaElement>("[data-message-input]");
const submitButton = document.querySelector<HTMLButtonElement>("[data-submit-button]");
const conversation = document.querySelector<HTMLElement>("[data-conversation]");
const emptyState = document.querySelector<HTMLElement>("[data-empty-state]");
const status = document.querySelector<HTMLElement>("[data-ai-status]");
const credits = document.querySelector<HTMLElement>("[data-credits]");

let messageNumber = 0;

function setStatus(message: string, state: "error" | "idle" | "loading" | "success"): void {
  if (status === null) return;
  status.dataset.state = state;
  status.textContent = message;
}

function setBusy(busy: boolean): void {
  if (input !== null) input.disabled = busy;
  if (submitButton !== null) submitButton.disabled = busy;
}

function normalizedAssistantText(body: string): string {
  return body.replace(/\s+(?=\d+\.\s+\*\*)/g, "\n\n");
}

function appendSafeFormatting(container: HTMLElement, body: string): void {
  const parts = normalizedAssistantText(body).split("**");
  for (const [index, part] of parts.entries()) {
    if (index % 2 === 0) {
      container.append(part);
      continue;
    }

    const strong = document.createElement("strong");
    strong.textContent = part;
    container.append(strong);
  }
}

function appendMessage(role: "assistant" | "user", body: string): void {
  if (conversation === null) return;

  emptyState?.remove();
  messageNumber += 1;

  const article = document.createElement("article");
  article.className = "message";
  article.dataset.role = role;

  const label = document.createElement("p");
  label.className = "message-label";
  label.dataset.messageNo = String(messageNumber).padStart(2, "0");
  label.textContent = role === "user" ? "You" : "eGov AI";

  const content = document.createElement("div");
  content.className = "message-body";
  if (role === "assistant") {
    appendSafeFormatting(content, body);
  } else {
    content.textContent = body;
  }

  article.append(label, content);
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
}

function updateCredits(result: ChatSuccess): void {
  if (credits === null) return;
  if (result.creditsRemaining === undefined || result.creditsTotal === undefined) {
    credits.textContent = "Credit balance unavailable";
    return;
  }

  credits.textContent = `${result.creditsRemaining.toLocaleString()} / ${result.creditsTotal.toLocaleString()} credits remaining`;
}

function isChatSuccess(value: unknown): value is ChatSuccess {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "answer") === "string" &&
    typeof Reflect.get(value, "sessionId") === "string"
  );
}

function errorMessage(value: unknown): string {
  if (typeof value !== "object" || value === null) return "The live eGov AI request failed.";
  const error = Reflect.get(value, "error");
  return typeof error === "string" && error.length > 0 ? error : "The live eGov AI request failed.";
}

async function submitMessage(message: string): Promise<void> {
  appendMessage("user", message);
  setBusy(true);
  setStatus("Waiting for eGov AI", "loading");

  try {
    const response = await fetch("/api/ai/chat", {
      body: JSON.stringify({ message }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const result: unknown = await response.json();

    if (!response.ok || !isChatSuccess(result)) {
      throw new Error(errorMessage(result));
    }

    appendMessage("assistant", result.answer);
    updateCredits(result);
    setStatus(`Live response received · Session ${result.sessionId.slice(0, 8)}`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The live eGov AI request failed.";
    appendMessage("assistant", `Request failed: ${message}`);
    setStatus(message, "error");
  } finally {
    setBusy(false);
    input?.focus();
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (input === null || input.disabled) return;

  const message = input.value.trim();
  if (message.length === 0) {
    setStatus("Enter a message before sending", "error");
    input.focus();
    return;
  }

  input.value = "";
  void submitMessage(message);
});

input?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  form?.requestSubmit();
});
