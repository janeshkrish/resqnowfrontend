import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { toggleAdminTechnicianVisibility } from "@/pages/adminExtended/api/adminExtendedApi";
import { deleteTechnician } from "./api/portalApi";
import { rupees } from "./format";
import { Btn, Dialog, Icon } from "./ui";

/** Hiding keeps the record and stops new job offers; dispatch skips hidden technicians. */
export function useVisibility() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const set = async (technicianId: number, name: string, visible: boolean) => {
    setBusy(true);
    try {
      await toggleAdminTechnicianVisibility({ technicianId, isVisible: visible, note: visible ? "Shown again by admin." : "Hidden from new jobs by admin." });
      toast.success(visible ? `${name} is shown again and gets new jobs` : `${name} is hidden: no new jobs`);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change this.");
    } finally {
      setBusy(false);
    }
  };
  return { set, busy };
}

export function DeleteTechnicianDialog({ technician, onClose, onDeleted }: {
  technician: { id: number; name: string; onJob?: boolean; dues?: number };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const visibility = useVisibility();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const match = typed.trim().toUpperCase() === technician.name.trim().toUpperCase();
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteTechnician(technician.id);
      toast.success(`${technician.name} deleted`);
      onDeleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog label={`Delete ${technician.name}`} title={`Delete ${technician.name} for good?`} sub="This removes the technician's account and their history with ResQNow." onClose={onClose} width={580} testId="delete-technician"
      footNote="Saved in the audit log"
      foot={<>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn icon="visibility_off" disabled={visibility.busy} onClick={async () => { await visibility.set(technician.id, technician.name, false); onClose(); }}>Hide instead</Btn>
        <Btn variant="hot" icon="delete" disabled={!match || busy || technician.onJob} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete technician"}</Btn>
      </>}>
      <div className="ex-checks">
        <div className={`ex-check${technician.onJob ? " is-bad" : ""}`}><Icon name={technician.onJob ? "error" : "check_circle"} /><div><b>{technician.onJob ? "On a live job now" : "Not on a live job"}</b><span>Deleting is refused while a technician has an active request.</span></div></div>
        <div className={`ex-check${technician.dues ? " is-bad" : " is-na"}`}><Icon name={technician.dues ? "error" : "remove_circle"} /><div><b>{technician.dues ? `Owes ${rupees(technician.dues)} in cash dues` : "No cash dues"}</b><span>Their wallet, dues, payouts, reviews, approval history and notes are deleted with the account.</span></div></div>
        <div className="ex-check is-na"><Icon name="remove_circle" /><div><b>Past invoices and refunds stay</b><span>They remain for the records, without the technician's name.</span></div></div>
      </div>
      <div className="ap-note"><Icon name="visibility_off" /><span><b>Hide instead</b> keeps the history and stops new jobs. That is usually enough.</span></div>
      <div className="ap-field">
        <label htmlFor="confirm-delete">Type {technician.name.toUpperCase()} to confirm</label>
        <input id="confirm-delete" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
      </div>
      {error ? <div className="ap-note is-bad" role="alert"><Icon name="error" /><span>{error}</span></div> : null}
    </Dialog>
  );
}
