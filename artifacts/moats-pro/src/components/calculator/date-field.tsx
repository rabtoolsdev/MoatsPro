import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  /** Value as a `yyyy-MM-dd` string (or empty). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "data-testid"?: string;
  /** Disable days after this date (also a `yyyy-MM-dd` string). */
  maxDate?: string;
  /** Disable days before this date (also a `yyyy-MM-dd` string). */
  minDate?: string;
}

function parseISO(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  maxDate,
  minDate,
  ...rest
}: DateFieldProps) {
  const selected = parseISO(value);
  const max = parseISO(maxDate ?? "");
  const min = parseISO(minDate ?? "");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={rest["data-testid"]}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background/60 px-3 text-sm transition-colors",
            "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon size={14} className="shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selected ? format(selected, "MMM d, yyyy") : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          disabled={
            max || min
              ? (date) =>
                  (max ? date > max : false) || (min ? date < min : false)
              : undefined
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
