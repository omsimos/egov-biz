import { z } from "zod";
import {
  bir1905DataSchema,
  bir1905FormInputSchema,
  type Bir1905Data,
  type Bir1905FormInput,
} from "@/lib/bir-form/schema-1905";

const optionalText = (description: string) => z.string().describe(description).optional();
const optionalDate = (description: string) =>
  optionalText(`${description} Use a recognizable date value; YYYY-MM-DD is preferred.`);
const optionalNumber = (description: string) => z.number().describe(description).optional();
const optionalBoolean = (description: string) => z.boolean().describe(description).optional();
const optionalChoice = <const Values extends readonly [string, ...string[]]>(
  values: Values,
  description: string,
) => z.enum(values).describe(description).optional();

const addressSchema = z
  .object({
    unitRoomFloorBuildingNo: optionalText("Unit, room, floor, or building number."),
    buildingNameTower: optionalText("Building name or tower."),
    lotBlockPhaseHouseNo: optionalText("Lot, block, phase, or house number."),
    streetName: optionalText("Street name."),
    subdivisionVillageZone: optionalText("Subdivision, village, or zone."),
    barangay: optionalText("Barangay."),
    townDistrict: optionalText("Town or district."),
    municipalityCity: optionalText("Municipality or city."),
    province: optionalText("Province."),
    zipCode: optionalText("Postal or ZIP code as it should appear on the form."),
  })
  .describe("Structured Philippine address fields printed in the corresponding address block.");

const contactSchema = z
  .object({
    preferredTypes: z
      .array(z.enum(["landline", "fax", "mobile"]))
      .describe("Contact methods whose checkboxes should be marked: landline, fax, or mobile.")
      .optional(),
    landline: optionalText("Landline telephone number."),
    fax: optionalText("Fax number."),
    mobile: optionalText("Mobile telephone number."),
    email: optionalText("Email address."),
  })
  .describe("Contact preferences and contact details.");

const personNameSchema = z
  .object({
    lastName: optionalText("Person's last name or surname."),
    firstName: optionalText("Person's first name."),
    middleName: optionalText("Person's middle name."),
    suffix: optionalText("Name suffix, such as Jr., Sr., II, or III."),
    nickname: optionalText("Nickname, when applicable."),
  })
  .describe("Individual name fields as separated on BIR Form 1901.");

const taxTypeRowSchema = z
  .object({
    selected: optionalBoolean("Whether the checkbox for this tax type should be marked."),
    formType: optionalText("BIR form type entered for this tax type."),
    atc: optionalText("Alphanumeric Tax Code (ATC) entered for this tax type."),
  })
  .describe("A tax-type row containing its checkbox, BIR form type, and ATC.");

const taxTypeWithDescriptionSchema = taxTypeRowSchema
  .extend({
    description: optionalText("Tax description entered in the specify field."),
  })
  .describe("A selectable tax-type row with a free-text description, form type, and ATC.");

const describedTaxTypeSchema = z
  .object({
    description: optionalText("Tax description entered in the specify field."),
    formType: optionalText("BIR form type entered for this tax."),
    atc: optionalText("Alphanumeric Tax Code (ATC) entered for this tax."),
  })
  .describe("A free-text tax row with its form type and ATC.");

const industrySchema = z
  .object({
    industry: optionalText("Industry name for this primary or secondary business activity."),
    tradeBusinessName: optionalText("Trade or business name for this activity."),
    regulatoryBody: optionalText("Government agency or regulatory body for this activity."),
    businessRegistrationNumber: optionalText("Business registration number for this activity."),
    businessRegistrationDate: optionalDate("Business registration date for this activity."),
    psicCode: optionalText("Philippine Standard Industrial Classification (PSIC) code."),
    lineOfBusiness: optionalText("Line of business or business activity."),
  })
  .describe("Primary or secondary industry and registration details.");

