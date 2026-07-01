import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import {
  User,
  BarChart,
  Car,
  Bell,
  Shield,
  Palette,
  LogOut,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Briefcase
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { Separator } from "@/components/ui/separator"
import ProfileSettings from "@/components/settings/ProfileSettings"
import ThemeCustomizer from "@/components/settings/ThemeCustomizer"
import UsageStats from "@/components/settings/UsageStats"
import MyGarage from "@/components/MyGarage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { apiFetch } from "@/lib/api"
import { useTheme } from "@/components/item-providers/ThemeProvider"
import { toast } from "sonner"

type ThemeMode = "light" | "dark" | "system"

type UserSettings = {
  appearance: {
    theme: ThemeMode
    force_dark_mode: boolean
  }
  notifications: {
    service_updates_email: boolean
    marketing_email: boolean
    push_alerts: boolean
  }
  navigation: {
    mobile_bottom_nav_enabled: boolean
    auto_hide_bottom_nav: boolean
  }
  privacy: {
    email_visibility: string
  }
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  appearance: {
    theme: "system",
    force_dark_mode: false
  },
  notifications: {
    service_updates_email: true,
    marketing_email: true,
    push_alerts: false
  },
  navigation: {
    mobile_bottom_nav_enabled: true,
    auto_hide_bottom_nav: true
  },
  privacy: {
    email_visibility: "verified_only"
  }
}

type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

const mergeUserSettings = (
  base: UserSettings,
  patch?: DeepPartial<UserSettings> | null
): UserSettings => ({
  appearance: {
    ...base.appearance,
    ...(patch?.appearance || {})
  },
  notifications: {
    ...base.notifications,
    ...(patch?.notifications || {})
  },
  navigation: {
    ...base.navigation,
    ...(patch?.navigation || {})
  },
  privacy: {
    ...base.privacy,
    ...(patch?.privacy || {})
  }
})

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const { setTheme } = useTheme()

  const isMobile = useIsMobile()

  // Get active tab from URL or default to 'menu' on mobile, 'profile' on desktop
  const activeTab = searchParams.get("tab") || (isMobile ? "menu" : "profile")

  const sidebarItems = [
    { id: "profile", label: "Profile", icon: User, description: "Manage your personal info" },
    { id: "garage", label: "My Garage", icon: Car, description: "Manage your vehicles" },
    { id: "appearance", label: "Appearance", icon: Palette, description: "Theme and display settings" },
    { id: "notifications", label: "Notifications", icon: Bell, description: "Email and push preferences" },
    { id: "privacy", label: "Privacy & Security", icon: Shield, description: "Password and security" },
    { id: "stats", label: "Usage Statistics", icon: BarChart, description: "Your activity overview" },
  ]

  const handleTabChange = (id: string) => {
    setSearchParams({ tab: id })
  }

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const fetchSettings = useCallback(async () => {
    if (!user?.id) {
      setSettingsLoading(false)
      return
    }
    try {
      setSettingsLoading(true)
      const res = await apiFetch("/api/users/me/settings")
      if (!res.ok) {
        throw new Error("Failed to load settings")
      }
      const data = await res.json()
      const normalized = mergeUserSettings(DEFAULT_USER_SETTINGS, data)
      setSettings(normalized)
      setTheme(normalized.appearance.theme)
    } catch (error) {
      console.error("Failed to fetch settings", error)
      toast.error("Failed to load settings. Using defaults.")
      setSettings(DEFAULT_USER_SETTINGS)
    } finally {
      setSettingsLoading(false)
    }
  }, [setTheme, user?.id])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (patch: DeepPartial<UserSettings>) => {
    const previous = settings
    const optimistic = mergeUserSettings(previous, patch)
    setSettings(optimistic)
    if (patch.appearance?.theme) {
      setTheme(patch.appearance.theme)
    }

    try {
      setIsSavingSettings(true)
      const res = await apiFetch("/api/users/me/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        throw new Error("Failed to save settings")
      }

      const body = await res.json()
      const normalized = mergeUserSettings(DEFAULT_USER_SETTINGS, body?.settings || {})
      setSettings(normalized)
      setTheme(normalized.appearance.theme)
    } catch (error) {
      console.error("Failed to update settings", error)
      setSettings(previous)
      setTheme(previous.appearance.theme)
      toast.error("Failed to save settings")
    } finally {
      setIsSavingSettings(false)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSettings />
      case "garage":
        return <MyGarage />
      case "appearance":
        return (
          <div className="zomato-card space-y-4">
            <div className="pb-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Appearance</h3>
              <p className="text-xs text-muted-foreground/80">Customize how the app looks and feels.</p>
            </div>
            {settingsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground/60">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading settings...
              </div>
            ) : (
              <div className="space-y-4">
                <ThemeCustomizer
                  onThemeChange={(nextTheme) => updateSettings({
                    appearance: {
                      theme: nextTheme,
                      force_dark_mode: nextTheme === "dark"
                    }
                  })}
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Navigation</CardTitle>
                    <CardDescription>Control mobile bottom navigation behavior.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Show Bottom Navigation</Label>
                        <p className="text-sm text-muted-foreground">Enable mobile bottom navigation bar.</p>
                      </div>
                      <Switch
                        checked={!!settings.navigation.mobile_bottom_nav_enabled}
                        onCheckedChange={(checked) => updateSettings({
                          navigation: { mobile_bottom_nav_enabled: checked }
                        })}
                        disabled={settingsLoading || isSavingSettings}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Auto-hide Navigation</Label>
                        <p className="text-sm text-muted-foreground">Hide on scroll down and show on scroll up.</p>
                      </div>
                      <Switch
                        checked={!!settings.navigation.auto_hide_bottom_nav}
                        onCheckedChange={(checked) => updateSettings({
                          navigation: { auto_hide_bottom_nav: checked }
                        })}
                        disabled={settingsLoading || isSavingSettings || !settings.navigation.mobile_bottom_nav_enabled}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )
      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Notifications</h3>
              <p className="text-sm text-muted-foreground">Choose what updates you want to receive.</p>
            </div>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>Manage your email settings here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Service Updates</Label>
                    <p className="text-sm text-muted-foreground">Receive emails about your service request status.</p>
                  </div>
                  <Switch
                    checked={!!settings.notifications.service_updates_email}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { service_updates_email: checked }
                    })}
                    disabled={settingsLoading || isSavingSettings}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Marketing Emails</Label>
                    <p className="text-sm text-muted-foreground">Receive emails about new features and promotions.</p>
                  </div>
                  <Switch
                    checked={!!settings.notifications.marketing_email}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { marketing_email: checked }
                    })}
                    disabled={settingsLoading || isSavingSettings}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Push Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Push Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get real-time updates on your device.</p>
                  </div>
                  <Switch
                    checked={!!settings.notifications.push_alerts}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { push_alerts: checked }
                    })}
                    disabled={settingsLoading || isSavingSettings}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )
      case "stats":
        return (
          <div className="zomato-card space-y-4">
            <div className="pb-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Usage Statistics</h3>
              <p className="text-xs text-muted-foreground/80">Track your service history and activity.</p>
            </div>
            <UsageStats />
          </div>
        )
      case "privacy":
        return (
          <div className="zomato-card space-y-4">
            <div className="pb-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Privacy & Security</h3>
              <p className="text-xs text-muted-foreground/80">Manage your account security.</p>
            </div>
            <div className="space-y-4">
              <Button variant="outline" className="w-full justify-start h-12 rounded-xl">Change Password</Button>
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 h-12 rounded-xl border-red-200">Delete Account</Button>
            </div>
          </div>
        )
      default:
        return <ProfileSettings />
    }
  }

  if (isMobile) {
    if (activeTab === "menu") {
      return (
        <div className="min-h-screen bg-muted pb-20 fade-in-0 animate-in duration-300">
          <div className="bg-card dark:bg-slate-900 px-6 pt-12 pb-8 rounded-b-[2rem] shadow-sm mb-6 border-b border-border flex items-center gap-5">
            <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-muted/50 border-[3px] border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
              <User className="w-8 h-8 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black text-foreground tracking-tight truncate">
                {user?.name || user?.email?.split('@')[0] || 'User'}
              </h2>
              <p className="text-sm font-semibold text-muted-foreground/80 truncate mb-2">{user?.email}</p>
              <button onClick={() => handleTabChange('profile')} className="text-red-600 font-bold text-[10px] uppercase tracking-widest bg-red-50 hover:bg-red-100 px-4 py-1.5 rounded-full transition-colors active:scale-95">
                Edit Profile
              </button>
            </div>
          </div>

          <div className="px-4 space-y-4">
            <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border overflow-hidden">
              {sidebarItems.filter(item => item.id !== 'profile').map((item, index) => {
                // Ensure we don't render a separator after the last item
                const isLast = index === sidebarItems.length - 2;
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
                )
              })}
            </div>

            <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border overflow-hidden">
              <button
                onClick={() => navigate('/technician/login')}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-muted active:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Partner with Us</h3>
                    <p className="text-[11px] font-medium text-muted-foreground/80">Earn with ResQNow</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </button>
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
      )
    }

    // Mobile Sub-page view
    const activeItem = sidebarItems.find(i => i.id === activeTab)
    return (
      <div className="min-h-screen bg-muted pb-20 fade-in-0 animate-in slide-in-from-bottom-4 duration-300">
        <div className="sticky top-0 z-50 bg-card dark:bg-slate-900/95 backdrop-blur-md px-4 py-4 flex items-center gap-4 border-b border-border shadow-sm">
          <button onClick={() => handleTabChange('menu')} className="w-10 h-10 flex items-center justify-center bg-muted border border-border rounded-full text-muted-foreground hover:bg-muted/50 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-black text-foreground tracking-tight">{activeItem?.label || 'Profile'}</h2>
        </div>
        <div className="p-4">
          {renderContent()}
        </div>
      </div>
    )
  }

  // Desktop Return
  return (
    <div className="container max-w-7xl mx-auto py-10 px-4 md:px-8">
      <div className="space-y-6">
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Account</h2>
          <p className="text-sm text-muted-foreground/80">
            Manage your account settings and set e-mail preferences.
          </p>
        </div>

        <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-8 lg:space-x-12">
          <aside className="md:w-1/4 lg:w-1/5">
            <nav className="flex space-x-2 md:flex-col md:space-x-0 md:space-y-2 overflow-x-auto pb-2 scrollbar-hide">
              {sidebarItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={`justify-start whitespace-nowrap rounded-xl ${activeTab === item.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/50 text-muted-foreground"}`}
                  onClick={() => handleTabChange(item.id)}
                >
                  <item.icon className={`mr-2 h-4 w-4 ${activeTab === item.id ? "text-primary-foreground" : "text-muted-foreground/80"}`} />
                  {item.label}
                </Button>
              ))}
              <Separator className="my-4 hidden md:block" />
              <Button
                variant="ghost"
                className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50 hidden md:flex"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Button>
            </nav>
          </aside>
          <div className="flex-1 lg:max-w-4xl">
            {isSavingSettings && (
              <div className="mb-3 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving settings...
              </div>
            )}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
