import { Loader2 } from "lucide-react";

type LoadingSpinnerProps = {
  label?: string;
  className?: string;
  fullHeight?: boolean;
};

export default function LoadingSpinner({
  label = "Loading...",
  className = "",
  fullHeight = false,
}: LoadingSpinnerProps) {
  return (
    <div
      className={`flex items-center justify-center gap-3 text-sm text-slate-500 ${
        fullHeight ? "min-h-[220px]" : "py-8"
      } ${className}`.trim()}
    >
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      <span>{label}</span>
    </div>
  );
}
