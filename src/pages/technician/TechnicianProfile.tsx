import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { AppAnalyticsConsent } from '@/components/AppAnalyticsConsent';
import { AppUpdatePanel } from '@/components/AppUpdatePanel';
import { useTheme } from "@/components/item-providers/ThemeProvider";
import { TechBack, TechLanguageSheet, TechPage, TechSwitch } from "@/components/technician/app/TechUi";
import { useSocket } from "@/contexts/SocketContext";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { apiFetch, apiUrl } from "@/lib/api";
import { serviceArt, serviceOf } from "@/lib/services";
import { TECH_SUPPORT_PHONE, techInitials } from "@/lib/technicianApp";
import { techRupees, techServiceName, useTechText } from "@/lib/technicianLanguage";
import { setTechnicianNavSettings } from "@/lib/technicianNavSettings";
import { TECH_LANGUAGES, type TechTextKey } from "@/lib/technicianText";
import { calculateRewardPoints } from "@/utils/technicianDashboard";
import { isTowingTechnician } from "@/utils/technicianRole";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";

const THEMES: Array<{ value: ThemeMode; icon: string }> = [
    { value: "light", icon: "light_mode" },
    { value: "dark", icon: "dark_mode" },
    { value: "system", icon: "phone_iphone" },
];
const THEME_LABEL: Record<ThemeMode, TechTextKey> = { light: "screen.light", dark: "screen.dark", system: "screen.system" };
const VERIFICATION_LABEL: Record<string, TechTextKey> = {
    pending: "work.status.pending",
    verified: "work.status.verified",
    rejected: "work.status.rejected",
};

const resolveTechnicianImageUrl = (value: unknown) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : apiUrl(raw);
};

