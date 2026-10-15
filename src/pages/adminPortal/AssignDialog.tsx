import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { assignAdminRequest, reassignCommandCenterJob } from "@/pages/adminExtended/api/adminExtendedApi";
import { addRequestNote } from "@/pages/adminExtended/api/adminMonitorApi";
import { getDispatchAudit } from "./api/portalApi";
import { dispatchReason, initials, service } from "./format";
import { Btn, Dialog, Empty, Icon, Loading, Note, Radio } from "./ui";

// Moving a job: either send it out again to the nearest who can take it (as a new search), or give it straight to one technician.

type Mode = "offer" | "assign";
export type AssignTarget = { id: number; service: string | null; customer: string | null; address: string | null; technicianId: number | null; technicianName: string | null };
const RADII = [5, 10, 15, 35];

export function AssignDialog({ request, onClose, initialMode = "offer" }: { request: AssignTarget; onClose: () => void; initialMode?: Mode }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [radius, setRadius] = useState(10);
  const [picked, setPicked] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const audit = useQuery({ queryKey: ["portal", "dispatch", request.id], queryFn: () => getDispatchAudit(request.id) });
  const people = (audit.data?.technicians || []).filter((row) => row.technician_id !== request.technicianId);
  const able = people.filter((row) => row.eligible);
  const unable = people.filter((row) => !row.eligible);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "offer") {
        const result = (await reassignCommandCenterJob({ requestId: request.id, radiusKm: radius, maxCandidates: 5 })) as { success?: boolean; message?: string; candidatesFound?: number };
        if (result && result.success === false) throw new Error(result.message || "No technician within that distance can take it.");
        toast.success(`#${request.id} sent out again${result?.candidatesFound ? ` to ${result.candidatesFound} technician${result.candidatesFound === 1 ? "" : "s"}` : ""}`);
      } else {
        if (!picked) throw new Error("Pick a technician first.");
        await assignAdminRequest({ requestId: request.id, technicianId: picked });
        const name = people.find((row) => row.technician_id === picked)?.name || `technician #${picked}`;
        toast.success(`#${request.id} given to ${name}`);
      }
      if (reason.trim()) await addRequestNote(request.id, `${mode === "offer" ? "Sent out again" : "Assigned directly"}: ${reason.trim()}`).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not move the job.");
    } finally {
      setBusy(false);
    }
  };

  const who = request.technicianName ? `${request.technicianName} is taken off the job.` : "";
  return (
    <Dialog label={`Reassign request ${request.id}`} title={`Reassign #${request.id} · ${service(request.service)}`} width={640} testId="assign-dialog" onClose={onClose}
      sub={`${request.customer || "The customer"}${request.address ? ` is waiting at ${request.address}` : ""}. ${who}`}
      footNote="Saved in the request's log"
      foot={<>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="dark" icon={mode === "offer" ? "send" : "assignment_ind"} disabled={busy || (mode === "assign" && !picked)} onClick={() => void submit()}>
          {busy ? "Working…" : mode === "offer" ? `Send out within ${radius} km` : `Give the job to ${people.find((row) => row.technician_id === picked)?.name || "…"}`}
        </Btn>
      </>}>
      <div className="ap-seg" role="radiogroup" aria-label="How to move the job">
        <button type="button" role="radio" aria-checked={mode === "offer"} className={mode === "offer" ? "is-on" : undefined} onClick={() => setMode("offer")}><Icon name="send" />Send offers again</button>
        <button type="button" role="radio" aria-checked={mode === "assign"} className={mode === "assign" ? "is-on" : undefined} onClick={() => setMode("assign")}><Icon name="assignment_ind" />Assign directly</button>
      </div>
      {mode === "offer" ? (
        <>
          <p className="ad-hint"><Icon name="info" />Like a new search: the nearest technicians who can take it get an offer, best first. The first to accept gets the job.</p>
          <div className="ap-field">
            <label htmlFor="assign-radius">Look within</label>
            <select id="assign-radius" value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
              {RADII.map((km) => <option key={km} value={km}>{km} km</option>)}
            </select>
          </div>
        </>
      ) : <p className="ad-hint"><Icon name="info" />The job goes straight to the technician you pick. Refused if the current technician has already agreed a price with the customer.</p>}
      <p className="ap-cap">{service(request.service)} · {able.length} can take it now{audit.data ? ` · ${unable.length} can't` : ""}</p>
      {audit.isLoading ? <Loading height={140} /> : able.length === 0 ? <Empty icon="person_search" title="Nobody can take it right now" sub="Try sending it out within a wider distance." /> : (
        <div className="ra-list" role={mode === "assign" ? "radiogroup" : "list"} aria-label="Technicians who can take it">
          {able.slice(0, 8).map((row) => {
            const on = mode === "assign" && picked === row.technician_id;
            const body = (
              <>
                <span className="ap-av" aria-hidden="true">{initials(row.name)}</span>
                <div><b>{row.name || `Technician #${row.technician_id}`}</b><span>{service(row.service_type)} · works within {row.service_area_range ?? "—"} km{row.dispatch_offer_status ? ` · offer ${row.dispatch_offer_status}` : ""}</span></div>
                <div className="ra-eta"><b>{row.distance_km == null ? "—" : `${row.distance_km} km`}</b><span>away</span></div>
              </>
            );
            return mode === "assign" ? (
              <div key={row.technician_id} className={`ra-opt${on ? " is-on" : ""}`}><Radio on={on} name="assign-pick" onChange={() => setPicked(row.technician_id)}><span className="ap-row" style={{ gap: 12 }}>{body}</span></Radio></div>
            ) : <div key={row.technician_id} className="ra-opt" role="listitem">{body}</div>;
          })}
        </div>
      )}
      {unable.length ? <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>Can't take it: {Object.entries(unable.flatMap((row) => row.reject_reasons.slice(0, 1)).reduce<Record<string, number>>((all, code) => ({ ...all, [code]: (all[code] || 0) + 1 }), {})).map(([code, n]) => `${n} ${dispatchReason(code).toLowerCase()}`).join(" · ")}</p> : null}
      <div className="ap-field">
        <label htmlFor="assign-reason">Reason, for the log</label>
        <input id="assign-reason" value={reason} placeholder="For example: not moving for 5 min and not answering calls" onChange={(event) => setReason(event.target.value)} />
      </div>
      {error ? <Note tone="bad" icon="error">{error}</Note> : null}
    </Dialog>
  );
}
