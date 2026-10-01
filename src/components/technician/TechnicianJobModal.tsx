import React, { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import SlideToSend from "@/components/request-form/SlideToSend";
import { cn } from "@/lib/utils";
import type { TechnicianJobDetails } from "@/lib/technicianJobDetails";
import { formatKm, formatMinutes, formatRupees, vehicleImageFor } from "@/lib/technicianJobCard";
import { JobKeyStrip, JobLocationBox, JobSays } from "./JobCardParts";

export interface JobRequest {
    id: string; // Job ID / Service Request ID
    isTowing?: boolean;
    customerName: string;
    serviceType: string;
    vehicleType: string;
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    distance: number; // km
    amount: number;
    eta?: string | number | null;
    dropLocation?: {
        lat?: number | null;
        lng?: number | null;
        address?: string | null;
    } | null;
    routeDistanceKm?: number | null;
    estimatedDuration?: number | null;
    vehicleCategory?: string | null;
    /** The technician's way to the customer, as dispatch measured it. Null when it wasn't sent. */
    pickupDistanceKm?: number | null;
    etaMinutes?: number | null;
    /** What the customer told us in the request form. */
    details?: TechnicianJobDetails | null;
}

interface TechnicianJobModalProps {
    job: JobRequest | null;
    isOpen: boolean;
    isProcessing?: boolean;
    isUnavailable?: boolean;
    unavailableMessage?: string;
    onAccept: (jobId: string) => void;
    onReject: (jobId: string) => void;
    onDismissUnavailable?: (jobId: string) => void;
}

const OFFER_SECONDS = 30;

export function TechnicianJobModal({
    job,
    isOpen,
    isProcessing = false,
    isUnavailable = false,
    unavailableMessage = "This job has already been taken by another technician.",
    onAccept,
    onReject,
    onDismissUnavailable,
}: TechnicianJobModalProps) {
    const [timeLeft, setTimeLeft] = useState(OFFER_SECONDS);
    const timeoutHandledRef = useRef(false);

    useEffect(() => {
        if (isOpen && !isUnavailable) {
            timeoutHandledRef.current = false;
            setTimeLeft(OFFER_SECONDS);
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen, isUnavailable]);

    useEffect(() => {
        if (!isOpen || isUnavailable || !job) return;
        if (timeLeft > 0) return;
        if (timeoutHandledRef.current) return;
        timeoutHandledRef.current = true;
        onReject(job.id);
    }, [isOpen, isUnavailable, job, onReject, timeLeft]);

    if (!job) return null;

    const details = job.details ?? null;
    const serviceLabel = String(job.serviceType || "Service").replace(/-/g, " ");
    const vehicleLabel = details?.vehicleLine || String(job.vehicleType || "Vehicle").replace(/-/g, " ");
    const isTowing = Boolean(job.isTowing);
    // For a tow, `distance` and `estimatedDuration` are the trip to the drop point, so the way
    // to the pickup comes only from what dispatch measured for this technician.
    const pickupKm = job.pickupDistanceKm ?? (!isTowing && job.distance > 0 ? job.distance : null);
    const dropAddress = String(job.dropLocation?.address || "").trim();
    const dropParts = [
        job.routeDistanceKm ? formatKm(Number(job.routeDistanceKm)) : null,
        job.estimatedDuration ? formatMinutes(Number(job.estimatedDuration)) : null,
    ].filter(Boolean);
    const kicker = isUnavailable
        ? "Offer closed"
        : ["New request", details?.towTruckLabel ? `${details.towTruckLabel} needed` : null].filter(Boolean).join(" · ");

    const dismiss = () => {
        if (isUnavailable && onDismissUnavailable) onDismissUnavailable(job.id);
        else onReject(job.id);
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent
                className={cn(
                    "tj tj-sheet fixed top-auto bottom-0 left-0 right-0 w-full !max-w-full sm:!max-w-lg sm:left-1/2 sm:-translate-x-1/2",
                    // A bottom sheet on a phone; on a wide screen the whole card sits in the middle.
                    "sm:top-1/2 sm:bottom-auto",
                    "gap-0 p-0 !m-0 border-0 shadow-[0_-24px_60px_rgba(0,0,0,0.45)]",
                    "data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full duration-500",
                    "transform-none sm:transform",
                    "z-[200] [&>button]:hidden"
                )}
                autoFocus={false}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <span className="tj-grab" aria-hidden="true" />
                <div className="tj-body">
                    <div className="tj-head">
                        <span className="tj-thumb is-big">
                            <img src={vehicleImageFor(job.vehicleType)} alt="" draggable={false} />
                        </span>
                        <div className="tj-head-id">
                            <p className="tj-kicker">{kicker}</p>
                            <DialogTitle className="tj-title">{serviceLabel}</DialogTitle>
                            <p className="tj-veh">{vehicleLabel}</p>
                        </div>
                    </div>
                    <DialogDescription className="sr-only">
                        New service request from {job.customerName || "a customer"}. Slide to accept or reject it.
                    </DialogDescription>

                    {details?.urgent && !isUnavailable ? (
                        <p className="tj-urgent" role="alert">
                            <MaterialSymbol name="warning" />
                            Urgent · {details.urgentReason}
                        </p>
                    ) : null}

                    <JobKeyStrip
                        earn={formatRupees(Number.isFinite(Number(job.amount)) && Number(job.amount) > 0 ? Number(job.amount) : null)}
                        distance={formatKm(pickupKm)}
                        eta={formatMinutes(job.etaMinutes ?? null)}
                    />

                    <JobLocationBox
                        label={isTowing ? "Pickup location" : "Customer location"}
                        address={job.location?.address || "Location not available"}
                        landmark={details?.landmark}
                        drop={dropAddress ? { label: ["Drop", ...dropParts].join(" · "), address: dropAddress } : null}
                    />

                    {details ? <JobSays details={details} /> : null}

                    {isUnavailable ? (
                        <p className="tj-closed" role="status">
                            <MaterialSymbol name="info" />
                            {unavailableMessage}
                        </p>
                    ) : null}
                </div>

                <div className="tj-foot">
                    {isUnavailable ? (
                        <button type="button" className="tj-ghost rq-press" onClick={dismiss}>
                            Dismiss
                        </button>
                    ) : (
                        <>
                            <div className="tj-time" role="timer" aria-label={`${timeLeft} seconds left to accept`}>
                                <div className="tj-bar" aria-hidden="true"><i style={{ width: `${(timeLeft / OFFER_SECONDS) * 100}%` }} /></div>
                                <b>{timeLeft} sec</b>
                            </div>
                            <SlideToSend
                                text="Slide to accept"
                                busyText="Accepting…"
                                busy={isProcessing}
                                urgent={Boolean(details?.urgent)}
                                onSend={() => onAccept(job.id)}
                            />
                            <button type="button" className="tj-ghost rq-press" onClick={() => onReject(job.id)} disabled={isProcessing}>
                                <MaterialSymbol name="close" />
                                Reject
                            </button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
