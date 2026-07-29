import { z } from "zod";

const optionalText = (maximum = 180) => z.string().trim().min(1).max(maximum).optional();
const optionalLongText = optionalText(2_000);
const optionalDate = z.iso.date().optional();
const optionalEmail = z.email().max(254).optional();
const optionalPhone = z
  .string()
  .trim()
  .min(5)
  .max(32)
  .regex(/^\+?[0-9().\s-]+$/, "Use a valid telephone number")
  .optional();
const optionalTin = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(
    /^(?=(?:\D*\d){9,14}\D*$)[0-9\s-]+$/,
    "TIN must contain 9 to 14 digits with optional spaces or hyphens",
  )
  .optional();
const optionalZipCode = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "ZIP code must contain exactly four digits")
  .optional();
const optionalMoney = z.number().finite().nonnegative().max(1_000_000_000_000).optional();
const optionalCount = z.number().int().nonnegative().max(1_000_000).optional();
const optionalBoolean = z.boolean().optional();

const addressSchema = z.strictObject({
  unitRoomFloorBuildingNo: optionalText(80),
  buildingNameTower: optionalText(100),
  lotBlockPhaseHouseNo: optionalText(80),
  streetName: optionalText(100),
  subdivisionVillageZone: optionalText(100),
  barangay: optionalText(100),
  townDistrict: optionalText(100),
  municipalityCity: optionalText(100),
  province: optionalText(100),
  zipCode: optionalZipCode,
});

const contactSchema = z.strictObject({
  preferredTypes: z
    .array(z.enum(["landline", "fax", "mobile"]))
    .max(3)
    .optional(),
  landline: optionalPhone,
  fax: optionalPhone,
  mobile: optionalPhone,
  email: optionalEmail,
});

const personNameSchema = z.strictObject({
  lastName: optionalText(100),
  firstName: optionalText(100),
  middleName: optionalText(100),
  suffix: optionalText(24),
  nickname: optionalText(80),
});

const taxTypeRowSchema = z.strictObject({
  selected: optionalBoolean,
  formType: optionalText(40),
  atc: optionalText(40),
});

const taxTypeWithDescriptionSchema = taxTypeRowSchema.extend({
  description: optionalText(160),
});

const describedTaxTypeSchema = z.strictObject({
  description: optionalText(160),
  formType: optionalText(40),
  atc: optionalText(40),
});

const industrySchema = z.strictObject({
  industry: optionalText(120),
  tradeBusinessName: optionalText(160),
  regulatoryBody: optionalText(120),
  businessRegistrationNumber: optionalText(80),
  businessRegistrationDate: optionalDate,
  psicCode: optionalText(20),
  lineOfBusiness: optionalText(160),
});

const invoiceDescriptionSchema = z.strictObject({
  description: optionalText(160),
  type: z.enum(["vat", "nonVat"]).optional(),
  looseBoxesBooklets: optionalCount,
  boundBoxesBooklets: optionalCount,
  setsPerBoxBooklet: optionalCount,
  serialNumberStart: optionalText(40),
  serialNumberEnd: optionalText(40),
  copiesPerSet: optionalCount,
});

const employerSchema = z.strictObject({
  name: optionalText(180),
  primaryEmployer: optionalBoolean,
  tin: optionalTin,
});

const signatureSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_800_000)
  .optional()
  .describe("PNG/JPEG data URL, base64 image, or HTTPS image URL");

/**
 * Every writable white space, checkbox, and radio-like choice on the supplied
 * October 2025 (ENCS) BIR Form 1901. All form values are optional for draft
 * generation; `type` remains required at the outer tool-input level.
 */
