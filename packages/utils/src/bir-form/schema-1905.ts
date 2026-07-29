import { z } from "zod";

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
  .describe("Structured address fields printed in the Form 1905 address block.");

const facilityRowSchema = z
  .object({
    facilityCode: optionalText("BIR facility code, when assigned."),
    facilityTypes: z
      .array(
        z.enum([
          "placeOfProduction",
          "storagePlace",
          "warehouse",
          "showroom",
          "garage",
          "busTerminal",
          "realPropertyForLease",
          "other",
        ]),
      )
      .describe(
        "Facility-type checkboxes to mark: place of production, storage place, warehouse, showroom, garage, bus terminal, real property for lease, or other.",
      )
      .optional(),
    otherFacilityType: optionalText("Facility type description when Other is marked."),
  })
  .describe("One Item 7E facility row.");

const taxTypeChangeRowSchema = z
  .object({
    taxType: optionalText("Tax type being cancelled, re-registered, or added."),
    formType: optionalText("BIR form type for the tax type; this column may be completed by BIR."),
    atc: optionalText("Alphanumeric Tax Code (ATC); this column may be completed by BIR."),
    effectivityDate: optionalDate("Effectivity date of the tax-type change."),
  })
  .describe("One cancelled, re-registered, added, or new tax-type row in Item 7G.");

const suspendedTaxTypeRowSchema = z
  .object({
    taxType: optionalText("Tax type being suspended."),
    formType: optionalText("BIR form type for the suspended tax type."),
    atc: optionalText("Alphanumeric Tax Code (ATC) for the suspended tax type."),
    effectivityDateFrom: optionalDate("Required suspension start date."),
    effectivityDateTo: optionalDate("Required suspension end date."),
  })
  .describe("One suspended tax-type row in Item 7G.");

const relatedPartySchema = z
  .object({
    registeredName: optionalText(
      "Individual name in Last Name, First Name, Middle Name, Suffix order, or non-individual registered name.",
    ),
    tin: optionalText(
      "TIN of the incorporator, officer, partner, affiliate, subsidiary, related party, or member.",
    ),
  })
  .describe("One related-party row in Item 7J.");

const bookSchema = z
  .object({
    type: optionalChoice(
      ["manual", "looseLeaf", "computerized"],
      "Book type: manual, loose-leaf, or computerized books of accounts.",
    ),
    booksToBeRegistered: optionalText("Name or description of the books to be registered."),
    quantity: optionalNumber("Quantity of books being registered."),
    volumeFrom: optionalText("Starting volume number."),
    volumeTo: optionalText("Ending volume number."),
  })
  .describe("One Books of Accounts registration or update row in Item 10.");

const registeredBookSchema = z
  .object({
    dateRegistered: optionalDate("Date the book or permit was registered."),
    permitNumber: optionalText("Permit number for the registered books."),
    dateIssued: optionalDate("Date the books permit was issued."),
  })
  .describe("One continuation row for Item 10.");

const signatureSourceSchema = optionalText(
  "Signature image source. Supply a PNG or JPEG data URL, or the image bytes encoded as base64.",
);

/**
 * Every writable white space, checkbox, and choice on the supplied October
 * 2025 (ENCS) BIR Form 1905. All values remain optional for draft generation.
 */
