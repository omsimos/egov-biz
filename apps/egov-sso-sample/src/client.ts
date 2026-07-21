import type { EgovSsoCitizenProfile } from "@repo/egov/eGovSso";

interface AuthenticationResult {
  authenticated: true;
  message: string;
  profile: EgovSsoCitizenProfile;
}

interface AnonymousSession {
  authenticated: false;
}

interface AuthenticationError {
  error: string;
}

interface ProfileSection {
  keys: ReadonlyArray<keyof EgovSsoCitizenProfile>;
  title: string;
}

declare global {
  interface Window {
    handleEgovSsoSuccess(exchangeCode: string): void;
  }
}

const profileSections: readonly ProfileSection[] = [
  {
    keys: [
      "uniqid",
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "birth_date",
      "gender",
      "nationality",
    ],
    title: "Identity",
  },
  { keys: ["email", "mobile"], title: "Contact" },
  {
    keys: [
      "address",
      "street",
      "address_line_2",
      "barangay",
      "barangay_code",
      "municipality",
      "municipality_code",
      "province",
      "province_code",
      "region",
      "region_code",
      "postal",
      "country",
      "country_alpha_2_code",
      "country_alpha_3_code",
      "country_id",
      "foreign_address",
    ],
    title: "Address",
  },
  { keys: ["photo", "signature", "signature_url"], title: "Profile media" },
  { keys: ["passport", "national_id", "tin_id"], title: "Government documents" },
  { keys: ["additional_information"], title: "Additional information" },
];

const imageFieldNames = new Set(["face_url", "photo", "signature", "signature_url"]);
const labelOverrides: Readonly<Record<string, string>> = {
  pcn: "PCN",
  tin_id: "TIN ID",
  uniqid: "Unique ID",
};

const statusElement = document.querySelector<HTMLElement>("[data-auth-status]");
const resultElement = document.querySelector<HTMLElement>("[data-auth-result]");
const authControlsElement = document.querySelector<HTMLElement>("[data-auth-controls]");
const exchangeForm = document.querySelector<HTMLFormElement>("[data-exchange-form]");
const exchangeCodeInput = document.querySelector<HTMLInputElement>("[data-exchange-code]");

function setStatus(message: string, state: "error" | "idle" | "loading" | "success"): void {
  if (statusElement === null) return;

  statusElement.dataset.state = state;
  statusElement.textContent = message;
}

