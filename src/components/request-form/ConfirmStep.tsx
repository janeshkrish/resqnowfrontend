import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import type { ServiceSpec } from "@/config/requestQuestions";
import { apiFetch } from "@/lib/api";
import { formatPlate } from "@/lib/garage";
import type { Attachment } from "@/lib/requestForm";
import { cn } from "@/lib/utils";

export type ContactFields = { name: string; phone: string; email?: string };

// ---------------------------------------------------------------- summary

export function RequestSummary({
  spec, vehicleLine, chips, pickup, drop, priceLabel, priceValue, onEditVehicle, onEditProblem, onEditLocation,
}: {
  spec: ServiceSpec;
  vehicleLine: string;
  chips: string[];
  pickup: string;
  drop?: string | null;
  priceLabel: string;
  priceValue: string;
  onEditVehicle: () => void;
  onEditProblem: () => void;
  onEditLocation: () => void;
}) {
  return (
    <div className="rqf-sec">
      <p className="rqf-lbl"><span>Check your request</span></p>
      <div className="rqf-sum">
        <div className="rqf-sum-head">
          {spec.art ? (
            <span className="rqf-sum-art"><img src={spec.art} alt="" draggable={false} /></span>
          ) : (
            <span className="rqf-sum-art sos"><MaterialSymbol name="sos" /></span>
          )}
          <span className="rqf-sum-id"><b>{spec.title}</b><small>{vehicleLine}</small></span>
          <button type="button" className="rqf-change rq-press" onClick={onEditVehicle} aria-label="Change the vehicle">Edit</button>
        </div>
        {chips.length ? (
          <div className="rqf-sum-row chips">
            <MaterialSymbol name="fact_check" />
            <span className="rqf-sum-chips">{chips.map((chip) => <span key={chip} className="rqf-sum-chip">{chip}</span>)}</span>
            <button type="button" className="rqf-change rq-press" onClick={onEditProblem} aria-label="Change the answers">Edit</button>
          </div>
        ) : null}
        <div className="rqf-sum-row">
          <span className="rqf-dot" aria-hidden="true" />
          <span className="rqf-loc-id"><span className="rqf-loc-lbl">{drop ? "Pick up from" : "Help comes to"}</span><span className="rqf-loc-addr">{pickup || "Location not set"}</span></span>
          <button type="button" className="rqf-change rq-press" onClick={onEditLocation} aria-label="Change the location">Edit</button>
        </div>
        {drop ? (
          <div className="rqf-sum-row">
            <span className="rqf-square" aria-hidden="true" />
            <span className="rqf-loc-id"><span className="rqf-loc-lbl">Take it to</span><span className="rqf-loc-addr">{drop}</span></span>
          </div>
        ) : null}
        <div className="rqf-sum-price"><span>{priceLabel}</span><b>{priceValue}</b></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- plate and My garage

export function PlateAndSave({
  plate, onPlate, canSave, save, onSave, vehicleName,
}: {
  plate: string;
  onPlate: (value: string) => void;
  canSave: boolean;
  save: boolean;
  onSave: (value: boolean) => void;
  vehicleName: string;
}) {
  return (
    <div className="rqf-sec">
      <label className="rqf-plate">
        <span className="rqf-plate-ind" aria-hidden="true"><span className="rqf-chakra" />IND</span>
        <input
          type="text"
          value={plate}
          onChange={(event) => onPlate(event.target.value.toUpperCase().slice(0, 16))}
          onBlur={() => onPlate(formatPlate(plate))}
          placeholder="Number plate (optional)"
          aria-label="Number plate (optional)"
          autoComplete="off"
          autoCapitalize="characters"
        />
      </label>
      {canSave ? (
        <button
          type="button"
          className={cn("rqf-toggle save rq-press", save && "is-on")}
          role="switch"
          aria-checked={save}
          aria-label={`Save ${vehicleName} to My garage`}
          onClick={() => onSave(!save)}
        >
          <span className="rqf-row-ic"><MaterialSymbol name="garage_home" /></span>
          <span className="rqf-row-id"><b>Save to My garage</b><small>{vehicleName} · pick it in one tap next time</small></span>
          <span className="rqf-switch" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- contact

const displayPhone = (phone: string) => (phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : phone ? `+91 ${phone}` : "");

export function ContactBlock({ contact, onChange }: { contact: ContactFields; onChange: (patch: Partial<ContactFields>) => void }) {
  const complete = Boolean(contact.name.trim()) && /^\d{10}$/.test(contact.phone);
  const [open, setOpen] = useState(!complete);
  const [showEmail, setShowEmail] = useState(Boolean(contact.email));

  if (!open) {
    return (
      <div className="rqf-sec">
        <div className="rqf-contact">
          <MaterialSymbol name="call" />
          <span className="rqf-contact-id"><b>{contact.name.trim()} · {displayPhone(contact.phone)}</b><small>The helper calls you on this number</small></span>
          <button type="button" className="rqf-change rq-press" onClick={() => setOpen(true)} aria-label="Change your contact details">Edit</button>
        </div>
      </div>
    );
  }

  const phoneError = contact.phone.length > 0 && contact.phone.length < 10;
  return (
    <div className="rqf-sec">
      <p className="rqf-lbl"><span>Your contact</span><small>The helper calls you on this</small></p>
      <label className="rqf-field">
        <span className="rqf-field-lbl">Your name</span>
        <input type="text" value={contact.name} onChange={(event) => onChange({ name: event.target.value })} autoComplete="name" aria-label="Your name" />
      </label>
      <label className={cn("rqf-field", phoneError && "is-error")}>
        <span className="rqf-field-lbl">Mobile number</span>
        <span className="rqf-field-row">
          <span className="rqf-cc">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            value={contact.phone}
            onChange={(event) => onChange({ phone: event.target.value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").slice(0, 10) })}
            autoComplete="tel-national"
            aria-label="Mobile number"
            aria-invalid={phoneError}
            placeholder="10-digit number"
          />
        </span>
      </label>
      {phoneError ? <p className="rqf-error">Enter all 10 digits.</p> : null}
      {showEmail ? (
        <label className="rqf-field">
          <span className="rqf-field-lbl">Email for the receipt (optional)</span>
          <input type="email" value={contact.email ?? ""} onChange={(event) => onChange({ email: event.target.value.trim() })} autoComplete="email" aria-label="Email (optional)" />
        </label>
      ) : (
        <button type="button" className="rqf-link rq-press" onClick={() => setShowEmail(true)}><MaterialSymbol name="add" />Add email for the receipt (optional)</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- notes, photo and voice

const MAX_RECORDING_MS = 60_000;

async function uploadFile(file: Blob, name: string): Promise<string> {
  const body = new FormData();
  body.append("file", file, name);
  const response = await apiFetch("/api/upload", { method: "POST", body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data?.url !== "string") throw new Error(data?.error || "Upload failed");
  return data.url;
}

const recorderType = () => {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
};

export function NotesBlock({
  note, onNote, attachments, onAttachments, onBusy,
}: {
  note: string;
  onNote: (value: string) => void;
  attachments: Attachment[];
  onAttachments: (next: Attachment[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(0);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  useEffect(() => onBusy(uploading > 0 || recording), [onBusy, recording, uploading]);
  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const add = async (blob: Blob, type: Attachment["type"], name: string) => {
    setUploading((count) => count + 1);
    try {
      const url = await uploadFile(blob, name);
      onAttachments([...attachmentsRef.current, { type, url, name }]);
    } catch {
      toast.error(type === "photo" ? "The photo didn’t upload" : "The voice note didn’t upload", { description: "Check your connection and try again." });
    } finally {
      setUploading((count) => count - 1);
    }
  };

  const onPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Use a JPG, PNG or WEBP photo");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("That photo is over 10 MB");
      return;
    }
    void add(file, "photo", file.name || "photo.jpg");
  };

  const stopRecording = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    recorderRef.current?.stop();
  };

  const startRecording = async () => {
    const type = recorderType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice notes don’t work in this browser", { description: "Type the note instead." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        recorderRef.current = null;
        const mime = (recorder.mimeType || type || "audio/webm").split(";")[0];
        const blob = new Blob(chunks, { type: mime });
        if (blob.size) void add(blob, "voice", `voice-note.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      timerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      toast.error("Microphone not allowed", { description: "Allow the microphone, or type the note instead." });
    }
  };

  const photos = attachments.filter((item) => item.type === "photo").length;
  const voices = attachments.filter((item) => item.type === "voice").length;

  return (
    <div className="rqf-sec">
      <p className="rqf-lbl"><label htmlFor="rqf-notes">Anything else?</label><small>Optional</small></p>
      <div className="rqf-notes">
        <input
          id="rqf-notes"
          className="rqf-input"
          type="text"
          value={note}
          onChange={(event) => onNote(event.target.value.slice(0, 500))}
          placeholder={recording ? "Recording… tap the mic to stop" : "Type or record, any language"}
          autoComplete="off"
        />
        <button type="button" className="rqf-media rq-press" aria-label="Add a photo" onClick={() => fileRef.current?.click()} disabled={attachments.length >= 4}>
          <MaterialSymbol name="photo_camera" />
        </button>
        <button
          type="button"
          className={cn("rqf-media rq-press", recording && "rec")}
          aria-label={recording ? "Stop recording" : "Record a voice note"}
          aria-pressed={recording}
          onClick={() => (recording ? stopRecording() : void startRecording())}
          disabled={!recording && attachments.length >= 4}
        >
          <MaterialSymbol name={recording ? "stop" : "mic"} />
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={onPhoto} />
      </div>
      {attachments.length || uploading ? (
        <div className="rqf-attach" aria-live="polite">
          {attachments.map((item, index) => (
            <span key={item.url} className="rqf-attach-chip">
              <MaterialSymbol name={item.type === "photo" ? "image" : "graphic_eq"} />
              {item.type === "photo" ? (photos > 1 ? `Photo ${attachments.slice(0, index + 1).filter((a) => a.type === "photo").length}` : "Photo") : voices > 1 ? `Voice note ${attachments.slice(0, index + 1).filter((a) => a.type === "voice").length}` : "Voice note"}
              <button type="button" aria-label={`Remove ${item.type === "photo" ? "photo" : "voice note"}`} onClick={() => onAttachments(attachments.filter((entry) => entry.url !== item.url))}>
                <MaterialSymbol name="close" />
              </button>
            </span>
          ))}
          {uploading ? <span className="rqf-attach-chip is-busy"><MaterialSymbol name="progress_activity" />Uploading…</span> : null}
        </div>
      ) : null}
    </div>
  );
}
