import type { EgovCallOptions, EgovTransportOptions } from "../core/types.js";

export type FaceLivenessAction = "close" | "post" | "redirect";

export interface FaceLivenessCreateSessionRequest {
  action: FaceLivenessAction;
  callbackUrl?: string;
  delay?: number;
}

export interface FaceLivenessCreateSessionResponse {
  token: string;
  url: string;
}

export interface FaceLivenessVerificationResult {
  confidence_score: number;
  reference_image_url: string;
  status: "FAILED" | "PENDING" | "SUCCEEDED" | (string & {});
}

export interface FaceLivenessClient {
  createSession(
    request: FaceLivenessCreateSessionRequest,
    options?: EgovCallOptions,
  ): Promise<FaceLivenessCreateSessionResponse>;
  getVerificationResult(
    sessionToken: string,
    options?: EgovCallOptions,
  ): Promise<FaceLivenessVerificationResult>;
}

export interface FaceLivenessClientOptions extends EgovTransportOptions {
  apiKey: string;
}

export interface FaceLivenessEnvironmentClientOptions extends EgovTransportOptions {
  env?: import("../core/env.js").EgovEnvironment;
}
