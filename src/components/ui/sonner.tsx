import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group z-[200]"
      position="top-center" // Using top-center to mimic iOS / Super App sleek dropdown alerts
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:bg-card dark:bg-slate-900 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] rounded-[1.25rem] sm:rounded-full px-5 py-4 sm:py-3 font-bold border backdrop-blur-xl group-[.toaster]:bg-card dark:bg-slate-900/95 tracking-tight",
          description: "group-[.toast]:text-muted-foreground/80 text-sm font-medium mt-1 leading-snug",
          actionButton:
            "group-[.toast]:bg-slate-900 group-[.toast]:text-white font-bold rounded-xl px-4 py-2 hover:bg-slate-800 transition-colors",
          cancelButton:
            "group-[.toast]:bg-muted/50 group-[.toast]:text-muted-foreground font-bold rounded-xl px-4 py-2 hover:bg-border transition-colors",
          success: "group-[.toaster]:border-emerald-200 group-[.toaster]:bg-emerald-50/95 group-[.toaster]:text-emerald-950 [&_[data-icon]]:text-emerald-600",
          error: "group-[.toaster]:border-red-200 group-[.toaster]:bg-red-50/95 group-[.toaster]:text-red-950 [&_[data-icon]]:text-red-600",
          info: "group-[.toaster]:border-blue-200 group-[.toaster]:bg-blue-50/95 group-[.toaster]:text-blue-950 [&_[data-icon]]:text-blue-600",
          warning: "group-[.toaster]:border-amber-200 group-[.toaster]:bg-amber-50/95 group-[.toaster]:text-amber-950 [&_[data-icon]]:text-amber-600",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
