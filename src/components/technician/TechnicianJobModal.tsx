import React, { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlideButton } from "@/components/ui/slide-button";
import { MapPin, Zap, Bike, Car, Truck, Flame, AlertTriangle, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JobRequest {
    id: string; // Job ID / Service Request ID
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
    const [timeLeft, setTimeLeft] = useState(30);
    const timeoutHandledRef = useRef(false);

    useEffect(() => {
        if (isOpen && !isUnavailable) {
            timeoutHandledRef.current = false;
            setTimeLeft(30);
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

    const getVehicleIcon = (type: string) => {
        switch (String(type || "").toLowerCase()) {
            case "bike":
                return <Bike className="w-8 h-8 text-white" />;
            case "car":
                return <Car className="w-8 h-8 text-white" />;
            case "commercial":
                return <Truck className="w-8 h-8 text-white" />;
            default:
                return <Zap className="w-8 h-8 text-white" />;
        }
    };

    const payoutText = Number(job.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    const distanceKm = Number(job.routeDistanceKm || job.distance || 0);
    const distanceText = Number.isFinite(distanceKm) ? distanceKm.toFixed(1) : "--";
    const etaRaw = job.estimatedDuration ?? (job.eta != null && job.eta !== "" ? Number(job.eta) : null);
    const etaMinutes = Number.isFinite(etaRaw)
        ? Math.max(1, Math.round(etaRaw))
        : Number.isFinite(distanceKm)
            ? Math.max(5, Math.round(distanceKm * 2 + 6))
            : null;
    const serviceLabel = String(job.serviceType || "Service").replace(/-/g, " ");
    const vehicleLabel = String(job.vehicleType || "Vehicle").replace(/-/g, " ");
    const customerLabel = String(job.customerName || "Customer");

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent
                className={cn(
                    "fixed top-auto bottom-0 left-0 right-0 w-full !max-w-full sm:!max-w-lg sm:left-1/2 sm:-translate-x-1/2",
                    "p-0 !m-0 overflow-hidden border-t-0 bg-white dark:bg-zinc-950",
                    "rounded-t-[32px] rounded-b-none shadow-[0_-24px_60px_rgba(0,0,0,0.45)]",
                    "data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full duration-500",
                    "transform-none sm:transform",
                    "z-[200]"
                )}
                autoFocus={false}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <div className="relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#5b1a1a] px-6 pt-6 pb-5 text-white">
                    <div className="absolute inset-0 opacity-25">
                        <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#ff6b3d]/20 blur-3xl" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between">
                            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em]">
                                {isUnavailable ? "Offer Closed" : "New Job"}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-white/80">
                                <Clock className="h-3.5 w-3.5" />
                                {isUnavailable ? "Expired" : `${timeLeft}s left`}
                            </div>
                        </div>

                        <div className="mt-6 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-white/70">{vehicleLabel}</p>
                                <h2 className="text-3xl font-black capitalize tracking-tight">{serviceLabel}</h2>
                            </div>
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 shadow-lg">
                                {getVehicleIcon(job.vehicleType)}
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-white/10 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Payout</p>
                                <p className="text-lg font-black">₹ {payoutText}</p>
                            </div>
                            <div className="rounded-2xl bg-white/10 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Distance</p>
                                <p className="text-lg font-black">{distanceText} km</p>
                            </div>
                            <div className="rounded-2xl bg-white/10 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">ETA</p>
                                <p className="text-lg font-black">{etaMinutes ?? "--"} min</p>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
                        <div
                            className="h-full bg-gradient-to-r from-[#ff4d4d] via-[#ff6b3d] to-[#ffd166] transition-all duration-1000 ease-linear"
                            style={{ width: `${isUnavailable ? 100 : (timeLeft / 30) * 100}%` }}
                        />
                    </div>
                </div>

                <div
                    className={cn(
                        "relative -mt-4 rounded-t-[28px] bg-white dark:bg-zinc-950 px-6 pb-6 pt-5 shadow-[0_-10px_24px_rgba(0,0,0,0.12)]",
                        isUnavailable && "opacity-85"
                    )}
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                                <User className="h-3.5 w-3.5 text-zinc-400" />
                                Customer
                            </div>
                            <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                                {customerLabel}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                                <Flame className="h-3.5 w-3.5 text-orange-500" />
                                Priority
                            </div>
                            <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                Respond now
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Pickup</p>
                            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                                {job.location.address}
                            </p>
                        </div>
                    </div>

                    {job.dropLocation?.address && (
                        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Drop</p>
                                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                                    {job.dropLocation.address}
                                </p>
                            </div>
                        </div>
                    )}

                    {job.vehicleCategory && (
                        <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
                            Vehicle category: {String(job.vehicleCategory).replace(/_/g, " ")}
                        </div>
                    )}

                    {isUnavailable && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p className="text-sm font-semibold">{unavailableMessage}</p>
                            </div>
                        </div>
                    )}

                    <div className="mt-5 space-y-4">
                        <SlideButton
                            onSlideComplete={() => onAccept(job.id)}
                            text={
                                isUnavailable
                                    ? "Job No Longer Available"
                                    : isProcessing
                                        ? "Accepting..."
                                        : "Slide to Accept"
                            }
                            isSubmitting={isProcessing}
                            disabled={isProcessing || isUnavailable}
                            className="shadow-[0_12px_30px_rgba(239,68,68,0.35)] !bg-gradient-to-r !from-[#ff4d4d] !to-[#ff7a3d]"
                        />
                        <Button
                            variant="ghost"
                            className="w-full rounded-xl border border-transparent text-zinc-500 hover:border-red-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 font-bold h-12 text-base"
                            onClick={() => {
                                if (isUnavailable) {
                                    if (onDismissUnavailable) onDismissUnavailable(job.id);
                                    else onReject(job.id);
                                    return;
                                }
                                onReject(job.id);
                            }}
                            disabled={isProcessing}
                        >
                            {isUnavailable ? "Dismiss Alert" : "Reject Offer"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
