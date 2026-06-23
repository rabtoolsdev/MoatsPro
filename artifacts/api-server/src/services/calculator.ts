export interface CalculatorTransaction {
  hash?: string;
  from: string;
  to: string;
  value: string;
  tokenDecimal: string;
  contractAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  timeStamp?: string;
  functionName?: string;
  methodId?: string;
}

export interface Criteria {
  transactionTypes: string[];
  tokenAddress: string;
  tokenAmount: number;
  entries: number;
}

interface WalletTxn {
  hash: string;
  type: string;
  amount: number;
  tokenSymbol?: string;
  timestamp: number;
  date: string;
  functionName?: string;
}

interface WalletAccumulator {
  transactionCount: number;
  totalAmount: number;
  tokenSymbol?: string;
  tokenName?: string;
  burnAmount: number;
  stakeAmount: number;
  lockAmount: number;
  burnCount: number;
  stakeCount: number;
  lockCount: number;
  criteriaAmounts: number[];
  transactions: WalletTxn[];
}

export class EntryCalculator {
  calculateEntries(
    transactions: CalculatorTransaction[],
    criteriaList: Criteria[],
    targetContractAddress: string | string[],
  ) {
    const walletMap = new Map<string, WalletAccumulator>();
    // A moat can span multiple contracts (e.g. after a migration). Count a
    // transfer when it lands on ANY of the moat's contract addresses.
    const targetSet = new Set(
      (Array.isArray(targetContractAddress)
        ? targetContractAddress
        : [targetContractAddress]
      ).map((a) => a.toLowerCase()),
    );

    for (const tx of transactions) {
      if (!targetSet.has(tx.to?.toLowerCase())) continue;

      for (let ci = 0; ci < criteriaList.length; ci++) {
        const criteria = criteriaList[ci];
        if (!this.matchesCriteria(tx, criteria)) continue;

        const wallet = tx.from.toLowerCase();
        const amount = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));

        if (!walletMap.has(wallet)) {
          walletMap.set(wallet, {
            transactionCount: 0,
            totalAmount: 0,
            tokenSymbol: tx.tokenSymbol,
            tokenName: tx.tokenName,
            burnAmount: 0,
            stakeAmount: 0,
            lockAmount: 0,
            burnCount: 0,
            stakeCount: 0,
            lockCount: 0,
            criteriaAmounts: new Array(criteriaList.length).fill(0),
            transactions: [],
          });
        }

        const walletData = walletMap.get(wallet)!;
        walletData.criteriaAmounts[ci] += amount;

        const isFirstCriteriaMatch = criteriaList
          .slice(0, ci)
          .every((c) => !this.matchesCriteria(tx, c));

        if (isFirstCriteriaMatch) {
          walletData.transactionCount++;
          walletData.totalAmount += amount;
          const txType = this.getTransactionType(tx);
          if (txType === "burn") {
            walletData.burnAmount += amount;
            walletData.burnCount++;
          } else if (txType === "stake") {
            walletData.stakeAmount += amount;
            walletData.stakeCount++;
          } else if (txType === "lock") {
            walletData.lockAmount += amount;
            walletData.lockCount++;
          }
          const timestamp = tx.timeStamp ? parseInt(tx.timeStamp) : 0;
          walletData.transactions.push({
            hash: tx.hash || "",
            type: txType ?? "unknown",
            amount: Math.round(amount * 100) / 100,
            tokenSymbol: tx.tokenSymbol,
            timestamp,
            date: timestamp ? new Date(timestamp * 1000).toISOString().split("T")[0] : "",
            functionName: tx.functionName || tx.methodId,
          });
        }
      }
    }

    return Array.from(walletMap.entries()).map(([address, data]) => {
      let entries = 0;
      data.criteriaAmounts.forEach((totalAmount, ci) => {
        if (totalAmount > 0) {
          const c = criteriaList[ci];
          entries += Math.floor(totalAmount / c.tokenAmount) * c.entries;
        }
      });
      return {
        address,
        transactionCount: data.transactionCount,
        totalAmount: Math.round(data.totalAmount * 100) / 100,
        entries,
        tokenSymbol: data.tokenSymbol,
        tokenName: data.tokenName,
        burnAmount: Math.round(data.burnAmount * 100) / 100,
        stakeAmount: Math.round(data.stakeAmount * 100) / 100,
        lockAmount: Math.round(data.lockAmount * 100) / 100,
        burnCount: data.burnCount,
        stakeCount: data.stakeCount,
        lockCount: data.lockCount,
        transactions: data.transactions.sort((a, b) => b.timestamp - a.timestamp),
      };
    });
  }

  private matchesCriteria(tx: CalculatorTransaction, criteria: Criteria): boolean {
    if (tx.contractAddress?.toLowerCase() !== criteria.tokenAddress.toLowerCase()) {
      return false;
    }
    if (criteria.transactionTypes.length > 0) {
      const fn = (tx.functionName || "").toLowerCase();
      return criteria.transactionTypes.some((t) => fn.includes(t.toLowerCase()));
    }
    return true;
  }

  private getTransactionType(tx: CalculatorTransaction): string | null {
    const fn = (tx.functionName || "").toLowerCase();
    if (fn.includes("burn")) return "burn";
    if (fn.includes("stake")) return "stake";
    if (fn.includes("lock")) return "lock";
    return null;
  }
}
