import type { EgovSsoCitizenProfile } from "egov.js";
import type { Bir1901Data, Bir1905Data } from "@repo/dx/bir";
import { resolveSsoTin } from "@/lib/tin";

const syntheticSignature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQQAAABGCAYAAAAq7+rZAAADFklEQVR42u3dS24iMRCAYYNml0tkkRvlnNwoI3EJ1swKaYQI/Sq/v1/KJiIkMeXfLnd19el+vycASCmlsyEAQAgACAEAIQAgBACEAIAQABACAEIAQAgACAEAIQAgBACEAIAQABACgMb4YwgwEh+f34sdf27Xy8lI2SGADDa9jhCAwWVACu856amIEUXwKi149Vrpw6RCEAxzy0AcEMKmbaGgGF8GpDCxEPbkiCWC4vnvEoh1dnukMJEQ3sngdr2clmQRHRhr5SQgy0qVnCcQwlbzL8mj5A5FYJafxKQwsBD2bgMjpRB1OYsUyk1eUkjjVSoeyQkfr3v1Ho/vLb3XkQq5334vKagbsENo4JLi2skdXSbroCv2asLe3zPzmA8phIgP9OiKFHXQNXOAlpIBKQwkhNz531Yx5JBRD8EZfThbWgakMIAQakycUit4L1KIrveoJQIHjMntzy2f/j+fUbR2yHgkpaqx60Ka625HQdNOevD46vFzVYewMmVoLbeaJddrbQsbfQ9BqxNz1rOEXUKoPVCzfVitSGG2KyAzSuHcW7GIAhW3jyuMakAIW6rsMFZeqzbCGUKzATLzdeIa/7udQRtjXmqh2F2HUCNQVJKVHQM7g7Jj3sIdsudetrFkUD9dm3Xc//+/c4z5x+f3/ej7RrzH4UPF5wDJFaDOKVzuHFXEa2s61tZ3HP3bztGrhslbdpXOtWKRQV4pvFvRlyZ+dPFX9krFnAYVnHmlQOj506W9Ioj6mexCWNsDnwxc8pxdxLlu3oraNYTe7Zi7UYng1F+w1yKt2ndxVkkZIncKgrNs6mC886QBS2cFaYZ+CEd3CoKz7ERWb9BPR61uG6REdkAWnPmkYLz766jVbcekiGckCM58UjDe5aTQy7hmb6G2NugEJ/li8TP+uV0vX933VGz1OYszdinu6YDryMRJ4x4kfw3RZNWTmJs97Ppr4qBK1+Wec61RVx0TB1mFYLs27rMSkLRht+ooO4YdAoDkuQwACAEACAEAIQAgBACEAIAQABACAEIAQAgACAEAIQAgBABF+Adh2vV68Zl3IQAAAABJRU5ErkJggg==";

