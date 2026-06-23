const SNOWSCAN_API_BASE = "https://api.snowtrace.io/api";

export interface SnowscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  confirmations: string;
  input?: string;
  methodId?: string;
  functionName?: string;
}

interface SnowscanResponse {
  status: string;
  message: string;
  result: SnowscanTransaction[] | string;
}

/**
 * Reads ERC-20 token transfers for a contract from the Snowtrace (Avalanche)
 * explorer API. The API key is optional — without it the endpoint is rate
 * limited but still functional.
 */
export class SnowscanService {
  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SNOWTRACE_API_KEY ?? null;
  }

  async getTokenTransactions(
    contractAddress: string,
    tokenAddress?: string,
    startBlock?: number,
    endBlock?: number,
  ): Promise<SnowscanTransaction[]> {
    const PAGE_SIZE = 200;
    const MAX_PAGES = 50;
    const allTransactions: SnowscanTransaction[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        module: "account",
        action: "tokentx",
        address: contractAddress,
        page: page.toString(),
        offset: PAGE_SIZE.toString(),
        sort: "desc",
      });
      if (tokenAddress) params.set("contractaddress", tokenAddress);
      if (startBlock !== undefined) params.set("startblock", startBlock.toString());
      if (endBlock !== undefined) params.set("endblock", endBlock.toString());
      if (this.apiKey) params.set("apikey", this.apiKey);

      const response = await fetch(`${SNOWSCAN_API_BASE}?${params.toString()}`);
      if (!response.ok) break;
      const data = (await response.json()) as SnowscanResponse;

      if (data.status === "1" && Array.isArray(data.result)) {
        const results = data.result;
        allTransactions.push(...results);
        if (results.length < PAGE_SIZE) break;
      } else {
        break;
      }
    }

    return allTransactions;
  }
}