const invoiceDescriptionSchema = z
  .object({
    description: optionalText("Description of the invoice type."),
    type: optionalChoice(
      ["vat", "nonVat"],
      'Invoice classification. Use "vat" for VAT or "nonVat" for Non-VAT.',
    ),
    looseBoxesBooklets: optionalNumber("Number of loose boxes or booklets."),
    boundBoxesBooklets: optionalNumber("Number of bound boxes or booklets."),
    setsPerBoxBooklet: optionalNumber("Number of invoice sets per box or booklet."),
    serialNumberStart: optionalText("Starting invoice serial number."),
    serialNumberEnd: optionalText("Ending invoice serial number."),
    copiesPerSet: optionalNumber("Number of copies in each invoice set."),
  })
  .describe("One row in Item 42I, Description of Invoices.");

const employerSchema = z
  .object({
    name: optionalText("Employer's registered name."),
    primaryEmployer: optionalBoolean("Whether this employer is the taxpayer's primary employer."),
    tin: optionalText("Employer's Taxpayer Identification Number (TIN)."),
  })
  .describe("One employer listed under multiple employments.");

const signatureSourceSchema = optionalText(
  "Signature image source. Supply a PNG or JPEG data URL, or the image bytes encoded as base64.",
);

/**
 * Every writable white space, checkbox, and radio-like choice on the supplied
 * October 2025 (ENCS) BIR Form 1901. Values stay optional for draft generation.
 * Descriptions guide tool callers; validation intentionally stays permissive.
 */
