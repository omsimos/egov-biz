"use client";

import { useEffect, useState } from "react";
import { DtiFormCard, LguPermitCard, PaymentSheet } from "@/components/business-chat-screen";
import { BusinessDetailScreen, BusinessLanding } from "@/components/egov-business-app";
import { HomeScreen } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import { PhoneFrame, StatusBar } from "@/components/phone-chrome";
import type { DtiBusinessNameForm, LguPermitSummary } from "@/lib/business-chat";
import type { CitizenProfile, RegisteredBusiness } from "@/lib/citizen-profile";
import { writeLastAccount } from "@/lib/last-account";
import type { RegisteredBusiness as RegisteredBusinessDetail } from "@/lib/registered-business";

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
    city: "Makati City",
    nextTaxDue: "2026-08-10",
    nextTaxTitle: "Monthly withholding tax return",
    recordCount: 8,
    fileCount: 4,
  },
];

const previewBusinessDetail: RegisteredBusinessDetail = {
  id: "preview-business",
  conversationId: "preview-conversation",
  name: "Kape Diaria",
  type: "Sole proprietorship",
  category: "food-service",
  registrationNumber: "DTI-2026-104382",
  status: "Active",
  ownerName: "Josh Preview",
  businessActivity: "Coffee subscription boxes and small café retail",
  businessAddress: "Unit 2, 88 Ayala Avenue, Barangay San Lorenzo, Makati City",
  city: "Makati",
  rdo: "RDO 047 – East Makati",
  tinMasked: "TIN •••-•••-421",
  finalizedAt: "2026-07-22T09:00:00.000Z",
  records: [
    {
      id: "record-dti",
      kind: "registration",
      agency: "DTI-BNRS",
      title: "Business name registration",
      referenceNumber: "BN-2026-00834912",
      status: "Active",
      issuedAt: "2026-07-22",
      validUntil: "2031-07-22",
      note: "Fetched from the DX BNRS service.",
      source: "DX",
    },
    {
      id: "record-brgy",
      kind: "permit",
      agency: "Makati City LGU",
      title: "Business Permit",
      referenceNumber: "LGU-BP-2026-10422",
      status: "Active",
      issuedAt: "2026-07-22",
      validUntil: "2026-12-31",
      note: "Issued by the combined DX LGU permit flow.",
      source: "DX",
    },
    {
      id: "record-clearance",
      kind: "permit",
      agency: "Makati City LGU",
      title: "Barangay Business Clearance",
      referenceNumber: "LGU-BC-2026-10422",
      status: "Issued",
      issuedAt: "2026-07-22",
      validUntil: "2026-12-31",
      note: "Issued with the business permit; included in the LGU fee.",
      source: "DX",
    },
  ],
  files: [
    {
      id: "bir-form-2303",
      title: "BIR Certificate of Registration (Form 2303)",
      filename: "BIR-Certificate-of-Registration-2303.html",
      documentType: "Certificate of Registration",
      status: "Available",
      createdAt: "2026-07-22",
      url: null,
      note: "Printable certificate populated from the saved BIR registration record.",
      source: "DX",
    },
    {
      id: "file-bir-1901",
      title: "BIR Form 1901",
      filename: "BIR-Form-1901.pdf",
      documentType: "Prefilled registration form",
      status: "Generated",
      createdAt: "2026-07-22",
      url: null,
      note: "Stored by the DX BIR service; submission to BIR is still required.",
      source: "DX",
    },
  ],
  taxObligations: [],
};

const previewDtiForm: DtiBusinessNameForm = {
  applicationType: "New registration",
  status: "Ready to submit",
  proposedName: "Kape Diaria",
  businessActivity: "Coffee subscription boxes and small café retail",
  territorialScope: "City / municipality",
  ownerName: "Josh Preview",
  businessAddress: "Unit 2, 88 Ayala Avenue, Barangay San Lorenzo",
  city: "Makati",
  feeLabel: "₱1,030.00",
  feeBreakdown: { documentaryStamp: "₱30.00", registration: "₱1,000.00" },
  missingFields: [],
};

