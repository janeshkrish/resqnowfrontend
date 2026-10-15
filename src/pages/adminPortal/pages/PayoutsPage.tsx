import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import {
  downloadPayoutCsv, getCashDues, listPayouts, listUnsettled, listWallets, listWithdrawals, markWithdrawalPaid, payWholeWallet, rejectWithdrawal, sendToTechnicians, settleOnePayment,
  type Wallet, type Withdrawal,
} from "../api/portalApi";
import { ago, clock, count, day, initials, paymentMethod, rupees } from "../format";
import { Btn, Card, Cell, Dialog, Empty, ErrorState, Icon, IconBtn, Kpis, Loading, Note, Pill, PillTabs, Row, Table, Two, usePortalHeader } from "../ui";

// Pay technicians by UPI, then record the UTR so their app shows it paid.

type Tab = "requests" | "wallets" | "payments" | "dues" | "paid";
const WEEK = 7 * 86_400_000;
const PAID = ["paid", "completed", "success", "processed"];
const copy = async (text: string, what: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Could not copy. Select the text instead."); }
};
const upiLink = (upi: string | null, name: string | null, amount: number) => (upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name || "ResQNow partner")}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("ResQNow payout")}` : null);
const Upi = ({ value }: { value: string | null }) => value ? <span className="mn-upi"><span>{value}</span><button type="button" className="ap-btn is-icon is-sm is-ghost" aria-label={`Copy ${value}`} onClick={(event) => { event.stopPropagation(); void copy(value, "UPI ID"); }}><Icon name="content_copy" /></button></span> : <span className="ap-faint">No UPI ID</span>;

type PayTarget = { kind: "withdrawal"; row: Withdrawal } | { kind: "wallet"; row: Wallet } | { kind: "payment"; id: number; requestId: number | null; technician: string | null; upi: string | null; amount: number };

export default function PayoutsPage() {
  usePortalHeader("Payouts", "Pay technicians by UPI, then record the UTR so their app shows it paid.");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("requests");
  const [paying, setPaying] = useState<PayTarget | null>(null);
  const [declining, setDeclining] = useState<Withdrawal | null>(null);
  const [exporting, setExporting] = useState(false);
  const pending = useQuery({ queryKey: ["portal", "payouts", "pending"], queryFn: async () => {
    const [waiting, processing] = await Promise.all([listWithdrawals("pending"), listWithdrawals("processing")]);
    return [...waiting.data, ...processing.data].sort((a, b) => Date.parse(a.createdAt || "") - Date.parse(b.createdAt || ""));
  }, refetchInterval: 60_000 });
  const wallets = useQuery({ queryKey: ["portal", "payouts", "wallets"], queryFn: listWallets, refetchInterval: 120_000 });
  const history = useQuery({ queryKey: ["portal", "payouts", "history"], queryFn: listPayouts, refetchInterval: 120_000 });
  const unsettled = useQuery({ queryKey: ["portal", "payouts", "unsettled"], queryFn: listUnsettled, enabled: tab === "payments" });
  const dues = useQuery({ queryKey: ["portal", "cash-dues"], queryFn: getCashDues, refetchInterval: 120_000 });
  useAdminEvents(() => void queryClient.invalidateQueries({ queryKey: ["portal", "payouts"] }), 2_000, ["admin:payout_update", "admin:payment_update"]);

  const waiting = pending.data || [];
  const waitingSum = waiting.reduce((total, row) => total + row.amount, 0);
  const paidWeek = (history.data?.data || []).filter((row) => PAID.includes(row.status.toLowerCase()) && Date.now() - Date.parse(row.processedAt || row.createdAt || "") < WEEK);
  const walletRows = (wallets.data?.data || []).filter((row) => row.withdrawableBalance > 0);
  const dueRows = dues.data || [];
  const exportCsv = async () => {
    setExporting(true);
    try {
      const url = URL.createObjectURL(await downloadPayoutCsv());
      const link = document.createElement("a");
      link.href = url;
      link.download = `resqnow-payout-queue-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success("Payout CSV ready for the bank's bulk upload");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };
  const remindDues = async () => {
    const ids = dueRows.map((row) => row.technicianId);
    if (!ids.length) return;
    try {
      await sendToTechnicians("Cash dues to ResQNow", "You have cash dues from recent cash jobs. They are taken from your next payout, or you can pay them by UPI from the Earnings screen.", ids);
      toast.success(`Reminder sent to ${ids.length} technician${ids.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reminder.");
    }
  };

  const oldest = waiting[0]?.createdAt;
  return (
    <div className="adm-stack" data-testid="payouts-page">
      <Kpis items={[
        { label: "Waiting to be paid", value: rupees(waitingSum), note: `${waiting.length} request${waiting.length === 1 ? "" : "s"}${oldest ? ` · oldest ${ago(oldest).replace(" ago", "")}` : ""}`, warn: waiting.length > 0, testId: "kpi-waiting" },
        { label: "Paid this week", value: rupees(paidWeek.reduce((total, row) => total + row.amount, 0)), note: `${paidWeek.length} payout${paidWeek.length === 1 ? "" : "s"}` },
        { label: "In technician wallets", value: rupees(walletRows.reduce((total, row) => total + row.withdrawableBalance, 0)), note: `${walletRows.length} can withdraw` },
        { label: "Cash dues to collect", value: rupees(dueRows.reduce((total, row) => total + row.amount, 0)), note: `from ${dueRows.length} technician${dueRows.length === 1 ? "" : "s"}` },
      ]} />
      <div className="ap-bar">
        <PillTabs<Tab> label="Payouts" value={tab} onChange={setTab} items={[
          { key: "requests", label: "Requests", count: waiting.length, warn: waiting.length > 0 }, { key: "wallets", label: "Wallets", count: walletRows.length },
          { key: "payments", label: "By payment", count: unsettled.data?.pagination.total }, { key: "dues", label: "Cash dues", count: dueRows.length }, { key: "paid", label: "Paid" },
        ]} />
        <Btn icon="download" disabled={exporting} onClick={() => void exportCsv()}>{exporting ? "Exporting…" : "Export payout CSV"}</Btn>
      </div>
      <div className="mn-grid">
        <div className="mn-col">
          {tab === "requests" ? (pending.isError ? <ErrorState error={pending.error} onRetry={() => void pending.refetch()} /> : !pending.data ? <Loading height={240} /> : waiting.length === 0 ? <Empty icon="task_alt" title="Nobody is waiting for a payout" /> : (
            <Table label="Waiting payouts" testId="payout-requests" cols="118px minmax(0,1fr) minmax(0,1fr) 84px 212px" minWidth={760} head={["Asked", "Technician", "UPI ID", "Amount", ""]}
              foot={<span>Pay the oldest first · technicians see “paid” with the UTR</span>}>
              {waiting.map((row) => {
                const old = row.createdAt && Date.now() - Date.parse(row.createdAt) > 12 * 3_600_000;
                return (
                  <Row key={row.id} cols="118px minmax(0,1fr) minmax(0,1fr) 84px 212px" label={`Payout for ${row.technicianName}`}>
                    <Cell><Two top={day(row.createdAt)} bottom={`${clock(row.createdAt)} · ${ago(row.createdAt)}`} tone={old ? "warn" : undefined} /></Cell>
                    <Cell><span className="ap-who"><span className="ap-av is-sm" aria-hidden="true">{initials(row.technicianName)}</span><div><b>{row.technicianName || `#${row.technicianId}`}</b><span>{row.status === "processing" ? "being paid" : row.note || ""}</span></div></span></Cell>
                    <Cell><Upi value={row.upiId} /></Cell>
                    <Cell className="ap-num ap-strong">{rupees(row.amount)}</Cell>
                    <Cell><span className="ap-acts">
                      {row.upiLink || row.upiId ? <a className="ap-btn is-sm" href={row.upiLink || upiLink(row.upiId, row.beneficiaryName, row.amount) || "#"}>Pay by UPI</a> : null}
                      <Btn size="sm" variant="dark" onClick={() => setPaying({ kind: "withdrawal", row })}>Mark paid</Btn>
                      <IconBtn icon="close" size="sm" label={`Turn down ${row.technicianName}`} onClick={() => setDeclining(row)} />
                    </span></Cell>
                  </Row>
                );
              })}
            </Table>
          )) : null}
          {tab === "wallets" ? (wallets.isError ? <ErrorState error={wallets.error} /> : !wallets.data ? <Loading height={240} /> : walletRows.length === 0 ? <Empty icon="account_balance_wallet" title="No money waiting in wallets" /> : (
            <Table label="Technician wallets" testId="wallets" cols="minmax(0,1fr) minmax(0,1.1fr) 96px 96px 96px 150px" minWidth={760} head={["Technician", "UPI ID", { label: "Can withdraw", right: true }, { label: "Earned", right: true }, { label: "Paid out", right: true }, ""]}>
              {walletRows.map((row) => (
                <Row key={row.technicianId} cols="minmax(0,1fr) minmax(0,1.1fr) 96px 96px 96px 150px" label={`Wallet of ${row.technicianName}`}>
                  <Cell><Link className="ap-strong" style={{ textDecoration: "none" }} to={`/admin/technicians/${row.technicianId}?tab=payouts`}>{row.technicianName || `#${row.technicianId}`}</Link></Cell>
                  <Cell><Upi value={row.upiId} /></Cell>
                  <Cell right className="ap-num ap-strong">{rupees(row.withdrawableBalance)}</Cell>
                  <Cell right className="ap-num">{rupees(row.totalEarned)}</Cell>
                  <Cell right className="ap-num">{rupees(row.totalPaidOut)}</Cell>
                  <Cell><Btn size="sm" variant="dark" onClick={() => setPaying({ kind: "wallet", row })}>Pay whole wallet</Btn></Cell>
                </Row>
              ))}
            </Table>
          )) : null}
          {tab === "payments" ? (unsettled.isError ? <ErrorState error={unsettled.error} /> : !unsettled.data ? <Loading height={240} /> : unsettled.data.data.length === 0 ? <Empty icon="task_alt" title="Every payment is settled" /> : (
            <Table label="Settlement by payment" testId="by-payment" cols="80px 70px minmax(0,1fr) 96px 100px 150px" minWidth={680} head={["Paid", "Request", "Technician", { label: "Customer paid", right: true }, { label: "Their share", right: true }, ""]}
              foot={<span>Payments whose technician share is not settled yet</span>}>
              {unsettled.data.data.map((row) => (
                <Row key={row.transactionId} cols="80px 70px minmax(0,1fr) 96px 100px 150px" tight label={`Payment ${row.transactionId}`}>
                  <Cell className="ap-num ap-faint">{day(row.date)}</Cell>
                  <Cell className="ap-strong ap-num">{row.requestId ? `#${row.requestId}` : "—"}</Cell>
                  <Cell>{row.technician || "—"}</Cell>
                  <Cell right className="ap-num">{rupees(row.amount)}</Cell>
                  <Cell right className="ap-num ap-strong">{rupees(row.technicianAmount)}</Cell>
                  <Cell><Btn size="sm" variant="dark" onClick={() => setPaying({ kind: "payment", id: row.transactionId, requestId: row.requestId, technician: row.technician, upi: row.upiId, amount: row.technicianAmount })}>Settle this payment</Btn></Cell>
                </Row>
              ))}
            </Table>
          )) : null}
          {tab === "dues" ? (dues.isError ? <ErrorState error={dues.error} /> : !dues.data ? <Loading height={200} /> : dueRows.length === 0 ? <Empty icon="task_alt" title="No cash dues" /> : (
            <Table label="Cash dues" testId="cash-dues" cols="minmax(0,1fr) 120px 80px 110px 96px" minWidth={600} head={["Technician", "Phone", { label: "Jobs", right: true }, "Oldest", { label: "Owes", right: true }]}
              foot={<><span>ResQNow's share of cash jobs · taken from the next payout, or paid by UPI</span><Btn size="sm" icon="notifications" onClick={() => void remindDues()}>Remind all</Btn></>}>
              {dueRows.map((row) => (
                <Row key={row.technicianId} cols="minmax(0,1fr) 120px 80px 110px 96px" tight>
                  <Cell><Link className="ap-strong" style={{ textDecoration: "none" }} to={`/admin/technicians/${row.technicianId}?tab=payouts`}>{row.name || `#${row.technicianId}`}</Link></Cell>
                  <Cell className="ap-faint">{row.phoneMasked || "—"}</Cell>
                  <Cell right className="ap-num">{count(row.jobs)}</Cell>
                  <Cell className="ap-faint">{row.oldest ? ago(row.oldest) : "—"}</Cell>
                  <Cell right className={`ap-num ap-strong${row.amount >= 1000 ? " ap-warn" : ""}`}>{rupees(row.amount)}</Cell>
                </Row>
              ))}
            </Table>
          )) : null}
          {tab === "paid" || tab === "requests" ? (history.isError ? <ErrorState error={history.error} /> : !history.data ? <Loading height={160} /> : (
            <Table label="Recently paid" testId="paid" cols="110px minmax(0,1fr) minmax(0,1.1fr) 96px 150px" minWidth={700} head={["Paid", "Technician", "UTR", { label: "Amount", right: true }, "By"]}
              foot={<span>{tab === "requests" ? `Recently paid · ${paidWeek.length} this week` : `The latest ${history.data.data.length} payouts`}</span>}>
              {(tab === "requests" ? history.data.data.slice(0, 3) : history.data.data).map((row) => (
                <Row key={row.id} cols="110px minmax(0,1fr) minmax(0,1.1fr) 96px 150px" tight>
                  <Cell><Two top={day(row.processedAt || row.createdAt)} bottom={`${clock(row.processedAt || row.createdAt)} · ${paymentMethod(row.payoutMethod?.includes("upi") ? "upi" : row.payoutMethod)}`} /></Cell>
                  <Cell>{row.technicianName || `#${row.technicianId}`}</Cell>
                  <Cell className="ap-num">{row.externalReference || "—"}</Cell>
                  <Cell right className="ap-num ap-strong">{rupees(row.amount)}</Cell>
                  <Cell><span className="ap-row" style={{ gap: 6 }}>{row.processedBy ? row.processedBy.split("@")[0] : ""}<Pill tone={PAID.includes(row.status.toLowerCase()) ? "ok" : "warn"}>{PAID.includes(row.status.toLowerCase()) ? "Paid" : row.status}</Pill></span></Cell>
                </Row>
              ))}
            </Table>
          )) : null}
        </div>
        <div className="mn-col">
          <Card title="How to pay" style={{ gap: 10 }}>
            <ol className="mn-steps">
              <li><i>1</i><span><b>Pay by UPI</b> from the company account. The button opens your UPI app with the amount filled in.</span></li>
              <li><i>2</i><span><b>Copy the UTR</b> from the bank's confirmation.</span></li>
              <li><i>3</i><span><b>Mark paid</b> and paste it. The technician's app shows the payout with the UTR.</span></li>
            </ol>
            <p className="ad-hint"><Icon name="info" />Two ways: the whole wallet (what they asked to withdraw), or one payment at a time from By payment, for example when reconciling with the bank statement.</p>
          </Card>
          {tab !== "dues" ? (
            <Card title="Cash dues to collect" aside={<Btn size="sm" icon="notifications" disabled={!dueRows.length} onClick={() => void remindDues()}>Remind all</Btn>} style={{ gap: 6 }} testId="dues-card">
              <p className="ap-faint" style={{ fontSize: 12, fontWeight: 600 }}>ResQNow's share of cash jobs. Taken from the next payout, or paid by UPI.</p>
              {dueRows.length === 0 ? <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None</p> : dueRows.slice(0, 6).map((row) => (
                <div key={row.technicianId} className="mn-due"><span className="ap-av is-sm" aria-hidden="true">{initials(row.name)}</span><div><b>{row.name || `#${row.technicianId}`}</b><span>{row.jobs} cash job{row.jobs === 1 ? "" : "s"}{row.oldest ? ` · oldest ${ago(row.oldest).replace(" ago", "")}` : ""}</span></div><em className={row.amount >= 1000 ? "is-warn" : undefined}>{rupees(row.amount)}</em></div>
              ))}
            </Card>
          ) : null}
        </div>
      </div>
      {paying ? <PayDialog target={paying} onClose={() => setPaying(null)} /> : null}
      {declining ? <DeclineDialog row={declining} onClose={() => setDeclining(null)} /> : null}
    </div>
  );
}

