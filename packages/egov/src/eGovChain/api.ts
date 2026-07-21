import { defineEgovCatalog } from "../core/catalog.js";
import { createEgovTransport } from "../core/client.js";
import type { EgovCallOptions } from "../core/types.js";
import type {
  EgovChainClient,
  EgovChainClientOptions,
  EgovChainRpcFailure,
  EgovChainRpcId,
  EgovChainRpcSuccess,
} from "./types.js";

export const EGOV_CHAIN_SOURCE_URL =
  "https://platforms.e.gov.ph/dashboard/api-catalogs/egovchain" as const;
export const EGOV_CHAIN_RPC_URL = "https://hackathon-blockchain.e.gov.ph" as const;
export const EGOV_CHAIN_EXPLORER_URL = "https://hackathon-explorer.e.gov.ph" as const;
export const EGOV_CHAIN_ID = 13_371 as const;

export class EgovChainRpcError extends Error {
  readonly code: number;
  readonly data: unknown;
  readonly id: EgovChainRpcId | null;

  constructor(response: EgovChainRpcFailure) {
    super(response.error.message);
    this.name = "EgovChainRpcError";
    this.code = response.error.code;
    this.data = response.error.data;
    this.id = response.id;
  }
}

function withSignal(options: EgovCallOptions | undefined): Pick<EgovCallOptions, "signal"> {
  return options?.signal === undefined ? {} : { signal: options.signal };
}

export function createEgovChainClient(options: EgovChainClientOptions = {}): EgovChainClient {
  const transport = createEgovTransport({
    baseUrl: options.baseUrl ?? EGOV_CHAIN_RPC_URL,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });
  let nextId = 1;

  async function request<TResult, TParams extends readonly unknown[] = readonly unknown[]>(
    method: string,
    params = [] as unknown as TParams,
    callOptions?: EgovCallOptions & { id?: EgovChainRpcId },
  ): Promise<TResult> {
    const id = callOptions?.id ?? nextId++;
    const response = await transport.request<EgovChainRpcFailure | EgovChainRpcSuccess<TResult>>({
      body: { id, jsonrpc: "2.0", method, params },
      headers: new Headers(callOptions?.headers),
      method: "POST",
      path: "/",
      ...withSignal(callOptions),
    });

    if ("error" in response) {
      throw new EgovChainRpcError(response);
    }

    return response.result;
  }

  return {
    blockNumber: (callOptions) => request("eth_blockNumber", [], callOptions),
    call: (transaction, block = "latest", callOptions) =>
      request("eth_call", [transaction, block], callOptions),
    chainId: (callOptions) => request("eth_chainId", [], callOptions),
    clientVersion: (callOptions) => request("web3_clientVersion", [], callOptions),
    getBalance: (address, block = "latest", callOptions) =>
      request("eth_getBalance", [address, block], callOptions),
    getLogs: (filter, callOptions) => request("eth_getLogs", [filter], callOptions),
    modules: (callOptions) => request("rpc_modules", [], callOptions),
    request,
    sendRawTransaction: (signedTransaction, callOptions) =>
      request("eth_sendRawTransaction", [signedTransaction], callOptions),
  };
}