export const bir1901DataSchema = z
  .object({
    registration: z
      .object({
        dln: optionalText("Document Locator Number (DLN), to be filled out by BIR when known."),
        tinToBeIssued: optionalText("TIN to be issued, when applicable and known."),
        registeringOffice: optionalChoice(
          ["headOffice", "branchOffice", "facility"],
          'Item 1 registering office. Use "headOffice", "branchOffice", or "facility".',
        ),
        birRegistrationDate: optionalDate("Item 2 BIR registration date."),
        philsysCardNumber: optionalText("Item 3 PhilSys Card Number (PCN)."),
      })
      .describe("Top-of-form BIR registration fields, including Items 1 to 3.")
      .optional(),
    taxpayerInformation: z
      .object({
        tin: optionalText("Item 4 existing Taxpayer Identification Number (TIN)."),
        rdoCode: optionalText("Item 5 Revenue District Office (RDO) code."),
        taxpayerType: optionalChoice(
          [
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
          ],
          "Item 6 taxpayer type. Select the value matching the checkbox label on Form 1901.",
        ),
        taxpayerName: personNameSchema
          .describe("Item 7 taxpayer name, split into the form's individual name fields.")
          .optional(),
        estateOrTrustName: optionalText(
          "Item 7 estate or trust name following the naming instruction printed on the form.",
        ),
        gender: optionalChoice(["male", "female"], "Item 8 gender checkbox."),
        civilStatus: optionalChoice(
          ["single", "married", "widowed", "legallySeparated"],
          "Item 9 civil status checkbox.",
        ),
        birthOrOrganizationDate: optionalDate(
          "Item 10 date of birth or date of organization for an estate or trust.",
        ),
        placeOfBirth: optionalText("Item 11 place of birth."),
        motherMaidenName: optionalText("Item 12 mother's maiden name."),
        fatherName: optionalText("Item 13 father's name."),
        citizenship: optionalText("Item 14 citizenship."),
        otherCitizenship: optionalText("Item 15 other citizenship, when applicable."),
        localResidenceAddress: addressSchema
          .describe("Item 16 local residence address.")
          .optional(),
        businessAddress: addressSchema.describe("Item 17 business address.").optional(),
        foreignAddress: optionalText("Item 18 foreign address, when applicable."),
        municipalityCode: optionalText("Item 19 municipality code, when known."),
        purposeOfTinApplication: optionalText("Item 20 purpose of TIN application."),
        identification: z
          .object({
            type: optionalText("Item 21 identification document type."),
            idNumber: optionalText("Item 21 identification document number."),
            effectivityDate: optionalDate("Item 21 identification document effectivity date."),
            expiryDate: optionalDate("Item 21 identification document expiry date."),
            issuer: optionalText("Item 21 identification document issuer."),
            placeCountryOfIssue: optionalText(
              "Item 21 place or country where the identification document was issued.",
            ),
          })
          .describe("Item 21 government-issued identification details.")
          .optional(),
        contact: contactSchema.describe("Item 22 preferred contact type and details.").optional(),
        eightPercentIncomeTaxRate: optionalChoice(
          ["yes", "no"],
          "Item 23 election to use the 8% income tax rate option.",
        ),
      })
      .describe("Part I taxpayer information, Items 4 to 23.")
      .optional(),
    taxpayerClassification: z
      .object({
        expectedAnnualGrossSales: optionalChoice(
          ["micro", "small", "medium", "large"],
          "Item 24 expected annual gross-sales classification using the form's four checkboxes.",
        ),
      })
      .describe("Part II taxpayer classification.")
      .optional(),
    spouseInformation: z
      .object({
        employmentStatus: optionalChoice(
          ["unemployed", "employedLocally", "employedAbroad", "businessOrProfession"],
          "Item 25 spouse employment status checkbox.",
        ),
        name: optionalText("Item 26 spouse name in the order requested by the form."),
        tin: optionalText("Item 27 spouse TIN."),
        employerName: optionalText("Item 28 spouse employer's registered name."),
        employerTin: optionalText("Item 29 spouse employer's TIN."),
      })
      .describe("Part III spouse information, Items 25 to 29.")
      .optional(),
    authorizedRepresentative: z
      .object({
        individualName: personNameSchema
          .describe("Item 30 individual authorized representative's name.")
          .optional(),
        nonIndividualRegisteredName: optionalText(
          "Item 30 registered name when the authorized representative is not an individual.",
        ),
        relationshipDate: optionalDate("Item 31 date the representative relationship started."),
        addressType: optionalChoice(
          ["residence", "placeOfBusiness", "employerAddress"],
          "Item 32 representative address type checkbox.",
        ),
        address: addressSchema.describe("Item 33 authorized representative address.").optional(),
        contact: contactSchema
          .describe("Item 34 authorized representative preferred contact type and details.")
          .optional(),
      })
      .describe("Part IV authorized representative information, Items 30 to 34.")
      .optional(),
    businessInformation: z
      .object({
        singleBusinessNumber: optionalText(
          "Item 35 Single Business Number or Philippine Business Number.",
        ),
        primaryIndustry: industrySchema.describe("Item 36 primary industry details.").optional(),
        secondaryIndustry: industrySchema
          .describe("Item 36 secondary industry details.")
          .optional(),
        incentives: z
          .object({
            investmentPromotion: optionalText("Item 37A investment promotion agency or program."),
            legalBasis: optionalText("Item 37B legal basis for the incentive."),
            incentiveGranted: optionalText("Item 37C incentive granted."),
            numberOfYears: optionalNumber("Item 37D number of incentive years."),
            startDate: optionalDate("Item 37E incentive start date."),
            endDate: optionalDate("Item 37F incentive end date."),
          })
          .describe("Item 37 incentives details.")
          .optional(),
        registrationAccreditation: z
          .object({
            number: optionalText("Item 38A registration or accreditation number."),
            effectivityDateFrom: optionalDate("Item 38B effectivity start date."),
            effectivityDateTo: optionalDate("Item 38B effectivity end date."),
            dateIssued: optionalDate("Item 38C date issued."),
            registeredActivity: optionalText("Item 38D registered activity."),
            taxRegime: optionalChoice(
              ["regular", "special", "exempt"],
              "Item 38E tax regime: regular, special, or exempt.",
            ),
            activityStartDate: optionalDate("Item 38F registered activity start date."),
            activityEndDate: optionalDate("Item 38G registered activity end date."),
          })
          .describe("Item 38 registration or accreditation details.")
          .optional(),
      })
      .describe("Part V business information, Items 35 to 38.")
      .optional(),
    facilityDetails: z
      .object({
        facilityCode: optionalText("Item 39A facility code, when assigned by BIR."),
        facilityType: optionalChoice(
          [
            "placeOfProduction",
            "storagePlace",
            "warehouse",
            "showroom",
            "garage",
            "busTerminal",
            "realPropertyForLease",
            "other",
          ],
          "Item 39B facility type matching PP, SP, WH, SR, GG, BT, RP, or Others.",
        ),
        otherFacilityType: optionalText(
          "Item 39B facility type description when Others is selected.",
        ),
        address: addressSchema.describe("Item 39C facility address.").optional(),
      })
      .describe("Part VI facility details, Item 39.")
      .optional(),
    taxTypes: z
      .object({
        incomeTax: z
          .object({
            individualIncomeTax: taxTypeRowSchema.describe("Individual Income Tax row.").optional(),
            capitalGainsRealProperty: taxTypeRowSchema
              .describe("Capital Gains Tax - Real Property row.")
              .optional(),
            capitalGainsStocks: taxTypeRowSchema
              .describe("Capital Gains Tax - Stocks row.")
              .optional(),
          })
          .describe("Income Tax rows in Item 40.")
          .optional(),
        withholdingTax: z
          .object({
            compensation: taxTypeRowSchema.describe("Compensation withholding row.").optional(),
            expanded: taxTypeRowSchema.describe("Expanded withholding row.").optional(),
            final: taxTypeRowSchema.describe("Final withholding row.").optional(),
            fringeBenefits: taxTypeRowSchema
              .describe("Fringe Benefits withholding row.")
              .optional(),
            valueAddedTax: taxTypeRowSchema.describe("Value-Added Tax withholding row.").optional(),
            otherPercentageTax: taxTypeRowSchema
              .describe("Other Percentage Tax withholding row.")
              .optional(),
            onettNotSubjectToCgt: taxTypeRowSchema
              .describe("ONETT not subject to Capital Gains Tax withholding row.")
              .optional(),
            winningsAndPrizes: taxTypeRowSchema
              .describe("Percentage Tax on Winnings and Prizes withholding row.")
              .optional(),
            interestOnDepositsAndYield: taxTypeRowSchema
              .describe(
                "Interest on Deposits and Yield on Deposits or Substitutes withholding row.",
              )
              .optional(),
          })
          .describe("Withholding Tax rows in Item 40.")
          .optional(),
        percentageTax: z
          .object({
            stocks: taxTypeRowSchema.describe("Percentage Tax - Stocks row.").optional(),
            stocksInitialPublicOffering: taxTypeRowSchema
              .describe("Percentage Tax - Stocks Initial Public Offering row.")
              .optional(),
            overseasDispatchAndAmusement: taxTypeRowSchema
              .describe("Percentage Tax - Overseas Dispatch and Amusement Taxes row.")
              .optional(),
            underSpecialLaws: taxTypeRowSchema
              .describe("Percentage Tax under Special Laws row.")
              .optional(),
            otherPercentageTaxesUnderNirc: taxTypeWithDescriptionSchema
              .describe("Other Percentage Taxes under the NIRC row and specify field.")
              .optional(),
          })
          .describe("Percentage Tax rows in Item 40.")
          .optional(),
        valueAddedTax: taxTypeRowSchema.describe("Value-Added Tax row in Item 40.").optional(),
        exciseTax: z
          .object({
            alcoholProducts: taxTypeRowSchema
              .describe("Excise Tax - Alcohol Products row.")
              .optional(),
            automobileAndNonEssentialGoods: taxTypeRowSchema
              .describe("Excise Tax - Automobile and Non-Essential Goods row.")
              .optional(),
            cosmeticProcedures: taxTypeRowSchema
              .describe("Excise Tax - Cosmetic Procedures row.")
              .optional(),
            mineralProducts: taxTypeRowSchema
              .describe("Excise Tax - Mineral Products row.")
              .optional(),
            petroleumProducts: taxTypeRowSchema
              .describe("Excise Tax - Petroleum Products row.")
              .optional(),
            sweetenedBeverages: taxTypeRowSchema
              .describe("Excise Tax - Sweetened Beverages row.")
              .optional(),
            tobaccoProducts: taxTypeRowSchema
              .describe("Excise Tax - Tobacco Products row.")
              .optional(),
            tobaccoInspectionMonitoringFees: taxTypeRowSchema
              .describe("Tobacco Inspection and Monitoring Fees row.")
              .optional(),
            vaporProducts: taxTypeRowSchema.describe("Excise Tax - Vapor Products row.").optional(),
          })
          .describe("Excise Tax rows in Item 40.")
          .optional(),
        documentaryStampTax: z
          .object({
            regular: taxTypeRowSchema.describe("Documentary Stamp Tax - Regular row.").optional(),
            onett: taxTypeRowSchema
              .describe("Documentary Stamp Tax - One-Time Transactions (ONETT) row.")
              .optional(),
          })
          .describe("Documentary Stamp Tax rows in Item 40.")
          .optional(),
        transferTax: z
          .object({
            donorsTax: taxTypeRowSchema.describe("Donor's Tax row.").optional(),
            estateTax: taxTypeRowSchema.describe("Estate Tax row.").optional(),
          })
          .describe("Transfer Tax rows in Item 40.")
          .optional(),
        miscellaneousTax: describedTaxTypeSchema
          .describe("Miscellaneous Tax specify row, form type, and ATC.")
          .optional(),
        others: describedTaxTypeSchema
          .describe("Other Tax specify row, form type, and ATC.")
          .optional(),
      })
      .describe("Part VII Item 40 tax liabilities, form types, and ATCs.")
      .optional(),
    invoices: z
      .object({
        birPrintedInvoices: z
          .object({
            intendsToUse: optionalChoice(
              ["yes", "no"],
              "Item 41A whether the taxpayer intends to use BIR Printed Invoices.",
            ),
            type: optionalChoice(["vat", "nonVat"], "Item 41B invoice type: VAT or Non-VAT."),
            numberOfBooklets: optionalNumber("Item 41C number of invoice booklets."),
            serialNumberStart: optionalText("Item 41D starting invoice serial number."),
            serialNumberEnd: optionalText("Item 41D ending invoice serial number."),
          })
          .describe("Item 41 BIR Printed Invoice choices and details.")
          .optional(),
        authorityToPrint: z
          .object({
            printerName: optionalText("Item 42A accredited printer's registered name."),
            printerTin: optionalText("Item 42B printer's TIN."),
            printerAccreditationNumber: optionalText("Item 42C printer's accreditation number."),
            accreditationDate: optionalDate("Item 42D printer accreditation date."),
            registeredAddress: addressSchema
              .describe("Item 42E printer's registered address.")
              .optional(),
            contactNumber: optionalText("Item 42F printer contact number."),
            email: optionalText("Item 42G printer email address."),
            manner: optionalChoice(
              ["bound", "looseLeaf"],
              "Item 42H manner of invoices: bound or loose leaf.",
            ),
            descriptions: z
              .array(invoiceDescriptionSchema)
              .describe("Item 42I invoice-description rows in their printed order.")
              .optional(),
          })
          .describe("Item 42 Authority to Print Invoices details.")
          .optional(),
      })
      .describe("Part VIII invoice details, Items 41 and 42.")
      .optional(),
    multipleEmployments: z
      .object({
        type: optionalChoice(
          ["successive", "concurrent"],
          "Item 43 type of multiple employments: successive or concurrent.",
        ),
        employers: z
          .array(employerSchema)
          .describe("Items 43A to 43D employers in the order shown on the form.")
          .optional(),
        primaryCurrentEmployer: z
          .object({
            relationshipStartDate: optionalDate(
              "Item 44 relationship start date with the primary or current employer.",
            ),
            contact: contactSchema
              .describe("Item 45 primary or current employer contact details.")
              .optional(),
          })
          .describe("Primary or current employer information, Items 44 and 45.")
          .optional(),
      })
      .describe("Part IX multiple-employment information, Items 43 to 45.")
      .optional(),
    declaration: z
      .object({
        signatureSource: signatureSourceSchema.describe(
          "Item 46 taxpayer or authorized representative signature image source.",
        ),
        printedName: optionalText(
          "Item 46 printed name of the taxpayer or authorized representative.",
        ),
        receivingOfficeAndDateOfReceipt: optionalText(
          "Item 46 receiving office and date of receipt.",
        ),
      })
      .describe("Item 46 declaration and receiving-office fields.")
      .optional(),
    paymentOrder: z
      .object({
        taxpayerTin: optionalText("Item 47 taxpayer TIN on BIR Form 0605."),
        branchCode: optionalText("Item 47 branch code on BIR Form 0605."),
        rdoCode: optionalText("Item 48 RDO code on BIR Form 0605."),
        year: optionalNumber("Item 49 applicable year on BIR Form 0605."),
        taxpayerName: optionalText("Item 50 taxpayer name on BIR Form 0605."),
        paymentDate: optionalDate("Item 51 date of payment."),
        erorRorNumber: optionalText("Item 52 eROR or ROR number."),
        amountForBirPrintedInvoices: optionalNumber(
          "Item 52A amount payable for BIR Printed Invoices.",
        ),
        surcharge: optionalNumber("Item 53A surcharge amount."),
        interest: optionalNumber("Item 53B interest amount."),
        compromise: optionalNumber("Item 53C compromise amount."),
        totalPenalties: optionalNumber("Item 53D total penalties."),
        totalAmountPayable: optionalNumber("Item 54A total amount payable."),
      })
      .describe("Part X BIR Form 0605 payment-order fields, Items 47 to 54.")
      .optional(),
    documentaryRequirements: z
      .object({
        selfEmployed: z
          .object({
            governmentIssuedId: optionalBoolean(
              "Mark the self-employed government-issued ID requirement.",
            ),
            invoiceRequirement: optionalBoolean(
              "Mark the self-employed invoice requirement group.",
            ),
            birPrintedInvoice: optionalBoolean(
              "Mark BIR Printed Invoice under the self-employed invoice requirement.",
            ),
            ownInvoices: optionalBoolean(
              "Mark final clear sample of own invoices under the self-employed requirement.",
            ),
            looseDocumentaryStampTax: optionalBoolean(
              "Mark the self-employed loose Documentary Stamp Tax requirement.",
            ),
            representativeSpa: optionalBoolean(
              "Mark the self-employed representative Special Power of Attorney requirement.",
            ),
            dtiCertificate: optionalBoolean("Mark the self-employed DTI Certificate requirement."),
            workVisa: optionalBoolean("Mark the Work Visa requirement for a foreign national."),
            serviceContract: optionalBoolean(
              "Mark the Service Contract or equivalent income-document requirement.",
            ),
            franchiseDocuments: optionalBoolean(
              "Mark the self-employed franchise-document requirement.",
            ),
            bmbeCertificateOfAuthority: optionalBoolean(
              "Mark the Barangay Micro Business Enterprise Certificate of Authority requirement.",
            ),
            investmentPromotionRegistrationPermit: optionalBoolean(
              "Mark the investment-promotion registration or permit requirement.",
            ),
          })
          .describe("Documentary-requirement checkboxes for self-employed individuals.")
          .optional(),
        estateAndTrust: z
          .object({
            deathCertificate: optionalBoolean(
              "Mark the death-certificate requirement for an estate.",
            ),
            irrevocableTrustAgreement: optionalBoolean(
              "Mark the irrevocable-trust-agreement requirement.",
            ),
            representativeSpa: optionalBoolean(
              "Mark the estate or trust representative SPA requirement.",
            ),
            administratorExecutorHeirProof: optionalBoolean(
              "Mark proof of administrator, executor, or heir authority.",
            ),
          })
          .describe("Documentary-requirement checkboxes for estates and trusts.")
          .optional(),
        branchAndFacility: z
          .object({
            branchAddressDocument: optionalBoolean(
              "Mark the document proving the branch's full business address.",
            ),
            branchInvoiceRequirement: optionalBoolean("Mark the branch invoice requirement group."),
            branchBirPrintedInvoice: optionalBoolean(
              "Mark BIR Printed Invoice under the branch requirement.",
            ),
            branchOwnInvoices: optionalBoolean(
              "Mark final clear sample of own invoices under the branch requirement.",
            ),
            facilityAddressDocument: optionalBoolean(
              "Mark the document proving the facility's full address.",
            ),
            looseDocumentaryStampTax: optionalBoolean(
              "Mark the branch or facility loose Documentary Stamp Tax requirement.",
            ),
            representativeSpa: optionalBoolean(
              "Mark the branch or facility representative SPA requirement.",
            ),
            dtiCertificate: optionalBoolean("Mark the branch-only DTI Certificate requirement."),
            franchiseDocuments: optionalBoolean(
              "Mark the branch-only franchise-document requirement.",
            ),
            franchiseAgreement: optionalBoolean(
              "Mark the branch-only franchise-agreement requirement.",
            ),
            bmbeCertificateOfAuthority: optionalBoolean(
              "Mark the branch-only BMBE Certificate of Authority requirement.",
            ),
            investmentPromotionRegistrationPermit: optionalBoolean(
              "Mark the branch-only investment-promotion registration or permit requirement.",
            ),
          })
          .describe("Documentary-requirement checkboxes for branches and facilities.")
          .optional(),
      })
      .describe("Page 4 documentary-requirement checkboxes.")
      .optional(),
    voluntaryPaymentDeclaration: z
      .object({
        signatureSource: signatureSourceSchema.describe(
          "Voluntary-payment taxpayer or authorized representative signature image source.",
        ),
        printedName: optionalText(
          "Printed name of the taxpayer or authorized representative for voluntary payment.",
        ),
        titlePosition: optionalText("Title or position of the voluntary-payment signatory."),
        receivingOfficeStampAndDate: optionalText(
          "BIR receiving-office stamp and date of receipt for voluntary payment.",
        ),
      })
      .describe("Page 4 voluntary-payment declaration and receiving-office fields.")
      .optional(),
  })
  .describe(
    "Optional values for every writable field, checkbox, and choice on the October 2025 BIR Form 1901.",
  );

export const bir1901FormInputSchema = z
  .object({
    type: z.literal("1901").describe('BIR form discriminator. Use "1901".'),
    data: bir1901DataSchema.describe(
      "Form-specific values for BIR Form 1901. Every field is optional.",
    ),
  })
  .describe("Input for generating BIR Form 1901.");

/**
 * Add each future form as another member. The literal `type` narrows `data`
 * both at runtime (Zod) and compile time (TypeScript).
 */
export const generateBirFormInputSchema = z
  .discriminatedUnion("type", [bir1901FormInputSchema, bir1905FormInputSchema])
  .describe("Generate-BIR-form input selected by its form type discriminator.");

export type Bir1901Data = z.infer<typeof bir1901DataSchema>;
export type Bir1901FormInput = z.infer<typeof bir1901FormInputSchema>;
export type GenerateBirFormInput = z.infer<typeof generateBirFormInputSchema>;
export { bir1905DataSchema, bir1905FormInputSchema };
export type { Bir1905Data, Bir1905FormInput };