const TechnicianProfile = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { technician, isLoading, logout, refreshTechnician } = useTechnicianAuth();
    const { socket } = useSocket();
    const { theme, setTheme } = useTheme();
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);

    const activeTab = searchParams.get("tab") || "menu";
    const { lang, t } = useTechText();
    const [languageOpen, setLanguageOpen] = useState(false);

    const handleTabChange = (id: string) => {
        setSearchParams({ tab: id });
    };

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
        if (patch.navigation) {
            setTechnicianNavSettings({
                enabled: next.navigation.mobile_bottom_nav_enabled !== false,
                autoHide: next.navigation.auto_hide_bottom_nav !== false,
            });
        }

        setIsSaving(true);
        try {
            await apiFetch("/api/technicians/me/settings", {
                method: "PATCH", body: JSON.stringify(patch), technician: true
            });
        } catch (err) {
            setSettingsState(prev);
            if (patch.navigation) {
                setTechnicianNavSettings({
                    enabled: prev.navigation.mobile_bottom_nav_enabled !== false,
                    autoHide: prev.navigation.auto_hide_bottom_nav !== false,
                });
            }
            toast.error("Failed to update settings");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !technician) {
        return <TechPage tab="me"><p className="tp-empty" role="status">{t("common.loading")}</p></TechPage>;
    }

    const profileData = liveTechnician || technician;
    const profileImageUrl = resolveTechnicianImageUrl(profilePhotoPath || profileData?.documents?.profile_photo);
    const ratingLabel = Number(profileData?.rating || 0).toFixed(1);

    const displayName = String(profileData?.name || profileData?.email?.split("@")[0] || "Technician");
    const technicianIdentifier = String(profileData?.technician_id || profileData?.sp_id || profileData?.id || "");
    const verification = String(profileData?.verification_status || "pending").toLowerCase();
    const verificationTone = verification === "verified" ? "is-ok" : verification === "rejected" ? "is-no" : "is-wait";
    const verificationLabel = verification in VERIFICATION_LABEL ? t(VERIFICATION_LABEL[verification]) : verification;
    const jobsDone = Number(liveStats.completedJobs || profileData?.jobs_completed || 0);
    const totalEarned = Number(liveStats.totalEarnings || profileData?.total_earnings || 0);
    const points = calculateRewardPoints({ totalEarnings: totalEarned, completedJobs: jobsDone });
    const specialties: string[] = Array.isArray(profileData?.specialties) ? profileData.specialties : [];
    const languageName = TECH_LANGUAGES.find((language) => language.code === lang)?.name ?? "English";
    const themeName = t(THEME_LABEL[settingsState.appearance.theme] ?? "screen.system");
    const alertsOn = settingsState.notifications.push_notifications || settingsState.notifications.email_notifications;
    const photo = (
        <span className="tp-photo" aria-hidden="true">
            {profileImageUrl ? <img src={profileImageUrl} alt="" /> : techInitials(displayName)}
        </span>
    );
    const backToMe = <TechBack onClick={() => handleTabChange("menu")} />;

    const renderContent = () => {
        switch (activeTab) {
            case "profile":
                return (
                    <form onSubmit={handleProfileSubmit} data-testid="technician-details">
                        {backToMe}
                        <h1 className="tp-h1 tp-pj">{t("details.title")}</h1>
                        <div className="tp-photo-card">
                            {photo}
                            <p>{t("details.photoNote")}</p>
                            <div className="tp-three">
                                <button type="button" className="tp-press" disabled={isUploadingPhoto} onClick={() => galleryInputRef.current?.click()}>
                                    <MaterialSymbol name="photo_library" />
                                    {t("details.gallery")}
                                </button>
                                <button type="button" className="tp-press" disabled={isUploadingPhoto} onClick={() => cameraInputRef.current?.click()}>
                                    <MaterialSymbol name="photo_camera" />
                                    {t("details.camera")}
                                </button>
                                {profilePhotoPath ? (
                                    <button type="button" className="is-warn tp-press" disabled={isUploadingPhoto} onClick={handleRemoveProfilePhoto}>
                                        <MaterialSymbol name="delete" />
                                        {t("details.remove")}
                                    </button>
                                ) : null}
                            </div>
                            <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={handleProfilePhotoSelection} />
                            <input ref={cameraInputRef} type="file" accept="image/*" capture="user" hidden onChange={handleProfilePhotoSelection} />
                        </div>
                        <label className="tp-field">
                            <small>{t("details.name")}</small>
                            <span className="tp-input">
                                <MaterialSymbol name="person" />
                                <input name="name" value={formData.name} onChange={handleProfileChange} autoComplete="name" />
                            </span>
                        </label>
                        <label className="tp-field">
                            <small>{t("details.email")}</small>
                            <span className="tp-input is-locked">
                                <MaterialSymbol name="lock" />
                                <input value={profileData?.email || ""} disabled readOnly />
                            </span>
                        </label>
                        <p className="tp-hint">{t("details.emailNote")}</p>
                        <label className="tp-field">
                            <small>{t("details.phone")}</small>
                            <span className="tp-input">
                                <MaterialSymbol name="call" />
                                <input name="phone" type="tel" value={formData.phone} onChange={handleProfileChange} autoComplete="tel" />
                            </span>
                        </label>
                        <label className="tp-field">
                            <small>{t("details.address")}</small>
                            <span className="tp-input">
                                <MaterialSymbol name="location_on" />
                                <input name="address" value={formData.address} onChange={handleProfileChange} autoComplete="street-address" />
                            </span>
                        </label>
                        <label className="tp-field">
                            <small>{t("details.range")}</small>
                            <span className="tp-input">
                                <input type="number" inputMode="numeric" name="service_area_range" value={formData.service_area_range} onChange={handleProfileChange} />
                            </span>
                        </label>
                        <p className="tp-hint">{t("details.rangeNote")}</p>
                        <label className="tp-field">
                            <small>{t("details.experience")}</small>
                            <span className="tp-input">
                                <input type="number" inputMode="numeric" name="experience" value={formData.experience} onChange={handleProfileChange} />
                            </span>
                        </label>
                        <button type="submit" className="tp-big tp-press" style={{ marginTop: 18 }} disabled={isSaving}>
                            {isSaving ? t("common.saving") : t("common.save")}
                        </button>
                    </form>
                );
            case "stats":
                return (
                    <div data-testid="technician-work">
                        {backToMe}
                        <h1 className="tp-h1 tp-pj">{t("work.title")}</h1>
                        <div className="tp-list tp-amounts" style={{ marginTop: 14 }}>
                            <div className="tp-row">
                                <span className="is-label">{t("work.documents")}</span>
                                <span className={cn("tp-tag", verificationTone)} style={{ marginLeft: "auto" }}>
                                    {verification === "verified" ? <MaterialSymbol name="verified" /> : null}
                                    {verificationLabel}
                                </span>
                            </div>
                            <div className="tp-row"><span className="is-label">{t("work.jobsDone")}</span><b>{jobsDone}</b></div>
                            <div className="tp-row"><span className="is-label">{t("work.total")}</span><b>{techRupees(totalEarned)}</b></div>
                        </div>
                        <h2 className="tp-h2 tp-pj">{t("work.whatIDo")}</h2>
                        <div className="tp-list">
                            {specialties.length === 0 ? (
                                <p className="tp-empty">{t("work.none")}</p>
                            ) : (
                                specialties.map((specialty) => {
                                    const art = serviceArt(specialty);
                                    return (
                                        <div key={specialty} className="tp-row">
                                            <span className="tp-thumb" aria-hidden="true">
                                                {art ? <img src={art} alt="" draggable={false} /> : <MaterialSymbol name="build" />}
                                            </span>
                                            <span className="tp-text"><b>{serviceOf(specialty) ? techServiceName(lang, specialty) : specialty}</b></span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <p className="tp-fine">{t("work.changeNote")}</p>
                    </div>
                );
            case "appearance":
                return (
                    <div data-testid="technician-screen">
                        {backToMe}
                        <h1 className="tp-h1 tp-pj">{t("screen.title")}</h1>
                        <p className="tp-day">{t("screen.lightDark")}</p>
                        <div className="tp-three" role="radiogroup" aria-label={t("screen.lightDark")} style={{ marginTop: 0 }}>
                            {THEMES.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={settingsState.appearance.theme === option.value}
                                    className={cn("tp-press", settingsState.appearance.theme === option.value && "is-on")}
                                    onClick={() => updateSettings({ appearance: { theme: option.value } })}
                                >
                                    <MaterialSymbol name={option.icon} />
                                    {t(THEME_LABEL[option.value])}
                                </button>
                            ))}
                        </div>
                        <p className="tp-day">{t("screen.bar")}</p>
                        <div className="tp-list">
                            <div className="tp-row is-tall">
                                <span className="tp-text"><b>{t("screen.showBar")}</b><span className="is-wrap">{t("screen.showBarSub")}</span></span>
                                <TechSwitch
                                    label={t("screen.showBar")}
                                    checked={!!settingsState.navigation.mobile_bottom_nav_enabled}
                                    onChange={(c) => updateSettings({ navigation: { mobile_bottom_nav_enabled: c } })}
                                />
                            </div>
                            <div className="tp-row is-tall">
                                <span className="tp-text"><b>{t("screen.hideBar")}</b><span className="is-wrap">{t("screen.hideBarSub")}</span></span>
                                <TechSwitch
                                    label={t("screen.hideBar")}
                                    checked={!!settingsState.navigation.auto_hide_bottom_nav}
                                    disabled={!settingsState.navigation.mobile_bottom_nav_enabled}
                                    onChange={(c) => updateSettings({ navigation: { auto_hide_bottom_nav: c } })}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "notifications":
                return (
                    <div data-testid="technician-alerts">
                        {backToMe}
                        <h1 className="tp-h1 tp-pj">{t("alertsPage.title")}</h1>
                        <div className="tp-list" style={{ marginTop: 14 }}>
                            <div className="tp-row is-tall">
                                <span className="tp-ic is-amber" aria-hidden="true"><MaterialSymbol name="notifications_active" /></span>
                                <span className="tp-text"><b>{t("alertsPage.phone")}</b><span className="is-wrap">{t("alertsPage.phoneSub")}</span></span>
                                <TechSwitch
                                    label={t("alertsPage.phone")}
                                    checked={settingsState.notifications.push_notifications}
                                    onChange={(c) => updateSettings({ notifications: { push_notifications: c } })}
                                />
                            </div>
                            <div className="tp-row is-tall">
                                <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="mail" /></span>
                                <span className="tp-text"><b>{t("alertsPage.email")}</b><span className="is-wrap">{t("alertsPage.emailSub")}</span></span>
                                <TechSwitch
                                    label={t("alertsPage.email")}
                                    checked={settingsState.notifications.email_notifications}
                                    onChange={(c) => updateSettings({ notifications: { email_notifications: c } })}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "security":
                return (
                    <div data-testid="technician-security">
                        {backToMe}
                        <h1 className="tp-h1 tp-pj">{t("security.title")}</h1>
                        <button type="button" className="tp-big is-plain tp-press" style={{ marginTop: 16 }}>
                            <MaterialSymbol name="lock_reset" />
                            {t("security.password")}
                        </button>
                        <button type="button" className="tp-big is-warn tp-press" onClick={() => toast.success("Cache cleared")}>
                            <MaterialSymbol name="delete" />
                            {t("security.clear")}
                        </button>
                        <p className="tp-fine">{t("security.note")}</p>
                    </div>
                );
            default:
                return (
                    <div data-testid="technician-me">
                        <div className="tp-id">
                            {photo}
                            <div className="tp-id-text">
                                <h1 className="tp-pj">{displayName}</h1>
                                {technicianIdentifier ? <span>{t("me.id", { id: technicianIdentifier })}</span> : null}
                                <span>{profileData?.email}</span>
                            </div>
                        </div>
                        <div className="tp-tags">
                            <span className={cn("tp-tag", verificationTone)}>
                                {verification === "verified" ? <MaterialSymbol name="verified" /> : null}
                                {verificationLabel}
                            </span>
                            <span className="tp-tag is-star"><MaterialSymbol name="star" />{ratingLabel}</span>
                            <span className="tp-tag is-pts"><MaterialSymbol name="workspace_premium" />{t("home.points", { n: points })}</span>
                        </div>
                        <div className="tp-list" style={{ marginTop: 16 }}>
                            <button type="button" className="tp-row" onClick={() => handleTabChange("profile")}>
                                <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="person" /></span>
                                <span className="tp-text"><b>{t("me.details")}</b><span>{t("me.detailsSub")}</span></span>
                                <MaterialSymbol name="chevron_right" className="tp-chev" />
                            </button>
                            <button type="button" className="tp-row" onClick={() => handleTabChange("stats")}>
                                <span className="tp-ic is-blue" aria-hidden="true"><MaterialSymbol name="build" /></span>
                                <span className="tp-text"><b>{t("me.work")}</b><span>{t("me.workSub")}</span></span>
                                <MaterialSymbol name="chevron_right" className="tp-chev" />
                            </button>
                            {isTowingTechnician(profileData) ? (
                                <button type="button" className="tp-row" onClick={() => navigate("/technician/dashboard?view=fleet")}>
                                    <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="auto_towing" /></span>
                                    <span className="tp-text"><b>{t("me.fleet")}</b></span>
                                    <MaterialSymbol name="chevron_right" className="tp-chev" />
                                </button>
                            ) : null}
                            <button type="button" className="tp-row" onClick={() => handleTabChange("notifications")}>
                                <span className="tp-ic is-amber" aria-hidden="true"><MaterialSymbol name="notifications_active" /></span>
                                <span className="tp-text"><b>{t("me.alerts")}</b></span>
                                <span className="tp-val">{t(alertsOn ? "common.on" : "common.off")}</span>
                                <MaterialSymbol name="chevron_right" className="tp-chev" />
                            </button>
                            <button type="button" className="tp-row" onClick={() => setLanguageOpen(true)}>
                                <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="translate" /></span>
                                <span className="tp-text"><b>{t("me.language")}</b></span>
                                <span className="tp-val">{languageName}</span>
                                <MaterialSymbol name="chevron_right" className="tp-chev" />
                            </button>
                            <button type="button" className="tp-row" onClick={() => handleTabChange("appearance")}>
                                <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="contrast" /></span>
                                <span className="tp-text"><b>{t("me.screen")}</b></span>
                                <span className="tp-val">{themeName}</span>
                                <MaterialSymbol name="chevron_right" className="tp-chev" />
                            </button>
                            <button type="button" className="tp-row" onClick={() => handleTabChange("security")}>
                                <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="lock" /></span>
                                <span className="tp-text"><b>{t("me.security")}</b></span>
                                <MaterialSymbol name="chevron_right" className="tp-chev" />
                            </button>
                        </div>
                        <a className="tp-big is-plain is-help tp-press" href={`tel:${TECH_SUPPORT_PHONE}`}>
                            <MaterialSymbol name="call" />
                            {t("common.callHelp")}
                        </a>
                        <div className="tp-list" style={{ marginTop: 12 }}>
                            <button type="button" className="tp-row is-danger" style={{ minHeight: 64 }} onClick={() => { logout(); navigate("/"); }}>
                                <span className="tp-ic is-red" aria-hidden="true"><MaterialSymbol name="logout" /></span>
                                <span className="tp-text"><b>{t("me.logout")}</b></span>
                            </button>
                        </div>
                        <TechLanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
                    </div>
                );
        }
    };

    return <TechPage tab="me" testId="technician-profile">{renderContent()}<AppUpdatePanel /><AppAnalyticsConsent /></TechPage>;
};

export default TechnicianProfile;