function PayDialog({ target, onClose }: { target: PayTarget; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = target.kind === "withdrawal" ? target.row.technicianName : target.kind === "wallet" ? target.row.technicianName : target.technician;
  const upi = target.kind === "withdrawal" ? target.row.upiId : target.kind === "wallet" ? target.row.upiId : target.upi;
  const amount = target.kind === "withdrawal" ? target.row.amount : target.kind === "wallet" ? target.row.withdrawableBalance : target.amount;
  const link = target.kind === "withdrawal" && target.row.upiLink ? target.row.upiLink : upiLink(upi, name, amount);
  const utrOk = /^[A-Za-z0-9]{10,22}$/.test(utr.trim());
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body = { externalReference: utr.trim(), notes: note.trim() || undefined };
      if (target.kind === "withdrawal") await markWithdrawalPaid(target.row.id, body);
      else if (target.kind === "wallet") await payWholeWallet({ technicianId: target.row.technicianId, amount, ...body, idempotencyKey: `portal-wallet-${target.row.technicianId}-${utr.trim()}` });
      else await settleOnePayment(target.id, body);
      toast.success(`${rupees(amount)} marked paid to ${name || "the technician"}`);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not mark it paid.");
    } finally {
      setBusy(false);
    }
  };
  const what = target.kind === "payment" ? `their share of #${target.requestId}` : target.kind === "wallet" ? "the whole wallet" : "what they asked to withdraw";
  return (
    <Dialog label="Mark payout paid" title={`Mark ${rupees(amount)} paid to ${name || "the technician"}`} width={600} onClose={onClose} testId="pay-dialog"
      sub={target.kind === "withdrawal" ? `Asked ${ago(target.row.createdAt)}. Their wallet goes down by ${rupees(amount)} and the Partner app shows the payout with the UTR.` : `Pays ${what}. The Partner app shows the payout with the UTR.`}
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="dark" icon="check" disabled={!utrOk || busy} onClick={() => void save()}>{busy ? "Saving…" : `Mark ${rupees(amount)} paid`}</Btn></>}>
      <div className="mn-sum">
        <div><span>Technician</span><b>{name || "—"}</b></div>
        <div><span>UPI ID</span><b style={{ fontSize: 14 }}>{upi || "None on file"}</b></div>
        <div><span>Amount</span><b>{rupees(amount)}</b><small>{what}</small></div>
      </div>
      <div className="mn-step"><i>1</i><div><b>Pay from the company account</b><div className="ap-row" style={{ gap: 8, flexWrap: "wrap" }}>
        {link ? <a className="ap-btn" href={link}><Icon name="open_in_new" />Open UPI app</a> : null}
        {upi ? <Btn icon="content_copy" onClick={() => void copy(upi, "UPI ID")}>Copy UPI ID</Btn> : <Note tone="warn">No UPI ID on file; pay to their bank account.</Note>}
      </div></div></div>
      <div className="mn-step"><i>2</i><div className="ap-field" style={{ flex: "1 1 auto" }}><label htmlFor="pay-utr">Paste the UTR from the bank</label><input id="pay-utr" className="ap-num" value={utr} onChange={(event) => setUtr(event.target.value.replace(/\s/g, ""))} placeholder="For example 429115306712" /><small>10 to 22 letters or digits. A UTR can only be used once.</small></div></div>
      <div className="mn-step"><i>3</i><div className="ap-field" style={{ flex: "1 1 auto" }}><label htmlFor="pay-note">Note, if any</label><input id="pay-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" /></div></div>
      {error ? <Note tone="bad" icon="error">{error}</Note> : null}
    </Dialog>
  );
}

function DeclineDialog({ row, onClose }: { row: Withdrawal; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await rejectWithdrawal(row.id, reason.trim());
      toast.success(`Payout to ${row.technicianName || "the technician"} turned down`);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not turn it down.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog label="Turn down payout" title={`Turn down ${rupees(row.amount)} for ${row.technicianName || "the technician"}?`} sub="The money stays in their wallet. They see the reason in the Partner app." width={520} onClose={onClose} testId="decline-dialog"
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Keep it</Btn><Btn variant="danger" disabled={!reason.trim() || busy} onClick={() => void save()}>{busy ? "Saving…" : "Turn down"}</Btn></>}>
      <div className="ap-field"><label htmlFor="decline-reason">Reason</label><input id="decline-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: the UPI ID name does not match" /></div>
      {error ? <Note tone="bad" icon="error">{error}</Note> : null}
    </Dialog>
  );
}
