import React, { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/item-providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Bell, Shield, Smartphone, Mail, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type ThemeMode = "light" | "dark" | "system";

type TechnicianSettingsState = {
    appearance: {
        theme: ThemeMode;
    };
    notifications: {
        email_notifications: boolean;
        push_notifications: boolean;
    };
};

const DEFAULT_TECH_SETTINGS: TechnicianSettingsState = {
    appearance: {
        theme: "system"
    },
    notifications: {
        email_notifications: true,
        push_notifications: true
    }
};

const mergeSettings = (
    base: TechnicianSettingsState,
    patch?: Partial<TechnicianSettingsState> | null
): TechnicianSettingsState => ({
    appearance: {
        ...base.appearance,
        ...(patch?.appearance || {})
    },
    notifications: {
        ...base.notifications,
        ...(patch?.notifications || {})
    }
});

const TechnicianSettings = () => {
    const { theme, setTheme } = useTheme();
    const [settings, setSettings] = useState<TechnicianSettingsState>(DEFAULT_TECH_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await apiFetch("/api/technicians/me/settings", { technician: true });
            if (!res.ok) {
                throw new Error("Failed to fetch settings");
            }
            const data = await res.json();
            const next = mergeSettings(DEFAULT_TECH_SETTINGS, data);
            setSettings(next);
            setTheme(next.appearance.theme);
        } catch (error) {
            console.error("Failed to fetch technician settings", error);
            setSettings(DEFAULT_TECH_SETTINGS);
            toast.error("Failed to load settings. Using defaults.");
        } finally {
            setIsLoading(false);
        }
    }, [setTheme, theme]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const updateSettings = async (patch: Partial<TechnicianSettingsState>) => {
        const previous = settings;
        const optimistic = mergeSettings(previous, patch);
        setSettings(optimistic);
        if (patch.appearance?.theme && patch.appearance.theme !== theme) {
            setTheme(patch.appearance.theme);
        }

        try {
            setIsSaving(true);
            const res = await apiFetch("/api/technicians/me/settings", {
                method: "PATCH",
                body: JSON.stringify(patch),
                technician: true
            });
            if (!res.ok) {
                throw new Error("Failed to save technician settings");
            }
            const body = await res.json();
            const next = mergeSettings(DEFAULT_TECH_SETTINGS, body?.settings || {});
            setSettings(next);
            setTheme(next.appearance.theme);
        } catch (error) {
            console.error("Failed to update technician settings", error);
            setSettings(previous);
            setTheme(previous.appearance.theme);
            toast.error("Failed to update settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleThemeChange = (newTheme: ThemeMode) => {
        updateSettings({ appearance: { theme: newTheme } });
        toast.success(`Theme updated to ${newTheme}`);
    };

    const handleClearData = () => {
        localStorage.removeItem("resqnow_tech_prefs");
        toast.success("Local preferences cleared");
    };

    const appVersion = import.meta.env.VITE_APP_VERSION || "local";
    const buildDate = import.meta.env.VITE_BUILD_DATE || "runtime";

    return (
        <div className="container max-w-4xl py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage appearance, notifications, and application preferences.</p>
            </div>

            <div className="grid gap-6">
                {(isLoading || isSaving) && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {isLoading ? "Loading settings..." : "Saving settings..."}
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Sun className="h-5 w-5 text-orange-500" />
                            <CardTitle>Appearance</CardTitle>
                        </div>
                        <CardDescription>Customize how the technician portal looks.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Theme Mode</Label>
                                <p className="text-sm text-muted-foreground">Select your preferred display mode.</p>
                            </div>
                            <div className="flex gap-2 bg-secondary p-1 rounded-lg">
                                <Button
                                    variant={settings.appearance.theme === "light" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => handleThemeChange("light")}
                                    className="h-8"
                                    disabled={isLoading || isSaving}
                                >
                                    <Sun className="h-4 w-4 mr-2" /> Light
                                </Button>
                                <Button
                                    variant={settings.appearance.theme === "dark" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => handleThemeChange("dark")}
                                    className="h-8"
                                    disabled={isLoading || isSaving}
                                >
                                    <Moon className="h-4 w-4 mr-2" /> Dark
                                </Button>
                                <Button
                                    variant={settings.appearance.theme === "system" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => handleThemeChange("system")}
                                    className="h-8"
                                    disabled={isLoading || isSaving}
                                >
                                    <Globe className="h-4 w-4 mr-2" /> System
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-blue-500" />
                            <CardTitle>Notifications</CardTitle>
                        </div>
                        <CardDescription>Control how you want to be notified about new jobs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <Label className="text-base">Email Notifications</Label>
                                </div>
                                <p className="text-sm text-muted-foreground">Receive job summaries and daily reports via email.</p>
                            </div>
                            <Switch
                                checked={!!settings.notifications.email_notifications}
                                disabled={isLoading || isSaving}
                                onCheckedChange={(checked) => updateSettings({
                                    notifications: { email_notifications: checked }
                                })}
                            />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                                    <Label className="text-base">Push Notifications</Label>
                                </div>
                                <p className="text-sm text-muted-foreground">Receive instant alerts for new service requests.</p>
                            </div>
                            <Switch
                                checked={!!settings.notifications.push_notifications}
                                disabled={isLoading || isSaving}
                                onCheckedChange={(checked) => updateSettings({
                                    notifications: { push_notifications: checked }
                                })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-green-500" />
                            <CardTitle>Security & Privacy</CardTitle>
                        </div>
                        <CardDescription>Manage your account security.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Change Password</Label>
                                <p className="text-sm text-muted-foreground">Update your password regularly to keep your account safe.</p>
                            </div>
                            <Button variant="outline">Update Password</Button>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base text-red-600">Clear App Data</Label>
                                <p className="text-sm text-muted-foreground">Clear local cache and troubleshooting data.</p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={handleClearData}>Clear Data</Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="text-center text-xs text-muted-foreground pt-4">
                    ResQNow Technician App v{appVersion} | Build {buildDate}
                </div>
            </div>
        </div>
    );
};

export default TechnicianSettings;