export const bir1901DataSchema = z.strictObject({
  registration: z
    .strictObject({
      dln: optionalText(40),
      tinToBeIssued: optionalTin,
      registeringOffice: z.enum(["headOffice", "branchOffice", "facility"]).optional(),
      birRegistrationDate: optionalDate,
      philsysCardNumber: z
        .string()
        .trim()
        .min(16)
        .max(32)
        .regex(/^(?=(?:\D*\d){16}\D*$)[0-9\s-]+$/, "PCN must contain 16 digits")
        .optional(),
    })
    .optional(),
  taxpayerInformation: z
    .strictObject({
      tin: optionalTin,
      rdoCode: z
        .string()
        .trim()
        .regex(/^\d{3}$/, "RDO code must contain exactly three digits")
        .optional(),
      taxpayerType: z
        .enum([
          "singleProprietorshipResidentCitizen",
          "singleProprietorDigitalServiceProvider",
          "residentAlienSingleProprietorship",
          "residentAlienProfessional",
          "professionalLicensed",
          "professionalGeneral",
          "professionalAndSingleProprietor",
          "mixedIncomeCompensationAndSingleProprietor",
          "mixedIncomeCompensationAndProfessional",
          "mixedIncomeCompensationSingleProprietorAndProfessional",
          "nonResidentAlienTradeBusiness",
          "estateFilipinoCitizen",
          "estateForeignNational",
          "trustFilipinoCitizen",
          "trustForeignNational",
        ])
        .optional(),
      taxpayerName: personNameSchema.optional(),
      estateOrTrustName: optionalText(240),
      gender: z.enum(["male", "female"]).optional(),
      civilStatus: z.enum(["single", "married", "widowed", "legallySeparated"]).optional(),
      birthOrOrganizationDate: optionalDate,
      placeOfBirth: optionalText(140),
      motherMaidenName: optionalText(180),
      fatherName: optionalText(180),
      citizenship: optionalText(100),
      otherCitizenship: optionalText(100),
      localResidenceAddress: addressSchema.optional(),
      businessAddress: addressSchema.optional(),
      foreignAddress: optionalLongText,
      municipalityCode: optionalText(20),
      purposeOfTinApplication: optionalText(240),
      identification: z
        .strictObject({
          type: optionalText(80),
          idNumber: optionalText(80),
          effectivityDate: optionalDate,
          expiryDate: optionalDate,
          issuer: optionalText(80),
          placeCountryOfIssue: optionalText(100),
        })
        .optional(),
      contact: contactSchema.optional(),
      eightPercentIncomeTaxRate: z.enum(["yes", "no"]).optional(),
    })
    .optional(),
  taxpayerClassification: z
    .strictObject({
      expectedAnnualGrossSales: z.enum(["micro", "small", "medium", "large"]).optional(),
    })
    .optional(),
  spouseInformation: z
    .strictObject({
      employmentStatus: z
        .enum(["unemployed", "employedLocally", "employedAbroad", "businessOrProfession"])
        .optional(),
      name: optionalText(180),
      tin: optionalTin,
      employerName: optionalText(240),
      employerTin: optionalTin,
    })
    .optional(),
  authorizedRepresentative: z
    .strictObject({
      individualName: personNameSchema.optional(),
      nonIndividualRegisteredName: optionalText(240),
      relationshipDate: optionalDate,
      addressType: z.enum(["residence", "placeOfBusiness", "employerAddress"]).optional(),
      address: addressSchema.optional(),
      contact: contactSchema.optional(),
    })
    .optional(),
  businessInformation: z
    .strictObject({
      singleBusinessNumber: optionalText(80),
      primaryIndustry: industrySchema.optional(),
      secondaryIndustry: industrySchema.optional(),
      incentives: z
        .strictObject({
          investmentPromotion: optionalText(120),
          legalBasis: optionalText(120),
          incentiveGranted: optionalText(180),
          numberOfYears: z.number().finite().nonnegative().max(100).optional(),
          startDate: optionalDate,
          endDate: optionalDate,
        })
        .optional(),
      registrationAccreditation: z
        .strictObject({
          number: optionalText(100),
          effectivityDateFrom: optionalDate,
          effectivityDateTo: optionalDate,
          dateIssued: optionalDate,
          registeredActivity: optionalText(160),
          taxRegime: z.enum(["regular", "special", "exempt"]).optional(),
          activityStartDate: optionalDate,
          activityEndDate: optionalDate,
        })
        .optional(),
    })
    .optional(),
  facilityDetails: z
    .strictObject({
      facilityCode: z
        .string()
        .trim()
        .regex(
          /^(?:F[- ]?)?\d{1,12}$/i,
          "Facility code must contain an optional F prefix and digits",
        )
        .optional(),
      facilityType: z
        .enum([
          "placeOfProduction",
          "storagePlace",
          "warehouse",
          "showroom",
          "garage",
          "busTerminal",
          "realPropertyForLease",
          "other",
        ])
        .optional(),
      otherFacilityType: optionalText(80),
      address: addressSchema.optional(),
    })
    .optional(),
  taxTypes: z
    .strictObject({
      incomeTax: z
        .strictObject({
          individualIncomeTax: taxTypeRowSchema.optional(),
          capitalGainsRealProperty: taxTypeRowSchema.optional(),
          capitalGainsStocks: taxTypeRowSchema.optional(),
        })
        .optional(),
      withholdingTax: z
        .strictObject({
          compensation: taxTypeRowSchema.optional(),
          expanded: taxTypeRowSchema.optional(),
          final: taxTypeRowSchema.optional(),
          fringeBenefits: taxTypeRowSchema.optional(),
          valueAddedTax: taxTypeRowSchema.optional(),
          otherPercentageTax: taxTypeRowSchema.optional(),
          onettNotSubjectToCgt: taxTypeRowSchema.optional(),
          winningsAndPrizes: taxTypeRowSchema.optional(),
          interestOnDepositsAndYield: taxTypeRowSchema.optional(),
        })
        .optional(),
      percentageTax: z
        .strictObject({
          stocks: taxTypeRowSchema.optional(),
          stocksInitialPublicOffering: taxTypeRowSchema.optional(),
          overseasDispatchAndAmusement: taxTypeRowSchema.optional(),
          underSpecialLaws: taxTypeRowSchema.optional(),
          otherPercentageTaxesUnderNirc: taxTypeWithDescriptionSchema.optional(),
        })
        .optional(),
      valueAddedTax: taxTypeRowSchema.optional(),
      exciseTax: z
        .strictObject({
          alcoholProducts: taxTypeRowSchema.optional(),
          automobileAndNonEssentialGoods: taxTypeRowSchema.optional(),
          cosmeticProcedures: taxTypeRowSchema.optional(),
          mineralProducts: taxTypeRowSchema.optional(),
          petroleumProducts: taxTypeRowSchema.optional(),
          sweetenedBeverages: taxTypeRowSchema.optional(),
          tobaccoProducts: taxTypeRowSchema.optional(),
          tobaccoInspectionMonitoringFees: taxTypeRowSchema.optional(),
          vaporProducts: taxTypeRowSchema.optional(),
        })
        .optional(),
      documentaryStampTax: z
        .strictObject({
          regular: taxTypeRowSchema.optional(),
          onett: taxTypeRowSchema.optional(),
        })
        .optional(),
      transferTax: z
        .strictObject({
          donorsTax: taxTypeRowSchema.optional(),
          estateTax: taxTypeRowSchema.optional(),
        })
        .optional(),
      miscellaneousTax: describedTaxTypeSchema.optional(),
      others: describedTaxTypeSchema.optional(),
    })
    .optional(),
  invoices: z
    .strictObject({
      birPrintedInvoices: z
        .strictObject({
          intendsToUse: z.enum(["yes", "no"]).optional(),
          type: z.enum(["vat", "nonVat"]).optional(),
          numberOfBooklets: optionalCount,
          serialNumberStart: optionalText(40),
          serialNumberEnd: optionalText(40),
        })
        .optional(),
      authorityToPrint: z
        .strictObject({
          printerName: optionalText(180),
          printerTin: optionalTin,
          printerAccreditationNumber: optionalText(100),
          accreditationDate: optionalDate,
          registeredAddress: addressSchema.optional(),
          contactNumber: optionalPhone,
          email: optionalEmail,
          manner: z.enum(["bound", "looseLeaf"]).optional(),
          descriptions: z.array(invoiceDescriptionSchema).max(4).optional(),
        })
        .optional(),
    })
    .optional(),
  multipleEmployments: z
    .strictObject({
      type: z.enum(["successive", "concurrent"]).optional(),
      employers: z.array(employerSchema).max(2).optional(),
      primaryCurrentEmployer: z
        .strictObject({
          relationshipStartDate: optionalDate,
          contact: contactSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  declaration: z
    .strictObject({
      signatureSource: signatureSourceSchema,
      printedName: optionalText(180),
      receivingOfficeAndDateOfReceipt: optionalLongText,
    })
    .optional(),
  paymentOrder: z
    .strictObject({
      taxpayerTin: optionalTin,
      branchCode: z
        .string()
        .trim()
        .regex(/^\d{3,5}$/, "Branch code must contain 3 to 5 digits")
        .optional(),
      rdoCode: z
        .string()
        .trim()
        .regex(/^\d{3}$/, "RDO code must contain exactly three digits")
        .optional(),
      year: z.number().int().min(1900).max(2100).optional(),
      taxpayerName: optionalText(240),
      paymentDate: optionalDate,
      erorRorNumber: optionalText(80),
      amountForBirPrintedInvoices: optionalMoney,
      surcharge: optionalMoney,
      interest: optionalMoney,
      compromise: optionalMoney,
      totalPenalties: optionalMoney,
      totalAmountPayable: optionalMoney,
    })
    .optional(),
  documentaryRequirements: z
    .strictObject({
      selfEmployed: z
        .strictObject({
          governmentIssuedId: optionalBoolean,
          invoiceRequirement: optionalBoolean,
          birPrintedInvoice: optionalBoolean,
          ownInvoices: optionalBoolean,
          looseDocumentaryStampTax: optionalBoolean,
          representativeSpa: optionalBoolean,
          dtiCertificate: optionalBoolean,
          workVisa: optionalBoolean,
          serviceContract: optionalBoolean,
          franchiseDocuments: optionalBoolean,
          bmbeCertificateOfAuthority: optionalBoolean,
          investmentPromotionRegistrationPermit: optionalBoolean,
        })
        .optional(),
      estateAndTrust: z
        .strictObject({
          deathCertificate: optionalBoolean,
          irrevocableTrustAgreement: optionalBoolean,
          representativeSpa: optionalBoolean,
          administratorExecutorHeirProof: optionalBoolean,
        })
        .optional(),
      branchAndFacility: z
        .strictObject({
          branchAddressDocument: optionalBoolean,
          branchInvoiceRequirement: optionalBoolean,
          branchBirPrintedInvoice: optionalBoolean,
          branchOwnInvoices: optionalBoolean,
          facilityAddressDocument: optionalBoolean,
          looseDocumentaryStampTax: optionalBoolean,
          representativeSpa: optionalBoolean,
          dtiCertificate: optionalBoolean,
          franchiseDocuments: optionalBoolean,
          franchiseAgreement: optionalBoolean,
          bmbeCertificateOfAuthority: optionalBoolean,
          investmentPromotionRegistrationPermit: optionalBoolean,
        })
        .optional(),
    })
    .optional(),
  voluntaryPaymentDeclaration: z
    .strictObject({
      signatureSource: signatureSourceSchema,
      printedName: optionalText(180),
      titlePosition: optionalText(100),
      receivingOfficeStampAndDate: optionalLongText,
    })
    .optional(),
});

export const bir1901FormInputSchema = z.strictObject({
  type: z.literal("1901"),
  data: bir1901DataSchema,
});

/**
 * Add each future form as another member. The literal `type` narrows `data`
 * both at runtime (Zod) and compile time (TypeScript).
 */
export const generateBirFormInputSchema = z.discriminatedUnion("type", [bir1901FormInputSchema]);

export type Bir1901Data = z.infer<typeof bir1901DataSchema>;
export type Bir1901FormInput = z.infer<typeof bir1901FormInputSchema>;
export type GenerateBirFormInput = z.infer<typeof generateBirFormInputSchema>;