// The card shows the "Edited" note for labels in this set; the preview has no
// agent to apply a change, so nothing is in it.
const previewEditedFields = new Set<string>();

const previewLguPermit: LguPermitSummary = {
  applicationId: "lgu-preview-application",
  state: "PAYMENT_READY",
  businessName: "Kape Diaria",
  city: "Makati",
  feeLabel: "₱2,500",
  paymentStatus: null,
  businessPermitNumber: null,
  barangayClearanceNumber: null,
  validUntil: null,
};

function ChatCardsPreview() {
  const [showPayment, setShowPayment] = useState(false);
  const noop = () => {};
  return (
    <div className="screen preview-cards-screen">
      <StatusBar />
      <div className="preview-cards-scroll">
        <button className="preview-cards-toggle" onClick={() => setShowPayment(true)} type="button">
          Show payment sheet
        </button>
        <DtiFormCard
          editedFields={previewEditedFields}
          form={previewDtiForm}
          onEditField={noop}
          onSubmitPay={noop}
          paid={false}
        />
        <LguPermitCard permit={previewLguPermit} paid={false} onPay={noop} />
      </div>
      {showPayment && (
        <PaymentSheet
          conversationId="preview-conversation"
          onClose={() => setShowPayment(false)}
          payment={{
            serviceType: "dti-business-name",
            serviceLabel: "DTI Business Name Registration",
            proposedName: "Kape Diaria",
            feeLabel: "₱1,030.00",
            feeLines: [
              { amount: "₱1,000.00", label: "Kape Diaria" },
              { amount: "₱30.00", label: "Documentary stamp" },
            ],
          }}
        />
      )}
    </div>
  );
}

const screens = ["home", "business", "record", "cards", "login"] as const;
type PreviewScreen = (typeof screens)[number];

export function PreviewStage() {
  const [screen, setScreenState] = useState<PreviewScreen>("home");
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    // Looking the fragment up in `screens` rather than testing membership hands
    // back the matching literal, so the screen it selects is a PreviewScreen by
    // construction.
    const requested = screens.find((candidate) => candidate === hash);
    // The deep link (#login, #cards) lives in the URL, which is only readable
    // after hydration; picking it during render would diverge from the server
    // markup, so this stays an effect that syncs React with the address bar.
    // oxlint-disable-next-line react/set-state-in-effect
    if (requested) setScreenState(requested);
  }, []);
  // State, not a ref: DialogContent reads it during render to pick its portal
  // container, so the frame mounting has to cause a re-render.
  const [phoneFrame, setPhoneFrame] = useState<HTMLElement | null>(null);
  const setScreen = (next: PreviewScreen) => {
    // The address bar is this harness's deep link, so navigating writes it
    // back. window is genuinely the outside value being mutated here, and it
    // is mutated from a click handler, which is where such a write belongs.
    // oxlint-disable-next-line react/immutability
    window.location.hash = next;
    setScreenState(next);
  };
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
              // Seed the remembered account so the login preview shows its full state.
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
      <div className="phone-shell" ref={setPhoneFrame}>
        <PhoneFrame element={phoneFrame}>
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
              onOpenBusiness={() => setScreen("record")}
              onResume={noop}
              onSubmit={noop}
              profile={previewProfile}
            />
          )}
          {screen === "record" && (
            <BusinessDetailScreen
              business={previewBusinessDetail}
              conversations={[]}
              conversationsLoading={false}
              error={null}
              loading={false}
              onBack={() => setScreen("business")}
              onNewChat={noop}
              onOpenChat={noop}
              onShowAllChats={noop}
              profile={previewProfile}
            />
          )}
          {screen === "cards" && <ChatCardsPreview />}
          {screen === "login" && <LoginScreen />}
        </PhoneFrame>
      </div>
    </div>
  );
}
