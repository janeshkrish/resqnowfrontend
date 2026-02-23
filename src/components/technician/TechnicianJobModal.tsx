
import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock } from "lucide-react";
import LiveTrackingMap from "@/components/user/LiveTrackingMap";

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
    onAccept: (jobId: string) => void;
    onReject: (jobId: string) => void;
}

export function TechnicianJobModal({ job, isOpen, isProcessing = false, onAccept, onReject }: TechnicianJobModalProps) {
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        if (isOpen) {
            setTimeLeft(30);
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        // Auto reject if time runs out? 
                        // Usually we just close the modal or let parent handle timeout.
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen]);

    if (!job) return null;

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="fixed top-auto bottom-0 left-0 right-0 w-full sm:max-w-md mx-auto translate-y-0 translate-x-0 data-[state=closed]:translate-y-full data-[state=open]:translate-y-0 rounded-t-3xl rounded-b-none p-0 overflow-hidden border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300" autoFocus={false} onPointerDownOutside={(e) => e.preventDefault()}>

                {/* Header with Visual Timer */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-xl font-black tracking-wide uppercase mb-1">New Job Request</h2>
                        <div className="flex items-center justify-center gap-2 text-white/90">
                            <Clock className="w-4 h-4" />
                            <span className="font-bold">Expires in <span className="text-yellow-300 text-lg">{timeLeft}s</span></span>
                        </div>
                    </div>
                    {/* Background Ping Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                </div>

                <div className="p-6 bg-white space-y-6">
                    {/* Price & Service Banner */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Service Required</p>
                            <p className="font-black text-slate-800 text-lg capitalize leading-none">{job.serviceType}</p>
                            <span className="text-xs font-bold text-indigo-600 mt-1 block">{job.vehicleType}</span>
                        </div>
                        <div className="text-right bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                            <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest leading-none mb-1">Est. Payout</p>
                            <p className="font-black text-green-700 text-2xl leading-none">₹{job.amount}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                                <MapPin className="h-4 w-4 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Location</p>
                                <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{job.location.address}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 border-l border-slate-100 pl-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Route Distance</p>
                                <p className="font-bold text-slate-800 text-sm">{job.distance.toFixed(1)} km</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Customer ETA</p>
                                <p className="font-bold text-slate-800 text-sm">~{(job.distance * 2 + 5).toFixed(0)} min</p>
                            </div>
                        </div>
                    </div>

                    {/* Map Preview */}
                    <div className="h-32 rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner">
                        <LiveTrackingMap
                            userLocation={{ lat: job.location.lat, lng: job.location.lng }}
                            techLocation={null} // tech is current user, we can pass it if we have it, or just show user loc
                            className="h-full w-full pointer-events-none"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                    </div>
                </div>

                <div className="p-4 pt-0 bg-white flex gap-3 pb-6">
                    <Button
                        variant="outline"
                        className="flex-1 h-14 rounded-2xl border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 active:scale-95 text-lg font-bold"
                        disabled={isProcessing}
                        onClick={() => onReject(job.id)}
                    >
                        Reject
                    </Button>
                    <Button
                        className="flex-[2] h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white shadow-xl shadow-zinc-900/20 active:scale-95 text-xl font-black tracking-wide"
                        disabled={isProcessing}
                        onClick={() => onAccept(job.id)}
                    >
                        {isProcessing ? "Accepting..." : "ACCEPT JOB"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
