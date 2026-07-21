export type CitizenProfile = {
  firstName: string;
  fullName: string;
  mobile: string;
  address: string;
  city: string;
  barangay: string;
  tinMasked: string;
  rdo: string;
  avatarUrl: string;
};

export type RegisteredBusiness = {
  id: string;
  name: string;
  type: string;
  tinMasked: string;
  registrationNumber: string;
  status: "Active" | "Draft";
};

export type RegistrationAction = {
  id: string;
  agency: string;
  title: string;
  description: string;
  location: string;
  fee: string;
  eta: string;
  status: "ready" | "up-next" | "locked";
  requirements: string[];
};

export const mockProfile: CitizenProfile = {
  firstName: "Mara",
  fullName: "Mara Teresa Reyes",
  mobile: "+63 917 423 6815",
  address: "Poblacion, Makati City",
  city: "Makati City",
  barangay: "Poblacion",
  tinMasked: "***-***-482-000",
  rdo: "RDO 50 - South Makati",
  avatarUrl: "/images/mara-reyes.png",
};

export const mockBusinesses: RegisteredBusiness[] = [
  {
    id: "biz-001",
    name: "Mara Reyes Creative Services",
    type: "Self-employed professional",
    tinMasked: "***-***-482-000",
    registrationNumber: "COR 2024-50-18426",
    status: "Active",
  },
];

export const mockActions: RegistrationAction[] = [
  {
    id: "dti",
    agency: "DTI",
    title: "Register your business name",
    description: "Secure the name Poblacion Coffee Club as a sole proprietorship.",
    location: "DTI Business Name Registration System",
    fee: "₱530",
    eta: "About 8 minutes",
    status: "ready",
    requirements: ["Proposed business name", "Philippine government ID", "Territorial scope: NCR"],
  },
  {
    id: "barangay",
    agency: "Makati LGU",
    title: "Get a barangay business clearance",
    description: "Submit your DTI certificate to Barangay Poblacion after name approval.",
    location: "Poblacion Barangay Hall, Makati",
    fee: "Estimated ₱500",
    eta: "1 business day",
    status: "up-next",
    requirements: ["DTI certificate", "Valid government ID", "Proof of business address", "Lease or owner consent"],
  },
  {
    id: "bir",
    agency: "BIR",
    title: "Update your tax registration",
    description: "Add your sole proprietorship trade name under your existing individual TIN.",
    location: "RDO 50 - South Makati",
    fee: "₱30 loose DST",
    eta: "1 to 3 business days",
    status: "up-next",
    requirements: ["BIR Form 1901", "DTI certificate", "Valid government ID", "Proof of address", "Books of accounts"],
  },
  {
    id: "permit",
    agency: "Makati LGU",
    title: "Apply for a business permit",
    description: "Complete the city permit after barangay and tax registration documents are ready.",
    location: "Makati Business Permits Office",
    fee: "Assessed by LGU",
    eta: "2 to 5 business days",
    status: "locked",
    requirements: ["Barangay clearance", "DTI certificate", "BIR registration", "Locational clearance"],
  },
];
