import { AlertTriangle, FileAudio, Hash, Landmark, MessageSquareText, Truck } from "lucide-react";

import { apiUrl } from "@/lib/api";
import type { TechnicianJobDetails } from "@/lib/technicianJobDetails";
import { cn } from "@/lib/utils";

/** The answers, truck, landmark, plate, note and media, in a compact block. */
export function JobDetailsList({ details, className }: { details: TechnicianJobDetails; className?: string }) {
  const rows: Array<{ icon: typeof Truck; label: string; value: string; mono?: boolean }> = [];
  if (details.towTruckLabel) rows.push({ icon: Truck, label: "Truck", value: details.towTruckLabel });
  if (details.landmark) rows.push({ icon: Landmark, label: "Landmark", value: details.landmark });
  if (details.plate) rows.push({ icon: Hash, label: "Number plate", value: details.plate, mono: true });
  if (details.customerNote) rows.push({ icon: MessageSquareText, label: "Customer note", value: details.customerNote });
  const photos = details.attachments.filter((item) => item.type === "photo");
  const voices = details.attachments.filter((item) => item.type === "voice");

  return (
    <div className={cn("space-y-3", className)} data-testid="job-details">
      {details.urgent ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Urgent · {details.urgentReason}
        </div>
      ) : null}

      {details.problem.length ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Customer says</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Customer says">
            {details.problem.map((entry) => (
              <li key={entry} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length ? (
        <dl className="grid gap-2">
          {rows.map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="flex items-start gap-2 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <dt className="sr-only">{label}</dt>
              <dd className="min-w-0 font-semibold text-zinc-800 dark:text-zinc-100">
                <span className="mr-1 text-zinc-500 dark:text-zinc-400">{label}:</span>
                <span className={cn(mono && "tracking-[0.12em]")}>{value}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {photos.length || voices.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((item, index) => (
            <a
              key={item.url}
              href={apiUrl(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-16 w-16 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700"
              aria-label={`Open photo ${index + 1} from the customer`}
            >
              <img src={apiUrl(item.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
            </a>
          ))}
          {voices.map((item, index) => (
            <div key={item.url} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
              <FileAudio className="h-4 w-4 text-zinc-500" />
              <audio controls preload="none" src={apiUrl(item.url)} className="h-8 max-w-[220px]" aria-label={`Voice note ${index + 1} from the customer`} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