export const completeEgovSsoTestProfile = {
  additional_information: {
    birth_place: {
      birth_country: "Philippines",
      birth_municipality: "Manila",
      birth_province: "Metro Manila",
    },
    educational_attainment: [
      {
        educational_background: "Bachelor of Science in Information Technology",
        from: "2010",
        level: "College Graduate",
        school: "Example State University",
        to: "2014",
      },
    ],
    emergency_information: {
      emergency_contact: "+639170000001",
      emergency_name: "Maria Santos Dela Cruz",
      emergency_relationship: "Spouse",
    },
    expected_salary: { expected_salary: "60000" },
    father_details: {
      father_birthdate: "1958-03-15",
      father_firstname: "Roberto",
      father_lastname: "Dela Cruz",
    },
    health_data: {
      complexion: "Medium",
      eyes_color: "Brown",
      height: "170 cm",
      weight: "68 kg",
    },
    industry: { industry: "Information and Communications Technology" },
    mother_details: {
      mother_birthdate: "1960-08-24",
      mother_maiden_firstname: "Elena",
      mother_maiden_lastname: "Reyes",
      mother_maiden_middlename: "Garcia",
    },
    occupation: { occupation: "Software Consultant" },
    other_personal_information: {
      marital_status: "Married",
      religion: "Roman Catholic",
    },
  },
  address: "Unit 4B, 123 Mabini Street, Barangay San Isidro, Quezon City, Metro Manila, 1100",
  address_line_2: "Unit 4B",
  barangay: "Barangay San Isidro",
  barangay_code: "137404001",
  birth_date: "1990-01-23",
  country: "Philippines",
  country_alpha_2_code: "PH",
  country_alpha_3_code: "PHL",
  country_id: 608,
  email: "juan.complete@example.test",
  first_name: "Juan",
  foreign_address: {
    address: "100 Example Avenue",
    city: "Sample City",
    country: "Example Country",
    postal: "00000",
  },
  gender: "Male",
  last_name: "Dela Cruz",
  middle_name: "Santos",
  mobile: "+639170000000",
  municipality: "Quezon City",
  municipality_code: "137404",
  national_id: {
    code: "SYNTHETIC-NATIONAL-ID",
    face_url: "https://assets.example.test/complete-user-face.png",
    pcn: "0000-0000-0000-0001",
    signature: syntheticSignature,
  },
  nationality: "Filipino",
  passport: {
    birth_date: "1990-01-23",
    expiry_date: "2033-06-14",
    first_name: "Juan",
    gender: "Male",
    issued_date: "2023-06-15",
    last_name: "Dela Cruz",
    middle_name: "Santos",
    passport_number: "P0000001",
    place_issued: "Paranaque City, PH",
    suffix: "Jr.",
  },
  photo: "https://assets.example.test/complete-user-photo.png",
  postal: "1100",
  province: "Metro Manila",
  province_code: "1374",
  region: "National Capital Region",
  region_code: "130000000",
  signature: syntheticSignature,
  signature_url: "https://assets.example.test/complete-user-signature.png",
  street: "123 Mabini Street",
  suffix: "Jr.",
  tin_id: "123-456-789-00000",
  uniqid: "synthetic-complete-egov-user",
} satisfies EgovSsoCitizenProfile;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function joinNonEmpty(parts: ReadonlyArray<unknown>, separator = " ") {
  return parts.map(stringValue).filter(Boolean).join(separator);
}

function optionalString(value: unknown) {
  return stringValue(value) || undefined;
}

function splitStreet(value: unknown) {
  const street = stringValue(value);
  const match = /^(\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?)\s+(.+)$/.exec(street);
  return {
    lotBlockPhaseHouseNo: match?.[1] || undefined,
    streetName: match?.[2] || street || undefined,
  };
}

function foreignAddressFromUnknown(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const record = value as Record<string, unknown>;
  const parts = [
    "address",
    "address_line_1",
    "address_line_2",
    "city",
    "municipality",
    "province",
    "postal",
    "country",
  ].flatMap((key) => (typeof record[key] === "string" ? [record[key].trim()] : []));
  return [...new Set(parts.filter(Boolean))].join(", ");
}

