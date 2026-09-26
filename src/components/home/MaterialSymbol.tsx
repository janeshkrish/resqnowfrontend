import { cn } from "@/lib/utils";

/** Material Symbols Rounded glyph. The glyph names in use are listed in index.css (icon_names). */
export default function MaterialSymbol({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("rq-symbol", className)}>
      {name}
    </span>
  );
}
