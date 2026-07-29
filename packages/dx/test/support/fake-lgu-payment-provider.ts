import type {
  LguPaymentCheckout,
  LguPaymentProvider,
  LguPaymentProviderSnapshot,
} from "../../src/lgu/types.js";

type CreateInput = Parameters<LguPaymentProvider["createPayment"]>[0];

export class FakeLguPaymentProvider implements LguPaymentProvider {
  readonly createInputs: CreateInput[] = [];
  readonly snapshots = new Map<string, LguPaymentProviderSnapshot>();
  readonly voided: string[] = [];
  failBeforeNextCreation = false;
  failAfterNextCreation = false;

  async createPayment(input: CreateInput): Promise<LguPaymentCheckout> {
    this.createInputs.push(structuredClone(input));
    if (this.failBeforeNextCreation) {
      this.failBeforeNextCreation = false;
      throw new Error("Provider unavailable before creation");
    }
    const existing = [...this.snapshots.values()].find(
      (snapshot) => snapshot.transactionId === input.transactionId,
    );
    if (existing)
      return {
        transactionUuid: existing.transactionUuid,
        transactionId: existing.transactionId,
        checkoutUrl: `https://pay.example.test/${existing.transactionUuid}`,
        status: "PENDING",
        amount: existing.amount,
        currency: existing.currency,
      };

    const transactionUuid = crypto.randomUUID();
    this.snapshots.set(transactionUuid, {
      transactionUuid,
      transactionId: input.transactionId,
      amount: input.amount,
      currency: input.currency,
      status: "PENDING",
      providerStatus: "pending",
      paidAt: null,
      expiresAt: null,
    });
    if (this.failAfterNextCreation) {
      this.failAfterNextCreation = false;
      throw new Error("Response lost after provider creation");
    }
    return {
      transactionUuid,
      transactionId: input.transactionId,
      checkoutUrl: `https://pay.example.test/${transactionUuid}`,
      status: "PENDING",
      amount: input.amount,
      currency: input.currency,
    };
  }

  async getTransaction(transactionUuid: string) {
    const snapshot = this.snapshots.get(transactionUuid);
    if (!snapshot) throw new Error("Unknown fake LGU payment");
    return structuredClone(snapshot);
  }

  async voidTransaction(transactionUuid: string) {
    const snapshot = this.snapshots.get(transactionUuid);
    if (!snapshot) throw new Error("Unknown fake LGU payment");
    this.voided.push(transactionUuid);
    snapshot.status = "VOIDED";
    snapshot.providerStatus = "voided";
  }

  updateTransaction(transactionUuid: string, patch: Partial<LguPaymentProviderSnapshot>) {
    const snapshot = this.snapshots.get(transactionUuid);
    if (!snapshot) throw new Error("Unknown fake LGU payment");
    Object.assign(snapshot, patch);
  }
}
