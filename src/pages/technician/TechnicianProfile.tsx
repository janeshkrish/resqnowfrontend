import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { useTheme } from "@/components/item-providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { apiFetch, apiUrl } from "@/lib/api";
import {
    Loader2, User, MapPin, Phone, Briefcase, Star,
    BarChart, Bell, Shield, Palette, LogOut, ChevronRight,
    ArrowLeft, Sun, Moon, Globe, Camera, ImagePlus, Trash2
} from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

const resolveTechnicianImageUrl = (value: unknown) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : apiUrl(raw);
};

const getInitials = (name: unknown) =>
    String(name || "T")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] || "")
        .join("")
        .toUpperCase();

const TechnicianProfile = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { technician, isLoading, logout, refreshTechnician } = useTechnicianAuth();
    const { socket } = useSocket();
    const { theme, setTheme } = useTheme();
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);

    const activeTab = searchParams.get("tab") || (isMobile ? "menu" : "profile");

    const handleTabChange = (id: string) => {
        setSearchParams({ tab: id });
    };

    const sidebarItems = [
        { id: "profile", label: "Profile", icon: User, description: "Personal info & service range" },
        { id: "stats", label: "Stats & Specialties", icon: BarChart, description: "Your earnings & jobs" },
        { id: "appearance", label: "Appearance", icon: Palette, description: "Theme & display" },
        { id: "notifications", label: "Notifications", icon: Bell, description: "Email & push alerts" },
        { id: "security", label: "Security", icon: Shield, description: "Password & app data" },
    ];

    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [liveTechnician, setLiveTechnician] = useState<any | null>(null);
    const [liveStats, setLiveStats] = useState({ completedJobs: 0, totalEarnings: 0 });
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const [profilePhotoPath, setProfilePhotoPath] = useState("");

    // Profile Form
    const [formData, setFormData] = useState({
        name: "", phone: "", address: "", service_area_range: 10, experience: 0
    });

    // Settings
    const [settingsState, setSettingsState] = useState({
        appearance: { theme: "system" as ThemeMode },
        notifications: { email_notifications: true, push_notifications: true },
        navigation: { mobile_bottom_nav_enabled: true, auto_hide_bottom_nav: true }
    });

    const hydrateForm = useCallback((source: any) => {
        setFormData({
            name: source?.name || "",
            phone: source?.phone || "",
            address: source?.address || "",
            service_area_range: Number(source?.serviceAreaRange ?? source?.service_area_range ?? 10),
            experience: Number(source?.experience ?? 0)
        });
        setProfilePhotoPath(String(source?.documents?.profile_photo || ""));
    }, []);

    const fetchLiveData = useCallback(async () => {
        if (!technician?.id) return;
        try {
            const [meRes, statsRes, settingsRes] = await Promise.all([
                apiFetch("/api/technicians/me", { technician: true }),
                apiFetch("/api/technicians/dashboard-stats", { technician: true }),
                apiFetch("/api/technicians/me/settings", { technician: true }).catch(() => null)
            ]);

            if (meRes.ok) {
                const meData = await meRes.json();
                setLiveTechnician(meData);
                setProfilePhotoPath(String(meData?.documents?.profile_photo || ""));
                if (!isFormInitialized) {
                    hydrateForm(meData);
                    setIsFormInitialized(true);
                }
            }
            if (statsRes.ok) {
                const sData = await statsRes.json();
                setLiveStats({
                    completedJobs: Number(sData?.completedJobs || 0),
                    totalEarnings: Number(sData?.totalEarnings || 0)
                });
            }
            if (settingsRes && settingsRes.ok) {
                const s = await settingsRes.json();
                if (s) {
                    setSettingsState((prev) => ({
                        appearance: {
                            ...prev.appearance,
                            ...(s.appearance || {})
                        },
                        notifications: {
                            ...prev.notifications,
                            ...(s.notifications || {})
                        },
                        navigation: {
                            ...prev.navigation,
                            ...(s.navigation || {})
                        }
                    }));
                    if (s.appearance?.theme) setTheme(s.appearance.theme);
                }
            }
        } catch (error) {
            console.error("Fetch profile data error", error);
        }
    }, [technician?.id, isFormInitialized, hydrateForm, setTheme]);

    useEffect(() => {
        if (!technician?.id) return;
        fetchLiveData();
    }, [technician?.id, fetchLiveData]);

    useEffect(() => {
        if (!socket) return;
        const handleStats = () => fetchLiveData();
        socket.on("dashboard:stats_update", handleStats);
        return () => { socket.off("dashboard:stats_update", handleStats); };
    }, [socket, fetchLiveData]);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numeric = new Set(["service_area_range", "experience"]);
        setFormData((prev) => ({
            ...prev, [name]: numeric.has(name) ? Number(value || 0) : value
        }));
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await apiFetch("/api/technicians/me/profile", {
                method: "PATCH", body: JSON.stringify(formData), technician: true
            });
            if (res.ok) {
                const payload = await res.json().catch(() => ({}));
                const refreshedTechnician = await refreshTechnician();
                const nextTechnician = refreshedTechnician || payload?.technician || null;
                if (nextTechnician) {
                    setLiveTechnician(nextTechnician);
                    hydrateForm(nextTechnician);
                    setIsFormInitialized(true);
                } else {
                    fetchLiveData();
                }
                toast.success("Profile updated");
            } else {
                toast.error("Failed to update profile");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const persistProfilePhoto = useCallback(async (nextPath: string) => {
        const res = await apiFetch("/api/technicians/me/profile", {
            method: "PATCH",
            body: JSON.stringify({ profile_photo: nextPath }),
            technician: true,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(String(payload?.error || "Failed to update profile photo."));
        }

        const refreshedTechnician = await refreshTechnician();
        const nextTechnician = refreshedTechnician || payload?.technician || null;
        if (nextTechnician) {
            setLiveTechnician(nextTechnician);
            hydrateForm(nextTechnician);
            setIsFormInitialized(true);
        }
        setProfilePhotoPath(String(nextTechnician?.documents?.profile_photo || nextPath || ""));
    }, [hydrateForm, refreshTechnician]);

    const handleProfilePhotoSelection = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setIsUploadingPhoto(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const uploadRes = await fetch(apiUrl("/api/upload"), {
                method: "POST",
                body: formData,
            });
            const uploadPayload = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok || !uploadPayload?.url) {
                throw new Error(String(uploadPayload?.error || "Failed to upload image."));
            }

            await persistProfilePhoto(String(uploadPayload.url));
            toast.success("Profile photo updated");
        } catch (error) {
            console.error("Profile photo upload failed", error);
            toast.error(error instanceof Error ? error.message : "Failed to update profile photo");
        } finally {
            setIsUploadingPhoto(false);
        }
    }, [persistProfilePhoto]);

    const handleRemoveProfilePhoto = useCallback(async () => {
        setIsUploadingPhoto(true);
        try {
            await persistProfilePhoto("");
            toast.success("Profile photo removed");
        } catch (error) {
            console.error("Profile photo removal failed", error);
            toast.error(error instanceof Error ? error.message : "Failed to remove profile photo");
        } finally {
            setIsUploadingPhoto(false);
        }
    }, [persistProfilePhoto]);

    const updateSettings = async (patch: any) => {
        const prev = settingsState;
        const next = {
            ...prev,
            ...patch,
            appearance: { ...prev.appearance, ...(patch.appearance || {}) },
            notifications: { ...prev.notifications, ...(patch.notifications || {}) },
            navigation: { ...prev.navigation, ...(patch.navigation || {}) }
        };
        setSettingsState(next);
        if (patch.appearance?.theme) setTheme(patch.appearance.theme);

        setIsSaving(true);
        try {
            await apiFetch("/api/technicians/me/settings", {
                method: "PATCH", body: JSON.stringify(patch), technician: true
            });
        } catch (err) {
            setSettingsState(prev);
            toast.error("Failed to update settings");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !technician) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>;
    }

    const profileData = liveTechnician || technician;
    const profileImageUrl = resolveTechnicianImageUrl(profilePhotoPath || profileData?.documents?.profile_photo);
    const ratingLabel = Number(profileData?.rating || 0).toFixed(1);

    const renderContent = () => {
        switch (activeTab) {
            case "profile":
                return (
                    <form onSubmit={handleProfileSubmit} className="space-y-6">
                        <div className="zomato-card space-y-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                                        {profileImageUrl ? (
                                            <AvatarImage src={profileImageUrl} alt={`${profileData?.name || "Technician"} profile`} className="object-cover" />
                                        ) : null}
                                        <AvatarFallback className="bg-slate-100 text-lg font-black text-slate-900">
                                            {getInitials(profileData?.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-red-700">
                                            ResQNow Profile
                                        </p>
                                        <h3 className="mt-3 text-lg font-black leading-tight text-foreground break-words">
                                            {profileData?.name || "Technician"}
                                        </h3>
                                        <p className="mt-1 text-sm text-muted-foreground break-all">{profileData?.email}</p>
                                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            Keep this photo visible to customers during dispatch
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 sm:max-w-[18rem] sm:justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={() => galleryInputRef.current?.click()}
                                        disabled={isUploadingPhoto}
                                    >
                                        {isUploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                                        Gallery
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={isUploadingPhoto}
                                    >
                                        <Camera className="mr-2 h-4 w-4" />
                                        Camera
                                    </Button>
                                    {profilePhotoPath ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={handleRemoveProfilePhoto}
                                            disabled={isUploadingPhoto}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                            <input
                                ref={galleryInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleProfilePhotoSelection}
                            />
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="user"
                                className="hidden"
                                onChange={handleProfilePhotoSelection}
                            />
                        </div>
                        <div className="zomato-card space-y-4">
                            <div className="pb-4 border-b border-border">
                                <h3 className="text-lg font-bold text-foreground">Personal Details</h3>
                                <p className="text-xs text-muted-foreground/80">Update your contact information.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input name="name" className="pl-9" value={formData.name} onChange={handleProfileChange} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Address</Label>
                                    <Input value={profileData?.email} disabled className="bg-muted text-muted-foreground" />
                                    <p className="text-[10px] text-muted-foreground">Email cannot be changed.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input name="phone" className="pl-9" value={formData.phone} onChange={handleProfileChange} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Base Address</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input name="address" className="pl-9" value={formData.address} onChange={handleProfileChange} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Service Range (km)</Label>
                                    <Input type="number" name="service_area_range" value={formData.service_area_range} onChange={handleProfileChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Experience (Years)</Label>
                                    <Input type="number" name="experience" value={formData.experience} onChange={handleProfileChange} />
                                </div>
                            </div>
                            <Button type="submit" className="w-full mt-4" disabled={isSaving}>
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes
                            </Button>
                        </div>
                    </form>
                );
            case "stats":
                return (
                    <div className="space-y-6">
                        <div className="zomato-card space-y-4">
                            <div className="pb-4 border-b border-border">
                                <h3 className="text-lg font-bold text-foreground">Account Status</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-muted p-3 rounded-lg border border-border">
                                    <span className="text-sm font-bold text-muted-foreground">Verification</span>
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded uppercase font-bold">
                                        {profileData?.verification_status || "Pending"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-muted p-3 rounded-lg border border-border">
                                    <span className="text-sm font-bold text-muted-foreground">Jobs Done</span>
                                    <span className="font-black text-foreground">{liveStats.completedJobs || profileData?.jobs_completed || 0}</span>
                                </div>
                                <div className="flex justify-between items-center bg-muted p-3 rounded-lg border border-border">
                                    <span className="text-sm font-bold text-muted-foreground">Total Earnings</span>
                                    <span className="font-black text-red-700">Rs {(liveStats.totalEarnings || profileData?.total_earnings || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="zomato-card space-y-4">
                            <div className="pb-4 border-b border-border">
                                <h3 className="text-lg font-bold text-foreground">Specialties</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(profileData?.specialties || []).map((spec: string) => (
                                    <span key={spec} className="bg-red-50 text-red-700 font-bold text-xs px-3 py-1.5 rounded-full border border-red-100">
                                        {spec}
                                    </span>
                                ))}
                                {(!profileData?.specialties || profileData.specialties.length === 0) && (
                                    <span className="text-muted-foreground text-sm font-medium">No specialties listed</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case "appearance":
                return (
                    <div className="zomato-card space-y-4">
                        <div className="pb-4 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">Appearance</h3>
                            <p className="text-xs text-muted-foreground/80">Customize how the app looks.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <Button variant={settingsState.appearance.theme === "light" ? "default" : "outline"} onClick={() => updateSettings({ appearance: { theme: "light" } })} className="justify-start">
                                <Sun className="w-4 h-4 mr-3" /> Light Mode
                            </Button>
                            <Button variant={settingsState.appearance.theme === "dark" ? "default" : "outline"} onClick={() => updateSettings({ appearance: { theme: "dark" } })} className="justify-start">
                                <Moon className="w-4 h-4 mr-3" /> Dark Mode
                            </Button>
                            <Button variant={settingsState.appearance.theme === "system" ? "default" : "outline"} onClick={() => updateSettings({ appearance: { theme: "system" } })} className="justify-start">
                                <Globe className="w-4 h-4 mr-3" /> System Default
                            </Button>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Show Bottom Navigation</Label>
                                    <p className="text-xs text-muted-foreground">Enable the technician bottom nav bar.</p>
                                </div>
                                <Switch
                                    checked={!!settingsState.navigation.mobile_bottom_nav_enabled}
                                    onCheckedChange={(c) => updateSettings({ navigation: { mobile_bottom_nav_enabled: c } })}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Auto-hide Navigation</Label>
                                    <p className="text-xs text-muted-foreground">Hide on scroll down and reveal on scroll up.</p>
                                </div>
                                <Switch
                                    checked={!!settingsState.navigation.auto_hide_bottom_nav}
                                    onCheckedChange={(c) => updateSettings({ navigation: { auto_hide_bottom_nav: c } })}
                                    disabled={!settingsState.navigation.mobile_bottom_nav_enabled}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "notifications":
                return (
                    <div className="zomato-card space-y-4">
                        <div className="pb-4 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">Notifications</h3>
                            <p className="text-xs text-muted-foreground/80">Manage alerts and emails.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Email Notifications</Label>
                                    <p className="text-xs text-muted-foreground">Receive job summaries via email.</p>
                                </div>
                                <Switch checked={settingsState.notifications.email_notifications} onCheckedChange={(c) => updateSettings({ notifications: { email_notifications: c } })} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Push Notifications</Label>
                                    <p className="text-xs text-muted-foreground">Instant alerts for new requests.</p>
                                </div>
                                <Switch checked={settingsState.notifications.push_notifications} onCheckedChange={(c) => updateSettings({ notifications: { push_notifications: c } })} />
                            </div>
                        </div>
                    </div>
                );
            case "security":
                return (
                    <div className="zomato-card space-y-4">
                        <div className="pb-4 border-b border-border">
                            <h3 className="text-lg font-bold text-foreground">Security & Privacy</h3>
                        </div>
                        <div className="space-y-3">
                            <Button variant="outline" className="w-full justify-start rounded-xl font-bold">Update Password</Button>
                            <Button variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 rounded-xl font-bold" onClick={() => toast.success("Cache cleared")}>Clear App Data</Button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    if (isMobile) {
        if (activeTab === "menu") {
            return (
                <div className="min-h-screen bg-muted pb-20 fade-in-0 animate-in duration-300">
                    <div className="bg-card dark:bg-slate-900 px-6 pt-12 pb-8 rounded-b-[2rem] shadow-sm mb-6 border-b border-border">
                        <div className="mb-5">
                            <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-red-700">
                                ResQNow Technician
                            </span>
                        </div>
                        <div className="flex items-center gap-5">
                        <Avatar className="h-[4.5rem] w-[4.5rem] border-[3px] border-white shadow-md shrink-0">
                            {profileImageUrl ? (
                                <AvatarImage src={profileImageUrl} alt={`${profileData?.name || "Technician"} profile`} className="object-cover" />
                            ) : null}
                            <AvatarFallback className="bg-muted/50 text-slate-700 text-xl font-black">
                                {getInitials(profileData?.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-black text-foreground tracking-tight leading-tight break-words">
                                {profileData?.name || profileData?.email?.split('@')[0] || 'Technician'}
                            </h2>
                            <p className="text-sm font-semibold text-muted-foreground/80 break-all mb-2">{profileData?.email}</p>
                            <div className="flex items-center gap-2">
                                <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-yellow-200 flex items-center gap-1 w-fit">
                                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {ratingLabel}
                                </span>
                            </div>
                        </div>
                        </div>
                    </div>

                    <div className="px-4 space-y-4">
                        <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border overflow-hidden">
                            {sidebarItems.map((item, index) => {
                                const isLast = index === sidebarItems.length - 1;
                                return (
                                    <div key={item.id}>
                                        <button onClick={() => handleTabChange(item.id)} className="w-full text-left p-4 flex items-center justify-between hover:bg-muted active:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
                                                    <item.icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-foreground">{item.label}</h3>
                                                    <p className="text-[11px] font-medium text-muted-foreground/80">{item.description}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-300" />
                                        </button>
                                        {!isLast && <Separator className="mx-4 w-auto bg-muted/50" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border overflow-hidden">
                            <button onClick={() => { logout(); navigate('/'); }} className="w-full text-left p-4 flex items-center justify-between hover:bg-red-50 active:bg-red-100 transition-colors">
                                <div className="flex items-center gap-4 text-red-600">
                                    <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                                        <LogOut className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold">Log out</h3>
                                </div>
                                <ChevronRight className="w-5 h-5 text-red-300" />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        const currentItem = sidebarItems.find(i => i.id === activeTab);
        return (
            <div className="min-h-screen bg-muted pb-20 fade-in-0 animate-in slide-in-from-bottom-4 duration-300">
                <div className="sticky top-0 z-50 bg-card dark:bg-slate-900/95 backdrop-blur-md px-4 py-4 flex items-center gap-4 border-b border-border shadow-sm">
                    <button onClick={() => handleTabChange('menu')} className="w-10 h-10 flex items-center justify-center bg-muted border border-border rounded-full text-muted-foreground hover:bg-muted/50 active:scale-95 transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-black text-foreground tracking-tight">{currentItem?.label || 'Profile'}</h2>
                </div>
                <div className="p-4">
                    {renderContent()}
                </div>
            </div>
        );
    }

    // Desktop View
    return (
        <div className="container max-w-7xl mx-auto py-10 px-4 md:px-8">
            <div className="space-y-6">
                <div className="space-y-0.5">
                    <p className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-red-700">
                        ResQNow Technician Portal
                    </p>
                    <h2 className="pt-3 text-2xl font-bold tracking-tight text-foreground">My Profile & Settings</h2>
                    <p className="text-sm text-muted-foreground/80">Manage your technician account settings.</p>
                </div>
                <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-8 lg:space-x-12">
                    <aside className="md:w-1/4 lg:w-1/5">
                        <nav className="flex space-x-2 md:flex-col md:space-x-0 md:space-y-2 overflow-x-auto pb-2 scrollbar-hide">
                            {sidebarItems.map((item) => (
                                <Button key={item.id} variant={activeTab === item.id ? "default" : "ghost"} className={`justify-start whitespace-nowrap rounded-xl ${activeTab === item.id ? "bg-slate-900 text-white shadow-sm" : "hover:bg-muted/50 text-muted-foreground"}`} onClick={() => handleTabChange(item.id)}>
                                    <item.icon className="mr-2 h-4 w-4" /> {item.label}
                                </Button>
                            ))}
                            <Separator className="my-4 hidden md:block" />
                            <Button variant="ghost" className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50 hidden md:flex rounded-xl" onClick={() => { logout(); navigate('/'); }}>
                                <LogOut className="mr-2 h-4 w-4" /> Log out
                            </Button>
                        </nav>
                    </aside>
                    <div className="flex-1 lg:max-w-3xl">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TechnicianProfile;
