import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  TrendingUp,
  LayoutDashboard,
  Trophy,
  BarChart3,
  ArrowLeftRight,
  Calculator,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { MoatLogo } from "@/components/moat-card";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { getMoatMeta } from "@/lib/moat-metadata";

export const OPEN_COMMAND_PALETTE_EVENT = "open-command-palette";

const ROUTES = [
  { href: "/", label: "Explore", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/calculator", label: "Calculator", icon: Calculator },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { data: configs } = useAllMoatConfigs();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search moats or jump to a page…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {ROUTES.map(({ href, label, icon: Icon }) => (
            <CommandItem
              key={href}
              value={`page ${label}`}
              onSelect={() => go(href)}
              data-testid={`command-route-${label.toLowerCase()}`}
            >
              <Icon className="text-muted-foreground" />
              <span>{label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {configs && configs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Moats">
              {configs.map((moat) => {
                const meta = getMoatMeta(moat.contractAddress);
                const primaryTokenAddress =
                  meta.tokenAddress ||
                  moat.rewardTokens.find((t) => t.enabled)?.tokenAddress;
                return (
                  <CommandItem
                    key={moat.contractAddress}
                    value={`moat ${meta.name} ${meta.protocol} ${meta.tokenSymbol}`}
                    onSelect={() => go(`/moat/${moat.contractAddress}`)}
                    data-testid={`command-moat-${moat.contractAddress}`}
                  >
                    <div className="h-6 w-6 shrink-0 [&_img]:!h-6 [&_img]:!w-6 [&_div]:!h-6 [&_div]:!w-6 [&_div]:!text-[10px]">
                      <MoatLogo
                        meta={meta}
                        primaryTokenAddress={primaryTokenAddress}
                        size="sm"
                      />
                    </div>
                    <span className="truncate">{meta.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {meta.protocol}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
