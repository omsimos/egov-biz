"use client";

import { useState } from "react";
import { BusinessLanding } from "@/components/egov-business-app";
import { HomeScreen } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import type { CitizenProfile, RegisteredBusiness } from "@/lib/citizen-profile";
import { writeLastAccount } from "@/lib/last-account";

const previewProfile: CitizenProfile = {
  id: "preview",
  firstName: "Josh",
  fullName: "Josh Preview",
  email: "preview@example.com",
  mobile: "+63 900 000 0000",
  address: "",
  city: "Makati",
  barangay: "",
  province: "Metro Manila",
  birthDate: "",
  gender: "",
  nationality: "Filipino",
  tinMasked: "",
  rdo: "",
  avatarUrl: null,
};

const previewBusinesses: RegisteredBusiness[] = [
  {
    id: "preview-business",
    name: "Kape Diaria",
    type: "Sole proprietorship",
    registrationNumber: "DTI-2026-104382",
    status: "Active",
    finalizedAt: "2026-07-22T00:00:00.000Z",
    nextTaxDue: "2026-08-10",
  },
];

const screens = ["home", "business", "login"] as const;
type PreviewScreen = (typeof screens)[number];

export function PreviewStage() {
  const [screen, setScreen] = useState<PreviewScreen>("home");
  const noop = () => {};
  return (
    <div className="prototype-stage">
      <div className="preview-switch" role="tablist" aria-label="Preview screen">
        {screens.map((item) => (
          <button
            aria-selected={screen === item}
            className={screen === item ? "active" : ""}
            key={item}
            onClick={() => {
              // Seed the remembered account so the login mock shows its full state.
              if (item === "login") {
                writeLastAccount({ firstName: "Josh", maskedMobile: "+63992***5602" });
              }
              setScreen(item);
            }}
            role="tab"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <div className="phone-shell">
        {screen === "home" && (
          <HomeScreen
            onBusiness={() => setScreen("business")}
            onLogout={noop}
            profile={previewProfile}
          />
        )}
        {screen === "business" && (
          <BusinessLanding
            businesses={previewBusinesses}
            businessesLoading={false}
            conversations={[]}
            initialPrompt=""
            onBack={() => setScreen("home")}
            onDelete={noop}
            onOpenBusiness={noop}
            onResume={noop}
            onSubmit={noop}
            profile={previewProfile}
          />
        )}
        {screen === "login" && <LoginScreen />}
      </div>
    </div>
  );
}
