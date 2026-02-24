import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, User, Navigation, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { toast } from 'sonner';
import ActiveJobMap from '@/components/technician/ActiveJobMap';
import { apiUrl } from "@/lib/api";
import { normalizeTechnicianStatus, formatTechnicianStatus } from "@/utils/technicianStatus";
import { useTechnicianActiveJob } from "@/hooks/useTechnicianActiveJob";

const ActiveJob = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { token, technician } = useTechnicianAuth();

    const { activeJob, setActiveJob, dues, setDues, refreshActiveJob, refreshDues } = useTechnicianActiveJob(technician?.id, 15000);
    const [status, setStatus] = useState(normalizeTechnicianStatus(state?.job?.status || 'accepted'));
    const [isLoading, setIsLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const job = activeJob || state?.job || null;

    // 1. Keep local status in sync with active job status
    useEffect(() => {
        if (!job && !state?.job) {
            navigate('/technician/dashboard');
            return;
        }
        if (job?.status) {
            setStatus(normalizeTechnicianStatus(job.status));
        }
    }, [job?.status, state?.job, navigate]);

    // 2. Pay Dues Handler
    const handlePayDues = async () => {
        try {
            const orderRes = await fetch(apiUrl("/api/technicians/me/pay-dues/order"), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const order = await orderRes.json();
            if (!orderRes.ok) {
                if (orderRes.status === 400 && order?.error === "No pending dues") {
                    setDues(0);
                    toast.success("All dues are already cleared.");
                    return;
                }
                throw new Error(order?.error || "Failed to create dues order");
            }
            if (order.error) throw new Error(order.error);

            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: "ResQNow Platform Fee",
                description: "Clear pending dues",
                order_id: order.id,
                handler: async (response: any) => {
                    try {
                        const verifyRes = await fetch(apiUrl("/api/technicians/me/pay-dues/verify"), {
                            method: 'POST',
                            cache: 'no-store',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(response)
                        });
                        const verifyData = await verifyRes.json();
                        if (!verifyRes.ok || !verifyData?.success) {
                            throw new Error(verifyData?.error || "Failed to verify dues payment");
                        }
                        if (verifyData?.financials && verifyData.financials.pending_dues != null) {
                            setDues(Number(verifyData.financials.pending_dues) || 0);
                        } else {
                            refreshDues();
                        }
                        toast.success("Dues Paid Successfully!");
                    } catch (err: any) {
                        toast.error(err?.message || "Failed to verify dues payment");
                        refreshDues();
                    }
                }
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (e: any) {
            toast.error(e.message || "Payment failed");
            refreshDues();
        }
    };

    // 3. Geolocation Logic
    useEffect(() => {
        let watchId: number;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setCurrentLocation({ lat: latitude, lng: longitude });

                    // Update location on server
                    fetch(apiUrl("/api/technicians/me/location"), {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ latitude, longitude })
                    }).catch(console.error);

                    // Emit via socket (Strict Request ID)
                    if (socket && job) {
                        socket.emit("technician:location_update", {
                            technicianId: technician?.id,
                            lat: latitude,
                            lng: longitude,
                            requestId: job.requestId || job.id
                        });
                    }
                },
                (err) => console.error("Geolocation error:", err),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [job, socket, technician?.id, token]);

    // 4. Update Status Logic
    const updateStatus = async (newStatus: string) => {
        if (!job) return;
        const normalizedNextStatus = normalizeTechnicianStatus(newStatus);
        setIsLoading(true);
        const previousStatus = status;

        // Optimistic Update
        setStatus(normalizedNextStatus);

        try {
            // STRICT: use requestId
            const idToUse = job.requestId || job.id;
            const response = await fetch(apiUrl(`/api/service-requests/${idToUse}/technician-status`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: normalizedNextStatus })
            });

            const data = await response.json();
            if (data.success || response.ok) {
                toast.success(`Status updated to: ${formatTechnicianStatus(normalizedNextStatus)}`);

                if (normalizedNextStatus === 'completed') {
                    // Logic handled in "payment_pending" flow usually, but if direct complete:
                    setTimeout(() => {
                        navigate('/technician/dashboard');
                        toast.success("Job marked as completed.");
                    }, 2000);
                }
                refreshActiveJob();
            } else {
                // Revert
                setStatus(previousStatus);
                toast.error(data.error || "Failed to update status");
            }
        } catch (error) {
            console.error("Update status error:", error);
            setStatus(previousStatus);
            toast.error("Failed to update status");
        } finally {
            setIsLoading(false);
        }
    };

    // 5. Terminal state redirect
    useEffect(() => {
        if (status === 'paid' || status === 'completed') {
            toast.success("Transaction completed!");
            const timer = setTimeout(() => {
                navigate('/technician/dashboard');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [status, navigate]);


    // 6. Navigation Logic (Strict Google Maps)
    const handleStartNavigation = () => {
        if (!job) return;
        // Prioritize nested location object from new API
        const destLat = job.location?.lat;
        const destLng = job.location?.lng;

        if (!destLat || !destLng || isNaN(Number(destLat)) || isNaN(Number(destLng))) {
            toast.error("Customer location coordinates are missing.");
            return;
        }

        // Use current location for origin if available
        const originParam = currentLocation ? `&origin=${currentLocation.lat},${currentLocation.lng}` : '';
        const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destLat},${destLng}`;
        window.open(url, '_blank');

        if (status === 'accepted' || status === 'assigned') {
            updateStatus('en-route');
        }
    };

    if (!job) return <div className="p-8 text-center">Loading job details...</div>;

    // Display Data Helpers (Strict)
    const displayUser = job.user?.name || "Not Available";
    const displayPhone = job.user?.phone || null;
    const displayService = job.service?.type || "Service";
    const displayVehicle = `${job.vehicle?.type || ''} ${job.vehicle?.model || ''}`.trim() || "Vehicle Details N/A";
    const displayAmount = job.amount || 0;

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] relative">
            <div className="flex-grow bg-slate-200 relative">
                <div className="absolute inset-0">
                    <ActiveJobMap
                        technicianLocation={currentLocation || { lat: 28.6139, lng: 77.2090 }}
                        customerLocation={{
                            lat: Number(job.location?.lat),
                            lng: Number(job.location?.lng)
                        }}
                    />
                </div>

                {/* Overlay stats */}
                <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-md border flex justify-between items-center">
                    <div>
                        <p className="text-xs text-muted-foreground">EST. EARNINGS</p>
                        <p className="font-bold text-lg">₹{displayAmount}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">PLATFORM DUE</p>
                        <p className="font-bold text-red-600">₹{dues}</p>
                        {dues > 0 && <Button size="sm" variant="outline" className="h-6 text-xs mt-1" onClick={handlePayDues}>Pay Now</Button>}
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">STATUS</p>
                        <p className="font-bold capitalize">{formatTechnicianStatus(status)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white border-t rounded-t-xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-6 space-y-6 z-10">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">{displayUser}</h3>
                            <p className="text-sm font-medium">{displayService} <span className="text-muted-foreground mx-1">•</span> {displayVehicle}</p>
                            <p className="text-xs text-muted-foreground mt-1">{displayPhone || 'No phone number'}</p>
                        </div>
                    </div>
                    {displayPhone && (
                        <Button variant="outline" size="icon" className="rounded-full h-12 w-12" onClick={() => window.location.href = `tel:${displayPhone}`}>
                            <Phone className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                <div className="space-y-4">
                    {(status === 'accepted' || status === 'assigned') && (
                        <Button
                            className="w-full h-12 text-lg"
                            onClick={handleStartNavigation}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Navigation className="mr-2 h-5 w-5" />}
                            Start Navigation
                        </Button>
                    )}

                    {status === 'en-route' && (
                        <Button
                            className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600"
                            onClick={() => updateStatus('arrived')}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="animate-spin mr-2" /> : <MapPin className="mr-2 h-5 w-5" />}
                            I Have Arrived
                        </Button>
                    )}

                    {status === 'arrived' && (
                        <Button
                            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                            onClick={() => updateStatus('payment_pending')}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                            Complete Work
                        </Button>
                    )}

                    {status === 'payment_pending' && (
                        <div className="w-full p-4 bg-yellow-50 text-yellow-800 rounded-lg text-center font-medium border border-yellow-200">
                            <Loader2 className="inline-block animate-spin mr-2 w-4 h-4" />
                            Waiting for customer payment...
                        </div>
                    )}

                    {/* Allow cancel unless job is done/paid */}
                    {!['payment_pending', 'completed', 'paid'].includes(status) && (
                        <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => updateStatus('cancelled')}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel Job
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActiveJob;