function humanize(key: string): string {
  const override = labelOverrides[key];
  if (override !== undefined) return override;

  return key
    .split("_")
    .map((part) => {
      if (part === "id") return "ID";
      if (part === "url") return "URL";
      return `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function imageSource(key: string, value: string): string | undefined {
  if (!imageFieldNames.has(key)) return undefined;
  if (value.startsWith("data:image/")) return value;

  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function appendValue(container: HTMLElement, key: string, value: unknown): void {
  if (value === null || value === undefined || value === "") {
    const empty = document.createElement("span");
    empty.className = "empty-value";
    empty.textContent = "Not provided";
    container.append(empty);
    return;
  }

  if (typeof value === "string") {
    const source = imageSource(key, value);
    if (source !== undefined) {
      const image = document.createElement("img");
      image.alt = humanize(key);
      image.className = "profile-image";
      image.decoding = "async";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.src = source;
      container.append(image);
      return;
    }

    container.append(value);
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    container.append(String(value));
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      appendValue(container, key, null);
      return;
    }

    const list = document.createElement("ol");
    list.className = "nested-array";
    for (const item of value) {
      const listItem = document.createElement("li");
      appendValue(listItem, key, item);
      list.append(listItem);
    }
    container.append(list);
    return;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      appendValue(container, key, null);
      return;
    }

    const list = document.createElement("dl");
    list.className = "nested-list";
    for (const [nestedKey, nestedValue] of entries) {
      list.append(createField(nestedKey, nestedValue));
    }
    container.append(list);
    return;
  }

  container.append(String(value));
}

function createField(key: string, value: unknown): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "profile-field";

  const term = document.createElement("dt");
  term.textContent = humanize(key);

  const description = document.createElement("dd");
  appendValue(description, key, value);

  field.append(term, description);
  return field;
}

function createSection(profile: EgovSsoCitizenProfile, section: ProfileSection): HTMLElement {
  const element = document.createElement("section");
  element.className = "profile-section";

  const heading = document.createElement("h3");
  heading.textContent = section.title;

  const list = document.createElement("dl");
  list.className = "profile-list";
  for (const key of section.keys) {
    list.append(createField(key, profile[key]));
  }

  element.append(heading, list);
  return element;
}

function showSignedOut(): void {
  if (authControlsElement !== null) authControlsElement.hidden = false;
  if (resultElement === null) return;

  resultElement.replaceChildren();
  resultElement.hidden = true;
}

function showProfile(result: AuthenticationResult): void {
  if (resultElement === null) return;

  resultElement.replaceChildren();
  if (authControlsElement !== null) authControlsElement.hidden = true;

  const headingRow = document.createElement("div");
  headingRow.className = "profile-heading";

  const headingCopy = document.createElement("div");
  const heading = document.createElement("h2");
  const displayName = [
    result.profile.first_name,
    result.profile.middle_name,
    result.profile.last_name,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
  heading.textContent = `Welcome, ${displayName}`;

  const message = document.createElement("p");
  message.className = "server-message";
  message.textContent = result.message;
  headingCopy.append(heading, message);

  const logoutButton = document.createElement("button");
  logoutButton.className = "logout-button";
  logoutButton.textContent = "Sign out";
  logoutButton.type = "button";
  logoutButton.addEventListener("click", () => {
    void logout(logoutButton);
  });

  headingRow.append(headingCopy, logoutButton);

  const sections = document.createElement("div");
  sections.className = "profile-sections";
  for (const section of profileSections) {
    sections.append(createSection(result.profile, section));
  }

  resultElement.append(headingRow, sections);
  resultElement.hidden = false;
}

async function authenticate(exchangeCode: string): Promise<void> {
  setStatus("Exchanging the one-time code on the Bun server…", "loading");

  try {
    const response = await fetch("/api/auth/egov/exchange", {
      body: JSON.stringify({ exchangeCode }),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const body = (await response.json()) as AuthenticationError | AuthenticationResult;

    if (!response.ok || "error" in body) {
      throw new Error("error" in body ? body.error : "SSO authentication failed.");
    }

    showProfile(body);
    setStatus("Authenticated through eGov SSO. Session persistence is active.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "SSO authentication failed.";
    setStatus(message, "error");
  }
}

async function restoreSession(): Promise<void> {
  setStatus("Checking for an active eGov SSO session…", "loading");

  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const body = (await response.json()) as
      | AnonymousSession
      | AuthenticationError
      | AuthenticationResult;

    if (!response.ok || "error" in body) {
      throw new Error("error" in body ? body.error : "Could not restore the session.");
    }

    if (body.authenticated) {
      showProfile(body);
      setStatus("Authenticated through eGov SSO. Session restored.", "success");
      return;
    }

    showSignedOut();
    setStatus("Ready. Use the official eGovPH button below.", "idle");
  } catch (error) {
    showSignedOut();
    const message = error instanceof Error ? error.message : "Could not restore the session.";
    setStatus(message, "error");
  }
}

async function logout(button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  setStatus("Signing out…", "loading");

  try {
    const response = await fetch("/api/auth/logout", { cache: "no-store", method: "POST" });
    if (!response.ok) throw new Error("Could not sign out.");

    showSignedOut();
    setStatus("Signed out. The server session has been deleted.", "idle");
  } catch (error) {
    button.disabled = false;
    const message = error instanceof Error ? error.message : "Could not sign out.";
    setStatus(message, "error");
  }
}

window.handleEgovSsoSuccess = (exchangeCode: string): void => {
  void authenticate(exchangeCode);
};

exchangeForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const exchangeCode = exchangeCodeInput?.value.trim() ?? "";
  if (exchangeCode.length === 0) {
    setStatus("Paste a portal-generated exchange code first.", "error");
    return;
  }

  if (exchangeCodeInput !== null) exchangeCodeInput.value = "";
  void authenticate(exchangeCode);
});

void restoreSession();

export {};