const requestEntries = [
  ["rpc-modules", "rpc_modules", "rpc_modules"],
  ["web3-client-version", "web3_clientVersion", "web3_clientVersion"],
  ["web3-sha3", "web3_sha3", "web3_sha3"],
  ["net-version", "net_version", "net_version"],
  ["net-listening", "net_listening", "net_listening"],
  ["net-peer-count", "net_peerCount", "net_peerCount"],
  ["net-enode", "net_enode", "net_enode"],
  ["net-services", "net_services", "net_services"],
  ["eth-chain-id", "eth_chainId", "eth_chainId"],
  ["eth-protocol-version", "eth_protocolVersion", "eth_protocolVersion"],
  ["eth-syncing", "eth_syncing", "eth_syncing"],
  ["eth-coinbase", "eth_coinbase", "eth_coinbase"],
  ["eth-mining", "eth_mining", "eth_mining"],
  ["eth-hashrate", "eth_hashrate", "eth_hashrate"],
  ["eth-gas-price", "eth_gasPrice", "eth_gasPrice"],
  ["eth-max-priority-fee", "eth_maxPriorityFeePerGas", "eth_maxPriorityFeePerGas"],
  ["eth-fee-history", "eth_feeHistory", "eth_feeHistory"],
  ["eth-blob-base-fee", "eth_blobBaseFee", "eth_blobBaseFee"],
  ["eth-block-number", "eth_blockNumber", "eth_blockNumber"],
  ["eth-accounts", "eth_accounts", "eth_accounts"],
  ["eth-get-balance", "eth_getBalance", "eth_getBalance"],
  ["eth-get-balance-at-block", "eth_getBalance (at block)", "eth_getBalance"],
  ["eth-get-transaction-count", "eth_getTransactionCount", "eth_getTransactionCount"],
  [
    "eth-get-transaction-count-pending",
    "eth_getTransactionCount (pending)",
    "eth_getTransactionCount",
  ],
  ["eth-get-code", "eth_getCode", "eth_getCode"],
  ["eth-get-storage-at", "eth_getStorageAt", "eth_getStorageAt"],
  ["eth-get-proof", "eth_getProof", "eth_getProof"],
  ["eth-get-block-latest", "eth_getBlockByNumber (latest)", "eth_getBlockByNumber"],
  ["eth-get-block-full", "eth_getBlockByNumber (full txs)", "eth_getBlockByNumber"],
  ["eth-get-block-by-hash", "eth_getBlockByHash", "eth_getBlockByHash"],
  [
    "eth-block-tx-count-number",
    "eth_getBlockTransactionCountByNumber",
    "eth_getBlockTransactionCountByNumber",
  ],
  [
    "eth-block-tx-count-hash",
    "eth_getBlockTransactionCountByHash",
    "eth_getBlockTransactionCountByHash",
  ],
  ["eth-get-block-receipts", "eth_getBlockReceipts", "eth_getBlockReceipts"],
  ["eth-uncle-count-number", "eth_getUncleCountByBlockNumber", "eth_getUncleCountByBlockNumber"],
  ["eth-uncle-count-hash", "eth_getUncleCountByBlockHash", "eth_getUncleCountByBlockHash"],
  ["eth-get-uncle", "eth_getUncleByBlockNumberAndIndex", "eth_getUncleByBlockNumberAndIndex"],
  ["eth-get-transaction", "eth_getTransactionByHash", "eth_getTransactionByHash"],
  ["eth-get-receipt", "eth_getTransactionReceipt", "eth_getTransactionReceipt"],
  [
    "eth-get-tx-number-index",
    "eth_getTransactionByBlockNumberAndIndex",
    "eth_getTransactionByBlockNumberAndIndex",
  ],
  [
    "eth-get-tx-hash-index",
    "eth_getTransactionByBlockHashAndIndex",
    "eth_getTransactionByBlockHashAndIndex",
  ],
  ["eth-send-raw-transaction", "eth_sendRawTransaction", "eth_sendRawTransaction"],
  ["eth-new-block-filter", "eth_newBlockFilter", "eth_newBlockFilter"],
  ["eth-new-pending-filter", "eth_newPendingTransactionFilter", "eth_newPendingTransactionFilter"],
  ["eth-new-filter", "eth_newFilter", "eth_newFilter"],
  ["eth-get-filter-changes", "eth_getFilterChanges", "eth_getFilterChanges"],
  ["eth-get-filter-logs", "eth_getFilterLogs", "eth_getFilterLogs"],
  ["eth-uninstall-filter", "eth_uninstallFilter", "eth_uninstallFilter"],
  ["eth-get-logs", "eth_getLogs", "eth_getLogs"],
  ["eth-call", "eth_call", "eth_call"],
  ["eth-estimate-gas", "eth_estimateGas", "eth_estimateGas"],
  ["eth-create-access-list", "eth_createAccessList", "eth_createAccessList"],
  ["qbft-validators-number", "qbft_getValidatorsByBlockNumber", "qbft_getValidatorsByBlockNumber"],
  ["qbft-validators-hash", "qbft_getValidatorsByBlockHash", "qbft_getValidatorsByBlockHash"],
  ["qbft-pending-votes", "qbft_getPendingVotes", "qbft_getPendingVotes"],
  ["qbft-signer-metrics", "qbft_getSignerMetrics", "qbft_getSignerMetrics"],
  ["txpool-statistics", "txpool_besuStatistics", "txpool_besuStatistics"],
  ["txpool-transactions", "txpool_besuTransactions", "txpool_besuTransactions"],
  ["txpool-pending", "txpool_besuPendingTransactions", "txpool_besuPendingTransactions"],
  ["guestbook-code", "eth_getCode (HackathonGuestbook)", "eth_getCode"],
  ["guestbook-team-count", "eth_call — teamCount()", "eth_call"],
  ["guestbook-list-teams", "eth_call — listTeams()", "eth_call"],
  ["guestbook-get-team", "eth_call — getTeam(0)", "eth_call"],
  ["guestbook-entry-count", "eth_call — entryCount()", "eth_call"],
  ["guestbook-get-entry", "eth_call — getEntry(0)", "eth_call"],
  ["guestbook-create-team-simulation", "eth_call — createTeam simulation", "eth_call"],
  ["guestbook-post-simulation", "eth_call — post simulation", "eth_call"],
  ["guestbook-post-for-team-simulation", "eth_call — postForTeam simulation", "eth_call"],
  ["guestbook-estimate-create-team", "eth_estimateGas — createTeam", "eth_estimateGas"],
  ["guestbook-team-created-logs", "eth_getLogs — TeamCreated events", "eth_getLogs"],
  ["guestbook-message-posted-logs", "eth_getLogs — MessagePosted events", "eth_getLogs"],
] as const;

export const egovChainCatalog = defineEgovCatalog({
  endpoints: requestEntries.map(([id, name, rpcMethod]) => ({
    body: {
      fields: [
        { name: "jsonrpc", required: true, type: '"2.0"' },
        { name: "method", required: true, type: "string" },
        { name: "params", required: true, type: "array" },
        { name: "id", required: true, type: "number | string" },
      ],
    },
    description: `Call the ${rpcMethod} JSON-RPC method.`,
    id,
    method: "POST",
    name,
    parameters: [],
    path: "/",
    responses: [{ description: "JSON-RPC result or error object.", status: 200 }],
    rpcMethod,
  })),
  id: "egovchain",
  name: "eGovChain",
  slug: "egovchain",
  sourceUrl: EGOV_CHAIN_SOURCE_URL,
  summary: "Zero-fee Hyperledger Besu JSON-RPC government blockchain.",
});
