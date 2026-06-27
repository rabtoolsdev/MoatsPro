import { Plus, Trash2, Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/calculator/date-field";
import { CALCULATOR_MOATS } from "@/config/calculator-moats";
import type { CalculatorCriteria } from "@/lib/moats-api";

const TX_TYPES = ["burn", "stake", "lock"] as const;

export interface CriteriaBuilderProps {
  moatId: string;
  onMoatChange: (id: string) => void;
  criteriaList: CalculatorCriteria[];
  onCriteriaChange: (list: CalculatorCriteria[]) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onCalculate: () => void;
  isLoading: boolean;
}

export function CriteriaBuilder({
  moatId,
  onMoatChange,
  criteriaList,
  onCriteriaChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onCalculate,
  isLoading,
}: CriteriaBuilderProps) {
  const selectedMoat = CALCULATOR_MOATS.find((m) => m.id === moatId);

  const updateCriteria = (index: number, patch: Partial<CalculatorCriteria>) => {
    onCriteriaChange(
      criteriaList.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };

  const toggleType = (index: number, type: string) => {
    const current = criteriaList[index].transactionTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateCriteria(index, { transactionTypes: next });
  };

  const addCriteria = () => {
    onCriteriaChange([
      ...criteriaList,
      {
        transactionTypes: ["burn"],
        tokenAddress: selectedMoat?.tokenAddress ?? "",
        tokenAmount: 1000,
        entries: 1,
      },
    ]);
  };

  const removeCriteria = (index: number) => {
    onCriteriaChange(criteriaList.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-5 sm:p-6 space-y-6">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Select Moat
        </Label>
        <Select value={moatId} onValueChange={onMoatChange}>
          <SelectTrigger data-testid="select-moat" className="bg-background/60">
            <SelectValue placeholder="Choose a moat" />
          </SelectTrigger>
          <SelectContent>
            {CALCULATOR_MOATS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} ({m.symbol})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedMoat && (
          <p className="text-[11px] font-mono text-muted-foreground/70 break-all pt-1">
            {selectedMoat.contractAddress}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Start Date
          </Label>
          <DateField
            data-testid="input-start-date"
            value={startDate}
            onChange={onStartDateChange}
            placeholder="Start date"
            maxDate={endDate || undefined}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            End Date
          </Label>
          <DateField
            data-testid="input-end-date"
            value={endDate}
            onChange={onEndDateChange}
            placeholder="End date"
            minDate={startDate || undefined}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Entry Criteria
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addCriteria}
            data-testid="button-add-criteria"
            className="h-7 gap-1 text-primary hover:text-primary hover:bg-primary/10"
          >
            <Plus size={14} /> Add rule
          </Button>
        </div>

        {criteriaList.map((c, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-background/40 p-4 space-y-3"
            data-testid={`criteria-row-${i}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Rule {i + 1}
              </span>
              {criteriaList.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCriteria(i)}
                  data-testid={`button-remove-criteria-${i}`}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {TX_TYPES.map((type) => {
                const active = c.transactionTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(i, type)}
                    data-testid={`toggle-${type}-${i}`}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                      active
                        ? "bg-primary/15 text-primary border border-primary/40"
                        : "bg-muted/40 text-muted-foreground border border-transparent hover:text-foreground"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">
                Token Address
              </Label>
              <Input
                value={c.tokenAddress}
                onChange={(e) => updateCriteria(i, { tokenAddress: e.target.value })}
                data-testid={`input-token-address-${i}`}
                placeholder="0x..."
                className="bg-background/60 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">
                  Tokens per entry
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={c.tokenAmount}
                  onChange={(e) =>
                    updateCriteria(i, { tokenAmount: Number(e.target.value) })
                  }
                  data-testid={`input-token-amount-${i}`}
                  className="bg-background/60"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">
                  Entries awarded
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={c.entries}
                  onChange={(e) =>
                    updateCriteria(i, { entries: Number(e.target.value) })
                  }
                  data-testid={`input-entries-${i}`}
                  className="bg-background/60"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onCalculate}
        disabled={isLoading || !moatId}
        data-testid="button-calculate"
        className="w-full gap-2 btn-shimmer"
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Calculating…
          </>
        ) : (
          <>
            <Calculator size={16} /> Calculate Entries
          </>
        )}
      </Button>
    </div>
  );
}
