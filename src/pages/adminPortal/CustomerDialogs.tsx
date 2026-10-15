import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createCustomer, deleteCustomer, updateCustomer } from "./api/portalApi";
import { Btn, Dialog, Note } from "./ui";

// Adding, editing and deleting customer accounts, as the old portal allowed: name, email and password.

export function AddCustomerDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const problem = !name.trim() ? "Write their full name." : !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Write a valid email." : password.length < 8 ? "Use a password of 8 or more characters." : password !== confirm ? "The passwords do not match." : "";
  const save = async () => {
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError("");
    try {
      const created = await createCustomer({ name: name.trim(), email: email.trim().toLowerCase(), password });
      toast.success(`${name.trim()} added · a confirmation email was sent`);
      await queryClient.invalidateQueries({ queryKey: ["portal", "customers"] });
      onAdded(created.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not add the customer.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog label="Add customer" title="Add customer" sub="For someone who called in. A confirmation email is sent to them." width={560} onClose={onClose} testId="add-customer"
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="dark" icon="person_add" disabled={busy} onClick={() => void save()}>{busy ? "Adding…" : "Create customer"}</Btn></>}>
      <div className="ap-field"><label htmlFor="c-name">Full name *</label><input id="c-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="ap-field"><label htmlFor="c-email">Email *</label><input id="c-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className="ad-row2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="ap-field"><label htmlFor="c-pass">Password *</label><input id="c-pass" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><small>8 or more characters</small></div>
        <div className="ap-field"><label htmlFor="c-pass2">Confirm password *</label><input id="c-pass2" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div>
      </div>
      <Note>Share the password with them on the call; they can change it after signing in.</Note>
      {error ? <Note tone="bad" icon="error">{error}</Note> : null}
    </Dialog>
  );
}

export function EditCustomerDialog({ customer, onClose, onDeleted }: {
  customer: { id: number; name: string | null; email: string | null; phoneMasked: string | null; liveRequestId: number | null };
  onClose: () => void; onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(customer.name || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (!name.trim()) { setError("Write their full name."); return; }
    if (password && password.length < 8) { setError("Use a password of 8 or more characters, or leave it blank."); return; }
    setBusy("save");
    setError("");
    try {
      await updateCustomer(customer.id, { name: name.trim(), ...(password ? { password } : {}) });
      toast.success(`${name.trim()} saved`);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy("delete");
    setError("");
    try {
      await deleteCustomer(customer.id);
      toast.success(`${customer.name || "Customer"} deleted`);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      onDeleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete.");
    } finally {
      setBusy(null);
    }
  };
  const live = customer.liveRequestId != null;
  return (
    <Dialog label={`Edit ${customer.name || "customer"}`} title={`Edit ${customer.name || "customer"}`} sub="Name and password, as the old portal allowed." width={580} onClose={onClose} testId="edit-customer"
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="dark" disabled={busy != null} onClick={() => void save()}>{busy === "save" ? "Saving…" : "Save changes"}</Btn></>}>
      <div className="ap-field"><label htmlFor="e-name">Full name *</label><input id="e-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="ap-field"><label htmlFor="e-pass">New password</label><input id="e-pass" type="password" autoComplete="new-password" placeholder="Leave blank to keep the current one" value={password} onChange={(event) => setPassword(event.target.value)} /><small>8 or more characters</small></div>
      <div className="ap-field"><label htmlFor="e-sign">Email and phone</label><input id="e-sign" readOnly value={[customer.email, customer.phoneMasked].filter(Boolean).join(" · ") || "—"} style={{ background: "#F9FAFB", color: "#667085" }} /><small>Not changed here; they sign in with these.</small></div>
      <div className="ex-danger">
        <div className="ex-row">
          <div><b>Delete this customer</b><span>Removes the account with their saved vehicles, reviews and invoices, for good.{live ? ` Not possible during a live request: they are on #${customer.liveRequestId} now.` : ""}</span></div>
          {confirming ? <Btn variant="hot" icon="delete" disabled={busy != null || live} onClick={() => void remove()}>{busy === "delete" ? "Deleting…" : "Yes, delete for good"}</Btn>
            : <Btn variant="danger" icon="delete" disabled={live} onClick={() => setConfirming(true)}>Delete</Btn>}
        </div>
      </div>
      {error ? <Note tone="bad" icon="error">{error}</Note> : null}
    </Dialog>
  );
}
