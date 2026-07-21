export type CitizenProfile = {
  id: string;
  firstName: string;
  fullName: string;
  email: string;
  mobile: string;
  address: string;
  city: string;
  barangay: string;
  province: string;
  birthDate: string;
  gender: string;
  nationality: string;
  tinMasked: string;
  rdo: string;
  avatarUrl: string | null;
};

export type { RegisteredBusinessListItem as RegisteredBusiness } from "@/lib/registered-business";
