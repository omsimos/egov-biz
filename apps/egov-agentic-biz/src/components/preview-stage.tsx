"use client";

import { useEffect, useState } from "react";
import {
  BarangayClearanceCard,
  ComplianceResultCard,
  DtiFormCard,
  EbplsPermitCard,
  PaymentDialog,
} from "@/components/business-chat-screen";
import { BusinessDetailScreen, BusinessLanding } from "@/components/egov-business-app";
import { HomeScreen } from "@/components/home-screen";
import { LoginScreen } from "@/components/login-screen";
import { StatusBar } from "@/components/phone-chrome";
import type {
  BarangayClearance,
  DtiBusinessNameForm,
  EbplsBusinessPermitReceipt,
} from "@/lib/business-chat";
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
    nextTaxDue: "2026-08-10",
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
      agency: "Department of Trade and Industry",
      title: "Business name registration",
      referenceNumber: "BN-2026-00834912",
      status: "Active",
      issuedAt: "2026-07-22",
      validUntil: "2031-07-22",
      note: "Registered business name, valid for five years.",
      demo: true,
    },
    {
      id: "record-brgy",
      kind: "permit",
      agency: "Barangay San Lorenzo, Makati",
      title: "Barangay business clearance",
      referenceNumber: "BRGY-SL-2026-10422",
      status: "Issued",
      issuedAt: "2026-07-22",
      validUntil: "2026-12-31",
      note: "Clearance to operate within the barangay.",
      demo: true,
    },
    {
      id: "record-bir",
      kind: "tax",
      agency: "Bureau of Internal Revenue",
      title: "Certificate of Registration (Form 2303)",
      referenceNumber: "COR-118-220-421",
      status: "Configured",
      issuedAt: "2026-07-22",
      validUntil: null,
      note: "Sole proprietor registered under percentage tax.",
      demo: true,
    },
    {
      id: "record-employer",
      kind: "employer",
      agency: "SSS · PhilHealth · Pag-IBIG",
      title: "Employer registration",
      referenceNumber: "—",
      status: "Not required",
      issuedAt: null,
      validUntil: null,
      note: "No employees declared yet.",
      demo: true,
    },
  ],
  files: [
    {
      id: "file-cor",
      title: "BIR Certificate of Registration",
      filename: "kape-diaria-bir-2303.pdf",
      documentType: "BIR Form 2303",
      status: "Generated",
      createdAt: "2026-07-22",
      url: null,
      note: "Generated from your registration answers for the demo walkthrough.",
      demo: true,
    },
    {
      id: "file-dti",
      title: "DTI Business Name Certificate",
      filename: "kape-diaria-dti-certificate.pdf",
      documentType: "DTI Certificate",
      status: "Available",
      createdAt: "2026-07-22",
      url: null,
      note: "Sample certificate held in the document vault.",
      demo: true,
    },
  ],
  taxObligations: [
    {
      id: "tax-2551q",
      title: "Percentage tax return",
      formCode: "BIR 2551Q",
      frequency: "Quarterly",
      periodLabel: "3rd quarter 2026",
      dueDate: "2026-10-25",
      status: "Upcoming",
      note: "File even if there are no sales for the quarter.",
    },
    {
      id: "tax-1701q",
      title: "Quarterly income tax",
      formCode: "BIR 1701Q",
      frequency: "Quarterly",
      periodLabel: "3rd quarter 2026",
      dueDate: "2026-11-15",
      status: "Scheduled",
      note: "Based on net income for the quarter.",
    },
    {
      id: "tax-0605",
      title: "Annual registration fee",
      formCode: "BIR 0605",
      frequency: "Annual",
      periodLabel: "Calendar year 2027",
      dueDate: "2027-01-31",
      status: "Scheduled",
      note: "Payable through eGovPay and other ePay channels.",
    },
  ],
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
  missingFields: [],
};

const previewClearance: BarangayClearance = {
  businessName: "Kape Diaria",
  ownerName: "Josh Preview",
  businessActivity: "Coffee subscription boxes and small café retail",
  businessAddress: "Unit 2, 88 Ayala Avenue, Barangay San Lorenzo, Makati",
  barangay: "San Lorenzo",
  city: "Makati",
  registrationDocument: "DTI BN-2026-00834912",
  supportingDocuments: ["DTI business name certificate", "Lease contract", "Valid government ID"],
  status: "Payment required",
  referenceNumber: "BRGY-SL-2026-10422",
  submittedAt: "2026-07-22T09:00:00.000Z",
  approvedAt: null,
  validUntil: null,
  feeLabel: "₱500.00",
  usedFor: ["Mayor’s permit application", "BIR registration"],
};

const previewEbpls: EbplsBusinessPermitReceipt = {
  system: "EBPLS",
  permitType: "New business permit",
  businessName: "Kape Diaria",
  ownerName: "Josh Preview",
  businessActivity: "Coffee subscription boxes and small café retail",
  businessAddress: "Unit 2, 88 Ayala Avenue, Barangay San Lorenzo, Makati",
  barangay: "San Lorenzo",
  city: "Makati",
  barangayClearanceReference: "BRGY-SL-2026-10422",
  registrationDocument: "DTI BN-2026-00834912",
  attachments: ["Barangay clearance", "DTI certificate", "Lease contract"],
  status: "Payment required",
  referenceNumber: "EBPLS-MKT-2026-55817",
  submittedAt: "2026-07-22T09:30:00.000Z",
  issuedAt: null,
  validUntil: null,
  feeLabel: "₱4,250.00",
  nextAction: "Pay the assessed local taxes and fees to issue the permit.",
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
        <DtiFormCard form={previewDtiForm} paid={false} onSubmitPay={noop} />
        <BarangayClearanceCard clearance={previewClearance} paid={false} onPay={noop} />
        <EbplsPermitCard receipt={previewEbpls} paid={false} onPay={noop} />
        <ComplianceResultCard
          title="Registration records saved"
          subtitle="Kape Diaria is now linked to your eGovPH account."
          records={previewBusinessDetail.records}
          obligations={previewBusinessDetail.taxObligations}
        />
      </div>
      {showPayment && (
        <PaymentDialog
          conversationId="preview-conversation"
          onClose={() => setShowPayment(false)}
          payment={{
            serviceType: "dti-business-name",
            serviceLabel: "DTI Business Name Registration",
            proposedName: "Kape Diaria",
            ownerName: "Josh Preview",
            feeLabel: "₱1,030.00",
            territorialScope: "City / municipality",
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
    if ((screens as readonly string[]).includes(hash)) setScreenState(hash as PreviewScreen);
  }, []);
  const setScreen = (next: PreviewScreen) => {
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
            profile={previewProfile}
          />
        )}
        {screen === "cards" && <ChatCardsPreview />}
        {screen === "login" && <LoginScreen />}
      </div>
    </div>
  );
}