export function mapEgovProfileToBir1901(profile: unknown): Bir1901Data {
  const rawProfile = recordValue(profile);
  const additional = recordValue(rawProfile.additional_information);
  const birthPlace = recordValue(additional.birth_place);
  const father = recordValue(additional.father_details);
  const mother = recordValue(additional.mother_details);
  const otherPersonalInformation = recordValue(additional.other_personal_information);
  const nationalId = recordValue(rawProfile.national_id);
  const passport = recordValue(rawProfile.passport);
  const fullName = joinNonEmpty([
    rawProfile.first_name,
    rawProfile.middle_name,
    rawProfile.last_name,
    rawProfile.suffix,
  ]);
  const birthPlaceText = joinNonEmpty(
    [birthPlace.birth_municipality, birthPlace.birth_province, birthPlace.birth_country],
    ", ",
  );
  const fatherName = joinNonEmpty([father.father_firstname, father.father_lastname]);
  const motherMaidenName = joinNonEmpty([
    mother.mother_maiden_firstname,
    mother.mother_maiden_middlename,
    mother.mother_maiden_lastname,
  ]);
  const foreignAddress = foreignAddressFromUnknown(rawProfile.foreign_address);
  const signatureSource = [rawProfile.signature, nationalId.signature]
    .map(stringValue)
    .find(Boolean);
  const tin = resolveSsoTin(rawProfile);
  const gender = /^male$/i.test(stringValue(rawProfile.gender))
    ? ("male" as const)
    : /^female$/i.test(stringValue(rawProfile.gender))
      ? ("female" as const)
      : undefined;
  const civilStatusValue = stringValue(otherPersonalInformation.marital_status);
  const civilStatus = /^single$/i.test(civilStatusValue)
    ? ("single" as const)
    : /^married$/i.test(civilStatusValue)
      ? ("married" as const)
      : /^(?:widow(?:er|ed)?)$/i.test(civilStatusValue)
        ? ("widowed" as const)
        : /^(?:legally\s+)?separated$/i.test(civilStatusValue)
          ? ("legallySeparated" as const)
          : undefined;
  const localResidenceAddress = {
    unitRoomFloorBuildingNo: optionalString(rawProfile.address_line_2),
    ...splitStreet(optionalString(rawProfile.street) ?? rawProfile.address),
    barangay: optionalString(rawProfile.barangay),
    municipalityCity: optionalString(rawProfile.municipality),
    province: optionalString(rawProfile.province),
    zipCode: optionalString(rawProfile.postal),
  };

  return {
    registration: {
      philsysCardNumber: optionalString(nationalId.pcn),
    },
    taxpayerInformation: {
      tin,
      taxpayerName: {
        lastName: optionalString(rawProfile.last_name),
        firstName: optionalString(rawProfile.first_name),
        middleName: optionalString(rawProfile.middle_name),
        suffix: optionalString(rawProfile.suffix),
      },
      gender,
      civilStatus,
      birthOrOrganizationDate: optionalString(rawProfile.birth_date),
      placeOfBirth: birthPlaceText || undefined,
      motherMaidenName: motherMaidenName || undefined,
      fatherName: fatherName || undefined,
      citizenship: optionalString(rawProfile.nationality),
      localResidenceAddress,
      foreignAddress: foreignAddress || undefined,
      identification: {
        type: optionalString(passport.passport_number) ? "Passport" : undefined,
        idNumber: optionalString(passport.passport_number),
        effectivityDate: optionalString(passport.issued_date),
        expiryDate: optionalString(passport.expiry_date),
        placeCountryOfIssue: optionalString(passport.place_issued),
      },
      contact: {
        preferredTypes: optionalString(rawProfile.mobile) ? ["mobile"] : undefined,
        mobile: optionalString(rawProfile.mobile),
        email: optionalString(rawProfile.email),
      },
    },
    declaration: {
      signatureSource,
      printedName: fullName || undefined,
    },
    paymentOrder: {
      taxpayerTin: tin,
      taxpayerName: fullName || undefined,
    },
  };
}

export function mapEgovProfileToBir1905(profile: unknown): Bir1905Data {
  const rawProfile = recordValue(profile);
  const nationalId = recordValue(rawProfile.national_id);
  const registeredName = joinNonEmpty(
    [rawProfile.last_name, rawProfile.first_name, rawProfile.middle_name, rawProfile.suffix],
    ", ",
  );
  const signatureSource = [rawProfile.signature, nationalId.signature]
    .map(stringValue)
    .find(Boolean);

  return {
    taxpayerInformation: {
      tin: resolveSsoTin(rawProfile),
      contactNumber: optionalString(rawProfile.mobile) || optionalString(rawProfile.landline),
      registeredName: registeredName || undefined,
    },
    declaration: {
      signatureSource,
      printedName: registeredName || undefined,
    },
  };
}