export const bir1905DataSchema = z
  .object({
    taxpayerInformation: z
      .object({
        dln: optionalText("Document Locator Number (DLN), to be filled out by BIR when known."),
        tin: optionalText("Item 1 Taxpayer Identification Number (TIN)."),
        rdoCode: optionalText("Item 2 Revenue District Office (RDO) code."),
        contactNumber: optionalText("Item 3 landline or mobile contact number."),
        registeredName: optionalText(
          "Item 4 registered name. For an individual, use Last Name, First Name, Middle Name, Suffix order.",
        ),
      })
      .describe("Part I taxpayer information, Items 1 to 4.")
      .optional(),
    replacementOrCancellation: z
      .object({
        forms: z
          .object({
            certificateOfRegistration: optionalBoolean(
              "Mark Item 5A Certificate of Registration (COR).",
            ),
            authorityToPrint: optionalBoolean(
              "Mark Item 5B Authority to Print (ATP) Receipts or Invoices.",
            ),
            taxClearanceCertificate: optionalBoolean(
              "Mark Item 5C Tax Clearance Certificate of Liabilities (TCL1).",
            ),
            tinCard: optionalBoolean("Mark Item 5D Taxpayer Identification Number (TIN) Card."),
            other: optionalBoolean("Mark Item 5E Other form."),
            otherDescription: optionalText("Item 5E description of the other form."),
          })
          .describe("Item 5 forms being replaced or cancelled.")
          .optional(),
        reasons: z
          .object({
            lostOrDamaged: optionalBoolean("Mark the Lost or Damaged reason."),
            changeOfAccreditedPrinter: optionalBoolean(
              "Mark Change of Accredited Printer as Requested by the Taxpayer.",
            ),
            registrationInformationCorrection: optionalBoolean(
              "Mark Correction, Change, or Update of Registration Information.",
            ),
            other: optionalBoolean("Mark the Other reason."),
            otherDescription: optionalText("Description of the other replacement reason."),
          })
          .describe("Item 5 replacement or cancellation reasons.")
          .optional(),
      })
      .describe("Item 5 replacement or cancellation selections and details.")
      .optional(),
    otherUpdates: z
      .object({
        closureOfBusiness: optionalBoolean("Mark Item 6 Closure of Business."),
        changeOfCivilStatus: optionalBoolean("Mark Item 6 Change of Civil Status."),
        registerOrUpdateBooks: optionalBoolean("Mark Item 6 Register or Update Books of Accounts."),
        availEightPercentIncomeTaxRate: optionalBoolean(
          "Mark Item 6 Avail of 8% Income Tax Rate Option.",
        ),
        other: optionalBoolean("Mark Item 6 Other update."),
        otherDescription: optionalText("Description of the other Item 6 update."),
      })
      .describe("Item 6 other update checkboxes.")
      .optional(),
    registrationInformationUpdate: z
      .object({
        registeredOrTradeName: z
          .object({
            selected: optionalBoolean("Mark Item 7A Update Registered Name or Trade Name."),
            changeRegisteredName: optionalBoolean("Mark Change in Registered Name."),
            changeTradeName: optionalBoolean("Mark Change in Trade Name."),
            additionalTradeName: optionalBoolean("Mark Additional Trade Name."),
            oldName: optionalText("Old registered or trade name."),
            newName: optionalText("New or additional registered or trade name."),
          })
          .describe("Item 7A registered-name and trade-name update.")
          .optional(),
        registeredAddress: z
          .object({
            selected: optionalBoolean("Mark Item 7B Change in Registered Address."),
            transferWithinSameRdo: optionalBoolean("Mark Transfer within the Same RDO."),
            transferToAnotherRdo: optionalBoolean("Mark Transfer to Another RDO."),
            oldRdoCode: optionalText("Old RDO code in the From box."),
            newRdoCode: optionalText("New RDO code in the To box."),
            newAddress: addressSchema.describe("New registered address.").optional(),
          })
          .describe("Item 7B registered-address change.")
          .optional(),
        accountingPeriod: z
          .object({
            selected: optionalBoolean("Mark Item 7C Change in Accounting Period."),
            calendarToFiscal: z
              .object({
                selected: optionalBoolean("Mark From Calendar to Fiscal Period."),
                accountingStartMonth: optionalText(
                  "Accounting start month for the Calendar-to-Fiscal change.",
                ),
                effectivityDate: optionalDate(
                  "Effectivity date for the Calendar-to-Fiscal change.",
                ),
              })
              .describe("Calendar-to-Fiscal accounting-period change.")
              .optional(),
            fiscalToAnotherFiscal: z
              .object({
                selected: optionalBoolean("Mark From One Fiscal Period to Another Fiscal Period."),
                accountingStartMonth: optionalText(
                  "Accounting start month for the Fiscal-to-Another-Fiscal change.",
                ),
                effectivityDate: optionalDate(
                  "Effectivity date for the Fiscal-to-Another-Fiscal change.",
                ),
              })
              .describe("Fiscal-to-Another-Fiscal accounting-period change.")
              .optional(),
            fiscalToCalendar: z
              .object({
                selected: optionalBoolean("Mark From Fiscal to Calendar Period."),
                accountingStartMonth: optionalText(
                  "Accounting start month for the Fiscal-to-Calendar change.",
                ),
                effectivityDate: optionalDate(
                  "Effectivity date for the Fiscal-to-Calendar change.",
                ),
              })
              .describe("Fiscal-to-Calendar accounting-period change.")
              .optional(),
          })
          .describe("Item 7C accounting-period changes.")
          .optional(),
        registeredActivity: z
          .object({
            selected: optionalBoolean(
              "Mark Item 7D Change or Add Registered Activity or Line of Business.",
            ),
            newActivityOrLineOfBusiness: optionalText(
              "New registered activity or line of business.",
            ),
            effectivityDate: optionalDate("Effectivity date of the activity change."),
          })
          .describe("Item 7D registered-activity change.")
          .optional(),
        facilityDetails: z
          .object({
            selected: optionalBoolean("Mark Item 7E Change Facility Type or Details."),
            facilities: z
              .array(facilityRowSchema)
              .describe("Facility rows in printed order; attach additional sheets when needed.")
              .optional(),
          })
          .describe("Item 7E facility changes.")
          .optional(),
        incentiveDetails: z
          .object({
            selected: optionalBoolean("Mark Item 7F Change or Add Incentive Details."),
            investmentPromotionAgency: optionalText("Investment Promotion Agency."),
            numberOfYears: optionalNumber("Number of incentive years."),
            legalBasis: optionalText("Legal basis for the incentive."),
            startDate: optionalDate("Incentive start date."),
            incentivesGranted: optionalText("Incentives granted."),
            endDate: optionalDate("Incentive end date."),
            registrationAccreditationNumber: optionalText("Registration or accreditation number."),
            registeredActivity: optionalText("Registered activity covered by the incentive."),
            effectivityDateFrom: optionalDate("Incentive effectivity start date."),
            effectivityDateTo: optionalDate("Incentive effectivity end date."),
            taxRegime: optionalText("Tax regime for the registered activity."),
            dateIssued: optionalDate("Date the incentive registration was issued."),
            activityStartDate: optionalDate("Registered activity start date."),
            activityEndDate: optionalDate("Registered activity end date."),
          })
          .describe("Item 7F incentive details and registration.")
          .optional(),
        taxTypeDetails: z
          .object({
            selected: optionalBoolean(
              "Mark Item 7G Change or Add Tax Type, Suspend Tax Type, or Re-register Tax Type.",
            ),
            cancelled: z
              .array(taxTypeChangeRowSchema)
              .describe(
                "Cancelled tax-type rows in printed order; rows beyond the printed capacity are included on a continuation page.",
              )
              .optional(),
            reRegisteredOrAdded: z
              .array(taxTypeChangeRowSchema)
              .describe(
                "Re-registered, added, or new tax-type rows in printed order; rows beyond the printed capacity are included on a continuation page.",
              )
              .optional(),
            suspended: z
              .array(suspendedTaxTypeRowSchema)
              .describe(
                "Suspended tax-type rows in printed order; rows beyond the printed capacity are included on a continuation page.",
              )
              .optional(),
          })
          .describe("Item 7G tax-type changes.")
          .optional(),
        contactType: z
          .object({
            selected: optionalBoolean("Mark Item 7H Change or Update of Contact Type."),
            contactTypes: z
              .array(z.enum(["landline", "mobile", "fax"]))
              .describe("Contact-type checkboxes to mark: landline, mobile, or fax.")
              .optional(),
            contactNumber: optionalText("Updated landline, mobile, or fax number."),
            email: optionalText("Required updated email address."),
          })
          .describe("Item 7H contact-type update.")
          .optional(),
        contactPerson: z
          .object({
            selected: optionalBoolean(
              "Mark Item 7I Change or Update of Contact Person or Authorized Representative.",
            ),
            registeredName: optionalText(
              "Contact person or representative name in Last Name, First Name, Middle Name, Suffix order.",
            ),
            position: optionalText("Position of the contact person or representative."),
            tin: optionalText("TIN of the contact person or representative."),
          })
          .describe("Item 7I contact-person or authorized-representative update.")
          .optional(),
        relatedParties: z
          .object({
            selected: optionalBoolean(
              "Mark Item 7J Change or Update of Incorporators, Officers, Partners, Affiliates, Subsidiaries, Related Parties, or Members.",
            ),
            parties: z
              .array(relatedPartySchema)
              .describe(
                "Related-party rows in printed order; attach additional sheets when needed.",
              )
              .optional(),
          })
          .describe("Item 7J related-party updates.")
          .optional(),
      })
      .describe("Item 7 correction, change, or update of registration information.")
      .optional(),
    closureOrCancellation: z
      .object({
        cancellationOfTin: z
          .object({
            selected: optionalBoolean("Mark Item 8A Cancellation of TIN."),
            death: optionalBoolean("Mark Death as the cancellation reason."),
            multipleOrIdenticalTin: optionalBoolean(
              "Mark Multiple or Identical TIN as the cancellation reason.",
            ),
            permanentClosureOfBranch: optionalBoolean("Mark Permanent Closure of a Branch."),
            permanentClosureOfNonIndividualOperations: optionalBoolean(
              "Mark Permanent Closure of Business Operations for a non-individual.",
            ),
            other: optionalBoolean("Mark Other cancellation reason."),
            otherDescription: optionalText("Description of the other cancellation reason."),
            effectivityDate: optionalDate("Effectivity date of TIN cancellation."),
          })
          .describe("Item 8A TIN cancellation.")
          .optional(),
        cessationOfBusiness: z
          .object({
            selected: optionalBoolean(
              "Mark Item 8B De-register or Cessation of Registration of Business.",
            ),
            permanentClosureOfIndividualHeadOffice: optionalBoolean(
              "Mark Permanent Closure of an Individual's Head Office.",
            ),
            other: optionalBoolean("Mark Other cessation reason."),
            otherDescription: optionalText("Description of the other cessation reason."),
            tradeBusinessName: optionalText("Trade or business name being closed."),
            effectivityDate: optionalDate("Effectivity date of cessation."),
          })
          .describe("Item 8B business cessation.")
          .optional(),
      })
      .describe("Item 8 closure of business or cancellation of registration.")
      .optional(),
    civilStatusChange: z
      .object({
        changeType: optionalChoice(
          ["singleToMarried", "marriedToSingle"],
          "Item 9 civil-status change: Single to Married or Married to Single.",
        ),
        oldOrMaidenName: optionalText("Item 9A old name or maiden name."),
        newOrMarriedName: optionalText("Item 9B new name or married name."),
        spouse: z
          .object({
            employmentStatus: optionalChoice(
              ["unemployed", "employedLocally", "employedAbroad", "businessOrProfession"],
              "Item 9C spouse employment status.",
            ),
            name: optionalText("Spouse name in Last Name, First Name, Middle Name, Suffix order."),
            tin: optionalText("Spouse TIN."),
            employerName: optionalText("Spouse employer's registered name."),
            employerTin: optionalText("Spouse employer's TIN."),
          })
          .describe("Item 9C spouse information.")
          .optional(),
      })
      .describe("Item 9 change of civil status.")
      .optional(),
    booksOfAccounts: z
      .object({
        books: z
          .array(bookSchema)
          .describe(
            "Item 10 books to register or update in printed order; additional rows are included on a continuation page.",
          )
          .optional(),
        registrations: z
          .array(registeredBookSchema)
          .describe(
            "Item 10 registered-book continuation rows in printed order; additional rows are included on a generated continuation page.",
          )
          .optional(),
      })
      .describe("Item 10 Books of Accounts registration or update.")
      .optional(),
    otherUpdateOrCorrection: z
      .object({
        details: optionalText("Item 11 other update or correction details."),
        effectivityDate: optionalDate("Item 11 effectivity date of change."),
      })
      .describe("Item 11 other update or correction.")
      .optional(),
    declaration: z
      .object({
        signatureSource: signatureSourceSchema.describe(
          "Item 12 taxpayer, authorized representative, or tax agent signature image source.",
        ),
        printedName: optionalText(
          "Item 12 printed name of the taxpayer, representative, or tax agent.",
        ),
        titlePosition: optionalText("Item 12 title or position of the signatory."),
        receivingOfficeStampAndDate: optionalText(
          "BIR receiving-office stamp and date of receipt.",
        ),
      })
      .describe("Item 12 declaration and receiving-office fields.")
      .optional(),
    documentaryRequirements: z
      .object({
        tinCardIssuance: z
          .object({
            photoId: optionalBoolean("Mark the latest 1x1 photo ID requirement."),
            governmentIssuedId: optionalBoolean("Mark the government-issued ID requirement."),
            affidavitOfLoss: optionalBoolean("Mark the Affidavit of Loss requirement."),
          })
          .describe("TIN Card Issuance documentary requirements.")
          .optional(),
        sameRdoAddressChange: z
          .object({
            addressDocument: optionalBoolean(
              "Mark the address-bearing permit or registration document requirement.",
            ),
            temporaryInvoiceUseLetter: optionalBoolean(
              "Mark the temporary-use-of-old-invoices letter requirement.",
            ),
          })
          .describe("Same-RDO registered-address change requirements.")
          .optional(),
        accountingPeriodChange: z
          .object({
            requestLetter: optionalBoolean("Mark the accounting-period request letter."),
            amendedBylaws: optionalBoolean("Mark the amended by-laws filing certificate."),
            nonForumShoppingDeclaration: optionalBoolean(
              "Mark the Non-forum Shopping sworn declaration.",
            ),
            separateReturnUndertaking: optionalBoolean(
              "Mark the undertaking to file a separate final or adjustment return.",
            ),
          })
          .describe("Accounting-period change requirements.")
          .optional(),
        civilStatusChange: z
          .object({
            marriageContractOrCourtOrder: optionalBoolean(
              "Mark the Marriage Contract or Court Order requirement.",
            ),
            temporaryInvoiceUseLetter: optionalBoolean(
              "Mark the temporary-use-of-old-invoices letter requirement.",
            ),
          })
          .describe("Civil-status change requirements.")
          .optional(),
        registeredNameTradeActivityChange: z
          .object({
            amendedRegistrationDocument: optionalBoolean(
              "Mark the amended registration, permit, or appointment document requirement.",
            ),
            temporaryInvoiceUseLetter: optionalBoolean(
              "Mark the temporary-use-of-old-invoices letter requirement.",
            ),
          })
          .describe("Registered-name, trade-name, or activity-change requirements.")
          .optional(),
        incentiveChange: z
          .object({
            promotionAgencyCertificate: optionalBoolean(
              "Mark the Investment Promotion Agency certificate requirement.",
            ),
          })
          .describe("Incentive-change requirements.")
          .optional(),
        lostCorOrAtp: z
          .object({
            affidavitOfLoss: optionalBoolean("Mark the Affidavit of Loss requirement."),
            looseStampFee: optionalBoolean("Mark the P30 Loose Stamp fee for COR."),
          })
          .describe("Lost COR or ATP replacement requirements.")
          .optional(),
        manualBooks: z
          .object({
            permanentlyBoundBooks: optionalBoolean(
              "Mark the new set of permanently bound manual Books of Accounts requirement.",
            ),
          })
          .describe("Manual Books of Accounts requirements.")
          .optional(),
        looseLeafBooks: z
          .object({
            permitToUse: optionalBoolean("Mark the Permit to Use Loose Leaf Books requirement."),
            permanentlyBoundBooks: optionalBoolean(
              "Mark the permanently bound Loose Leaf Books requirement.",
            ),
            completenessAffidavit: optionalBoolean(
              "Mark the loose-leaf completeness and accuracy affidavit.",
            ),
          })
          .describe("Manual loose-leaf Books of Accounts requirements.")
          .optional(),
        computerizedBooks: z
          .object({
            acknowledgementOrPermit: optionalBoolean(
              "Mark the CAS or CBA Acknowledgement Certificate or Permit to Use.",
            ),
            transmittalAndStorageMedia: optionalBoolean(
              "Mark the transmittal letter and electronic storage requirement.",
            ),
            completenessAffidavit: optionalBoolean(
              "Mark the computerized-books completeness and appropriateness affidavit.",
            ),
          })
          .describe("Computerized Books of Accounts requirements.")
          .optional(),
        individualTransfer: z
          .object({
            birForm1905: optionalBoolean(
              "Mark the BIR Form 1905 requirement for an individual not engaged in business.",
            ),
          })
          .describe("Individual transfer-of-registration requirements.")
          .optional(),
        businessTransferOldRdo: z
          .object({
            birForm1905Copies: optionalBoolean("Mark the three Form 1905 copies requirement."),
            invoiceInventory: optionalBoolean(
              "Mark the unused-invoice inventory or approval-letter requirement.",
            ),
            transferCommitment: optionalBoolean(
              "Mark the notarized Transfer Commitment Form requirement.",
            ),
          })
          .describe("Business-transfer requirements submitted to the old RDO.")
          .optional(),
        businessTransferNewRdo: z
          .object({
            birForm1905Copies: optionalBoolean("Mark the two Form 1905 originals requirement."),
            amendedSecDocuments: optionalBoolean(
              "Mark the amended SEC registration documents requirement.",
            ),
            businessPermit: optionalBoolean("Mark the Mayor's Business Permit requirement."),
            unusedInvoices: optionalBoolean(
              "Mark the unused invoices for re-stamping requirement.",
            ),
            transferCommitmentCopy: optionalBoolean(
              "Mark the Transfer Commitment and received Form 1905 copy requirement.",
            ),
          })
          .describe("Business-transfer requirements submitted to the new RDO.")
          .optional(),
        cancellationDueToDeathOrDuplicateTin: z
          .object({
            deathCertificate: optionalBoolean("Mark the Death Certificate requirement."),
          })
          .describe("TIN cancellation due to death or duplicate TIN requirement.")
          .optional(),
        businessClosure: z
          .object({
            endingInventory: optionalBoolean("Mark the ending-inventory list requirement."),
            unusedInvoicesAndForms: optionalBoolean(
              "Mark the unused invoices and accounting forms inventory requirement.",
            ),
            originalBirNoticesPermitsCor: optionalBoolean(
              "Mark the original BIR notices, permits, and COR requirement.",
            ),
          })
          .describe("Business closure documentary requirements.")
          .optional(),
        fees: z
          .object({
            taxClearanceLooseStamp: optionalBoolean(
              "Mark the P30 Loose Stamp fee for the Tax Clearance Certificate.",
            ),
          })
          .describe("Fees-to-be-paid requirement.")
          .optional(),
        representativeDocuments: z
          .object({
            transactingThroughRepresentative: optionalBoolean(
              "Mark the Additional Documents checkbox when the taxpayer is transacting through a representative; the printed individual or non-individual supporting-document list applies as appropriate.",
            ),
          })
          .describe("Additional representative-document requirements.")
          .optional(),
      })
      .describe("Page 4 documentary-requirement checkboxes.")
      .optional(),
  })
  .describe(
    "Optional values for every writable field, checkbox, and choice on the October 2025 BIR Form 1905.",
  );

export const bir1905FormInputSchema = z
  .object({
    type: z.literal("1905").describe('BIR form discriminator. Use "1905".'),
    data: bir1905DataSchema.describe(
      "Form-specific values for BIR Form 1905. Every field is optional.",
    ),
  })
  .describe("Input for generating BIR Form 1905.");

export type Bir1905Data = z.infer<typeof bir1905DataSchema>;
export type Bir1905FormInput = z.infer<typeof bir1905FormInputSchema>;
