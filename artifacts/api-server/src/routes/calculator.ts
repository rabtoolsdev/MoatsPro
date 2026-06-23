import { Router, type IRouter } from "express";
import { SnowscanService } from "../services/snowscan";
import { EntryCalculator } from "../services/calculator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const snowscanService = new SnowscanService();
const calculator = new EntryCalculator();

// Moat giveaway entry calculator. Reads on-chain ERC-20 transfers to a moat
// contract from Snowtrace and tallies raffle entries per wallet based on the
// supplied criteria. Supports a single moat or multiple moats (multi-project
// mode requires a wallet to qualify in every project).
router.post("/calculator/calculate", async (req, res) => {
  try {
    const { contractAddress, contractAddresses, criteriaList, startDate, endDate, multiProject, projects } = req.body;

    if (multiProject && projects) {
      const trackedTokens: any[] = [];
      const enhancedCriteria: any[] = [];

      projects.forEach((project: any) => {
        const projectName = project.name || project.id;
        const projectTransactionTypes = new Set<string>();
        project.criteriaList.forEach((c: any) =>
          c.transactionTypes.forEach((t: string) => projectTransactionTypes.add(t)),
        );
        Array.from(projectTransactionTypes).forEach((transactionType) => {
          const typeDisplay = transactionType.charAt(0).toUpperCase() + transactionType.slice(1);
          trackedTokens.push({
            id: `${project.id}:${transactionType}`,
            projectId: project.id,
            projectName,
            address: project.contractAddress,
            transactionType,
            displayLabel: `${projectName} (${typeDisplay})`,
          });
        });
        project.criteriaList.forEach((criteria: any) =>
          enhancedCriteria.push({
            ...criteria,
            projectId: project.id,
            projectName: project.name,
            tokenLabel: projectName,
            contractAddress: project.contractAddress,
          }),
        );
      });

      const contractAddresses = Array.from(
        new Set(projects.map((p: any) => p.contractAddress)),
      ) as string[];
      const allTransactions: any[] = [];
      for (const contractAddr of contractAddresses) {
        const txs = await snowscanService.getTokenTransactions(contractAddr);
        txs.forEach((tx: any) => {
          tx._contractAddress = contractAddr;
        });
        allTransactions.push(...txs);
      }

      let filteredTransactions = Array.from(
        new Map(
          allTransactions.map((tx: any) => [
            `${tx.hash}_${tx.from}_${tx.to}_${tx.contractAddress}_${tx._contractAddress}`,
            tx,
          ]),
        ).values(),
      );
      if (startDate || endDate) {
        const startTs = startDate ? new Date(startDate).getTime() / 1000 : 0;
        const endTs = endDate ? new Date(endDate).getTime() / 1000 + 86400 : Infinity;
        filteredTransactions = filteredTransactions.filter(
          (tx: any) => parseInt(tx.timeStamp) >= startTs && parseInt(tx.timeStamp) <= endTs,
        );
      }

      const walletMap = new Map<string, any>();
      const projectIds = new Set(projects.map((p: any) => p.id));
      filteredTransactions.forEach((tx: any) => {
        const from = tx.from.toLowerCase();
        const contractAddr = tx._contractAddress.toLowerCase();
        const amount = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));
        enhancedCriteria.forEach((criteria: any) => {
          if (contractAddr !== criteria.contractAddress.toLowerCase()) return;
          criteria.transactionTypes.forEach((type: string) => {
            if (
              (type === "burn" || type === "stake" || type === "lock") &&
              tx.to.toLowerCase() === contractAddr
            ) {
              if (!walletMap.has(from))
                walletMap.set(from, {
                  address: from,
                  transactionCount: 0,
                  totalAmount: 0,
                  entries: 0,
                  tokenAmounts: {},
                  tokenAmountsByType: {},
                  projectHits: {},
                  projectEntries: {},
                  projectCriteriaAmounts: {},
                  transactions: [],
                });
              const wallet = walletMap.get(from);
              wallet.transactionCount++;
              wallet.totalAmount += amount;
              const tokenTypeKey = `${criteria.projectId}:${type}`;
              wallet.tokenAmountsByType[tokenTypeKey] =
                (wallet.tokenAmountsByType[tokenTypeKey] || 0) + amount;
              const pcKey = `${criteria.projectId}_${criteria.id}`;
              if (!wallet.projectCriteriaAmounts[pcKey])
                wallet.projectCriteriaAmounts[pcKey] = {
                  totalAmount: 0,
                  tokenAmount: criteria.tokenAmount,
                  entries: criteria.entries,
                  projectId: criteria.projectId,
                };
              wallet.projectCriteriaAmounts[pcKey].totalAmount += amount;
              wallet.projectHits[criteria.projectId] = true;
              const ts = tx.timeStamp ? parseInt(tx.timeStamp) : 0;
              wallet.transactions.push({
                hash: tx.hash || "",
                type,
                amount: Math.round(amount * 100) / 100,
                tokenSymbol: tx.tokenSymbol,
                timestamp: ts,
                date: ts ? new Date(ts * 1000).toISOString().split("T")[0] : "",
                functionName: tx.functionName,
              });
            }
          });
        });
      });

      walletMap.forEach((wallet) => {
        Object.values(wallet.projectCriteriaAmounts).forEach((pc: any) => {
          if (pc.totalAmount >= pc.tokenAmount)
            wallet.projectEntries[pc.projectId] =
              (wallet.projectEntries[pc.projectId] || 0) +
              Math.floor(pc.totalAmount / pc.tokenAmount) * pc.entries;
        });
      });

      const projectIdArray = Array.from(projectIds) as string[];
      const qualified = Array.from(walletMap.values()).filter((w) =>
        projectIdArray.every((pid) => w.projectHits[pid]),
      );
      qualified.forEach((wallet) => {
        wallet.entries = Math.min(...projectIdArray.map((pid) => wallet.projectEntries[pid] || 0));
      });
      const results = qualified.map(
        ({ projectHits, projectEntries, projectCriteriaAmounts, ...w }) => w,
      );
      return res.json({
        results,
        totalWallets: results.length,
        totalEntries: results.reduce((s: number, r: any) => s + r.entries, 0),
        multiProject: true,
        trackedTokens,
      });
    }

    // Single-project mode. A moat may span several contracts (e.g. it was
    // migrated to a new contract over time), so aggregate transfers across
    // every supplied address. Falls back to the single contractAddress.
    const targetAddresses: string[] =
      Array.isArray(contractAddresses) && contractAddresses.length > 0
        ? contractAddresses
        : [contractAddress];

    const allTxs: any[] = [];
    for (const addr of targetAddresses) {
      const txs = await snowscanService.getTokenTransactions(addr);
      allTxs.push(...txs);
    }

    let filteredTransactions = Array.from(
      new Map(
        allTxs.map((tx: any) => [`${tx.hash}_${tx.from}_${tx.to}_${tx.contractAddress}`, tx]),
      ).values(),
    );
    if (startDate || endDate) {
      const startTs = startDate ? new Date(startDate).getTime() / 1000 : 0;
      const endTs = endDate ? new Date(endDate).getTime() / 1000 + 86400 : Infinity;
      filteredTransactions = filteredTransactions.filter(
        (tx: any) => parseInt(tx.timeStamp) >= startTs && parseInt(tx.timeStamp) <= endTs,
      );
    }
    const results = calculator.calculateEntries(
      filteredTransactions,
      criteriaList,
      targetAddresses,
    );
    return res.json({
      results,
      totalWallets: results.length,
      totalEntries: results.reduce((s, r) => s + r.entries, 0),
    });
  } catch (err) {
    logger.error({ err }, "Calculator error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
