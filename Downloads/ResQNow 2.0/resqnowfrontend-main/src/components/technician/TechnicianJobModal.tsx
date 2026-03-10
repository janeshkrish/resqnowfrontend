import React, { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlideButton } from "@/components/ui/slide-button";
import { MapPin, Zap, Bike, Car, Truck, Flame, AlertTriangle } from "lucide-react";
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

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent
                className={cn(
                    "fixed top-auto bottom-0 left-0 right-0 w-full !max-w-full sm:!max-w-md sm:left-1/2 sm:-translate-x-1/2",
                    "p-0 !m-0 overflow-hidden border-t-0 bg-white dark:bg-zinc-950",
                    "rounded-t-3xl rounded-b-none shadow-[0_-20px_50px_rgba(0,0,0,0.5)]",
                    "data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full duration-500",
                    "transform-none sm:transform",
                    "z-[200]"
                )}
                autoFocus={false}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <div className="bg-primary w-full p-6 pb-12 relative overflow-hidden flex flex-col items-center justify-center">
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center justify-center">
                        <div className="absolute w-28 h-28 bg-white/20 rounded-full animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute w-36 h-36 bg-white/10 rounded-full animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.2s" }} />
                        <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-md border-[3px] border-white/50 rounded-full flex items-center justify-center shadow-2xl">
                            {getVehicleIcon(job.vehicleType)}
                        </div>
                    </div>

                    <div className="mt-28 text-center relative z-10 w-full">
                        <div className="mb-3">
                            <span className="bg-black/20 text-white text-[11px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full backdrop-blur-md">
                                {isUnavailable ? "Offer Closed" : "New Request"}
                            </span>
                        </div>
                        <h2 className="text-white font-black text-6xl tracking-tighter drop-shadow-md mb-2">
                            INR {payoutText}
                        </h2>
                        <p className="text-primary-foreground/90 text-sm font-semibold tracking-wide">Estimated Payout</p>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
                        <div
                            className="h-full bg-white transition-all duration-1000 ease-linear"
                            style={{ width: `${isUnavailable ? 100 : (timeLeft / 30) * 100}%` }}
                        />
                    </div>
                </div>

                <div
                    className={cn(
                        "p-6 bg-white dark:bg-zinc-950 relative -mt-6 rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)]",
                        isUnavailable && "opacity-80"
                    )}
                >
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 capitalize leading-none mb-1.5">{job.serviceType}</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                {isUnavailable ? "Offer is no longer available" : `Auto-reject in ${timeLeft}s`}
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <div className="flex items-center gap-1.5 text-orange-600 font-bold bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-100">
                                <Flame className="w-5 h-5 fill-current" />
                                <span className="text-lg">{Number(job.distance || 0).toFixed(1)} km</span>
                            </div>
                            <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-wider">{(Number(job.distance || 0) * 2 + 5).toFixed(0)} mins away</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 mb-8 shadow-sm">
                        <div className="mt-0.5 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Pickup Location</p>
                            <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                                {job.location.address}
                            </p>
                        </div>
                    </div>

                    {isUnavailable && (
                        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p className="text-sm font-semibold">{unavailableMessage}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 pb-2">
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
                            className="shadow-[0_8px_30px_rgba(220,38,38,0.3)] !bg-primary"
                        />
                        <Button
                            variant="ghost"
                            className="w-full text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold h-12 rounded-xl transition-colors text-base"
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
