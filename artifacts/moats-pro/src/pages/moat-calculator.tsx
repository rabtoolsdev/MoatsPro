import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calculator as CalculatorIcon } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CriteriaBuilder } from "@/components/calculator/criteria-builder";
import { ResultsDashboard } from "@/components/calculator/results-dashboard";
import { CALCULATOR_MOATS } from "@/config/calculator-moats";
import {
  moatsApi,
  type CalculatorCriteria,
  type CalculatorResponse,
} from "@/lib/moats-api";

export default function MoatCalculator() {
  const [moatId, setMoatId] = useState(CALCULATOR_MOATS[0]?.id ?? "");
  const [criteriaList, setCriteriaList] = useState<CalculatorCriteria[]>([
    {
      transactionTypes: ["burn"],
      tokenAddress: CALCULATOR_MOATS[0]?.tokenAddress ?? "",
      tokenAmount: 1000,
      entries: 1,
    },
  ]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const mutation = useMutation<CalculatorResponse>({
    mutationFn: () => {
      const moat = CALCULATOR_MOATS.find((m) => m.id === moatId);
      if (!moat) throw new Error("Select a moat first.");
      return moatsApi.calculateMoatEntries({
        contractAddress: moat.contractAddress,
        criteriaList,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    },
  });

  const handleMoatChange = (id: string) => {
    setMoatId(id);
    const moat = CALCULATOR_MOATS.find((m) => m.id === id);
    if (moat) {
      // Point every rule at the newly selected moat's token. Without this a
      // rule keeps the previous moat's token address and matches nothing.
      setCriteriaList((prev) =>
        prev.map((c) => ({ ...c, tokenAddress: moat.tokenAddress })),
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 pt-24 sm:pt-28 pb-16">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CalculatorIcon className="text-primary" size={22} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Moat Calculator
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Tally giveaway entries from on-chain burns, stakes, and locks. Choose a
            moat, define how tokens convert to entries, then export the list or spin
            the wheel to pick a winner.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <CriteriaBuilder
            moatId={moatId}
            onMoatChange={handleMoatChange}
            criteriaList={criteriaList}
            onCriteriaChange={setCriteriaList}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onCalculate={() => mutation.mutate()}
            isLoading={mutation.isPending}
          />
          <ResultsDashboard
            data={mutation.data ?? null}
            isLoading={mutation.isPending}
            error={mutation.isError ? (mutation.error as Error).message : null}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
