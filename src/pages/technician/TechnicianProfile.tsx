import React, { useCallback, useEffect, useState } from "react";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Loader2, User, MapPin, Phone, Briefcase, Star } from "lucide-react";

const TechnicianProfile = () => {
    const { technician, isLoading } = useTechnicianAuth();
    const { socket } = useSocket();
    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const [liveTechnician, setLiveTechnician] = useState<any | null>(null);
    const [liveStats, setLiveStats] = useState({
        completedJobs: 0,
        totalEarnings: 0,
        todayEarnings: 0
    });
    const [liveFinancials, setLiveFinancials] = useState({
        total_earnings: 0,
        pending_dues: 0
    });

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        address: "",
        service_area_range: 10,
        experience: 0
    });

    const hydrateForm = useCallback((source: any) => {
        setFormData({
            name: source?.name || "",
            phone: source?.phone || "",
            address: source?.address || "",
            service_area_range: Number(source?.serviceAreaRange ?? source?.service_area_range ?? 10),
            experience: Number(source?.experience ?? 0)
        });
    }, []);

    useEffect(() => {
        if (technician && !isFormInitialized) {
            hydrateForm(technician);
            setIsFormInitialized(true);
        }
    }, [technician, isFormInitialized, hydrateForm]);

    const fetchLiveData = useCallback(async (showRefreshState = false) => {
        if (!technician?.id) return;
        if (showRefreshState) {
            setIsRefreshing(true);
        }

        try {
            const [meRes, statsRes, financialsRes] = await Promise.all([
                apiFetch("/api/technicians/me", { technician: true }),
                apiFetch("/api/technicians/dashboard-stats", { technician: true }),
                apiFetch("/api/technicians/me/financials", { technician: true })
            ]);

            if (meRes.ok) {
                const meData = await meRes.json();
                setLiveTechnician(meData);
                if (!isFormInitialized) {
                    hydrateForm(meData);
                    setIsFormInitialized(true);
                }
            }

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setLiveStats({
                    completedJobs: Number(statsData?.completedJobs || 0),
                    totalEarnings: Number(statsData?.totalEarnings || 0),
                    todayEarnings: Number(statsData?.todayEarnings || 0)
                });
            }

            if (financialsRes.ok) {
                const financialData = await financialsRes.json();
                setLiveFinancials({
                    total_earnings: Number(financialData?.total_earnings || 0),
                    pending_dues: Number(financialData?.pending_dues || 0)
                });
            }
        } catch (error) {
            console.error("Failed to refresh technician profile snapshot", error);
        } finally {
            if (showRefreshState) {
                setIsRefreshing(false);
            }
        }
    }, [technician?.id, isFormInitialized, hydrateForm]);

    useEffect(() => {
        if (!technician?.id) return;
        fetchLiveData(true);
        const intervalId = window.setInterval(() => fetchLiveData(false), 20000);
        return () => window.clearInterval(intervalId);
    }, [technician?.id, fetchLiveData]);

    useEffect(() => {
        if (!socket) return;

        const handleStatsUpdate = (data: any) => {
            if (!data) return;
            setLiveStats((prev) => ({
                completedJobs: Number(data?.completedJobs ?? prev.completedJobs ?? 0),
                totalEarnings: Number(data?.totalEarnings ?? prev.totalEarnings ?? 0),
                todayEarnings: Number(data?.todayEarnings ?? prev.todayEarnings ?? 0)
            }));
        };

        const handleFinancialsUpdate = (data: any) => {
            if (!data) return;
            setLiveFinancials((prev) => ({
                total_earnings: Number(data?.total_earnings ?? prev.total_earnings ?? 0),
                pending_dues: Number(data?.pending_dues ?? prev.pending_dues ?? 0)
            }));
        };

        const refreshAll = () => {
            fetchLiveData(false);
        };

        socket.on("dashboard:stats_update", handleStatsUpdate);
        socket.on("technician:financials_update", handleFinancialsUpdate);
        socket.on("technician:new_review", refreshAll);

        return () => {
            socket.off("dashboard:stats_update", handleStatsUpdate);
            socket.off("technician:financials_update", handleFinancialsUpdate);
            socket.off("technician:new_review", refreshAll);
        };
    }, [socket, fetchLiveData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numericFields = new Set(["service_area_range", "experience"]);
        setFormData((prev) => ({
            ...prev,
            [name]: numericFields.has(name) ? Number(value || 0) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await apiFetch("/api/technicians/me/profile", {
                method: "PATCH",
                body: JSON.stringify(formData),
                technician: true
            });

            if (res.ok) {
                toast.success("Profile updated successfully");
                await fetchLiveData(true);
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to update profile");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !technician) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    const profile = liveTechnician || technician;
    const ratingValue = Number(profile?.rating ?? technician?.rating ?? 0);
    const ratingLabel = Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue.toFixed(1) : "N/A";
    const jobsDone = Number(liveStats.completedJobs || profile?.jobs_completed || technician?.jobs_completed || 0);
    const totalEarnings = Number(
        liveFinancials.total_earnings ||
        liveStats.totalEarnings ||
        profile?.total_earnings ||
        technician?.total_earnings ||
        0
    );

    return (
        <div className="container max-w-4xl py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
                    <p className="text-muted-foreground">Manage your personal information and service details.</p>
                </div>
                <div className="bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium border border-yellow-200 flex items-center gap-1">
                    {(isRefreshing || isSaving) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    <span>Rating: {ratingLabel}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-lg">
                                <span className="text-sm font-medium">Verification</span>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded uppercase font-bold">
                                    {profile?.verification_status || technician.verification_status}
                                </span>
                            </div>
                            <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-lg">
                                <span className="text-sm font-medium">Jobs Done</span>
                                <span className="font-bold">{jobsDone}</span>
                            </div>
                            <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-lg">
                                <span className="text-sm font-medium">Total Earnings</span>
                                <span className="font-bold text-green-600">Rs {totalEarnings.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Specialties</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {(profile?.specialties || technician.specialties || []).map((spec: string) => (
                                    <span key={spec} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full border border-blue-200">
                                        {spec}
                                    </span>
                                ))}
                                {(!(profile?.specialties || technician.specialties) || (profile?.specialties || technician.specialties || []).length === 0) && (
                                    <span className="text-muted-foreground text-sm">No specialties listed</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    <form onSubmit={handleSubmit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Personal Details</CardTitle>
                                <CardDescription>Update your contact information.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Full Name</Label>
                                        <div className="relative">
                                            <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input id="name" name="name" className="pl-9" value={formData.name} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input id="email" value={profile?.email || technician.email} disabled className="bg-muted" />
                                        <p className="text-[10px] text-muted-foreground">Email cannot be changed.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <div className="relative">
                                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input id="phone" name="phone" className="pl-9" value={formData.phone} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="experience">Years of Experience</Label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input type="number" id="experience" name="experience" className="pl-9" value={formData.experience} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="address">Base Address</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input id="address" name="address" className="pl-9" value={formData.address} onChange={handleChange} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">This is used as your central location for finding nearby jobs.</p>
                                </div>

                                <Separator className="my-4" />

                                <div className="space-y-2">
                                    <Label htmlFor="service_area_range">Service Range (km)</Label>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            type="number"
                                            id="service_area_range"
                                            name="service_area_range"
                                            value={formData.service_area_range}
                                            onChange={handleChange}
                                            className="max-w-[150px]"
                                        />
                                        <span className="text-sm text-muted-foreground">
                                            You will receive requests within this radius provided you are online.
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end mt-6">
                            <Button type="submit" size="lg" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TechnicianProfile;
