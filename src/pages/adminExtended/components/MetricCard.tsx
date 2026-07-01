import { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  accent?: "blue" | "teal" | "amber" | "rose" | "slate" | "emerald";
};

const accentClasses: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  blue: "from-sky-500/10 to-red-500/5 text-red-700",
  teal: "from-teal-500/10 to-cyan-500/5 text-teal-700",
  amber: "from-amber-500/10 to-orange-500/5 text-amber-700",
  rose: "from-rose-500/10 to-red-500/5 text-rose-700",
  slate: "from-slate-500/10 to-slate-300/5 text-slate-700",
  emerald: "from-emerald-500/10 to-green-500/5 text-emerald-700",
};

export default function MetricCard({
  title,
  value,
  description,
  icon,
  accent = "slate",
}: MetricCardProps) {
  return (
    <article
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${accentClasses[accent]} p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {icon ? (
          <span className="rounded-xl bg-white/90 p-2 text-slate-700 shadow-sm">{icon}</span>
        ) : null}
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    </article>
  );
}
