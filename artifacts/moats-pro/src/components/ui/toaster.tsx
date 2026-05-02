import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

type Variant = "default" | "success" | "destructive"

const VARIANT_STYLES: Record<
  Variant,
  { Icon: LucideIcon; iconColor: string; bar: string; iconBg: string }
> = {
  default: {
    Icon: Info,
    iconColor: "text-cyan-300",
    iconBg: "bg-cyan-400/10 ring-1 ring-inset ring-cyan-400/30",
    bar: "bg-gradient-to-b from-cyan-300 via-cyan-400 to-cyan-500/60",
  },
  success: {
    Icon: CheckCircle2,
    iconColor: "text-emerald-300",
    iconBg: "bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/30",
    bar: "bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-500/60",
  },
  destructive: {
    Icon: AlertTriangle,
    iconColor: "text-rose-300",
    iconBg: "bg-rose-500/10 ring-1 ring-inset ring-rose-400/30",
    bar: "bg-gradient-to-b from-rose-300 via-rose-400 to-rose-500/60",
  },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const v: Variant =
          variant === "destructive" || variant === "success" ? variant : "default"
        const { Icon, iconColor, iconBg, bar } = VARIANT_STYLES[v]
        return (
          <Toast key={id} variant={v} {...props}>
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 w-[3px]", bar)}
            />
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                iconBg,
              )}
            >
              <Icon className={cn("h-4 w-4", iconColor)} />
            </span>
            <div className="flex-1 min-w-0 grid gap-0.5 pr-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
