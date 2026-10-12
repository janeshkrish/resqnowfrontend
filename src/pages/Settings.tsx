import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { useTheme } from "@/components/item-providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { apiFetch } from "@/lib/api";
import { GARAGE_QUERY_KEY, listVehicles } from "@/lib/garage";
import { MONTHS, MY_REQUESTS_KEY, fetchMyRequests, requestTime, type MyRequest } from "@/lib/myRequests";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";

type UserSettings = {
  appearance: { theme: ThemeMode; force_dark_mode: boolean };
  notifications: { service_updates_email: boolean; marketing_email: boolean; push_alerts: boolean };
  navigation: { mobile_bottom_nav_enabled: boolean; auto_hide_bottom_nav: boolean };
  privacy: { email_visibility: string };
};

const DEFAULT_USER_SETTINGS: UserSettings = {
  appearance: { theme: "system", force_dark_mode: false },
  notifications: { service_updates_email: true, marketing_email: true, push_alerts: false },
  navigation: { mobile_bottom_nav_enabled: true, auto_hide_bottom_nav: true },
  privacy: { email_visibility: "verified_only" },
};

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

const mergeUserSettings = (base: UserSettings, patch?: DeepPartial<UserSettings> | null): UserSettings => ({
  appearance: { ...base.appearance, ...(patch?.appearance || {}) },
  notifications: { ...base.notifications, ...(patch?.notifications || {}) },
  navigation: { ...base.navigation, ...(patch?.navigation || {}) },
  privacy: { ...base.privacy, ...(patch?.privacy || {}) },
});

// The pages inside Account, by the ?tab= each one has always had.
const VIEWS = { profile: "details", stats: "numbers", notifications: "alerts", appearance: "look", privacy: "security" } as const;
type View = "main" | (typeof VIEWS)[keyof typeof VIEWS];
type Field = "name" | "phone" | "birthday" | "gender";

const THEME_NAMES: Record<ThemeMode, string> = { light: "Light", dark: "Dark", system: "Match phone" };
const SUPPORT_PHONE = "+91 95665 10080";
const SUPPORT_EMAIL = "resqnow01@gmail.com";

const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] ?? "").join("").toUpperCase() || "?";
const birthdayText = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : "";
};
const capital = (text?: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : "");
// Plans are named in capitals ("SMART CARE") and priced "per month".
const planName = (name?: string) => String(name || "").toLowerCase().replace(/(^|[\s-])\w/g, (letter) => letter.toUpperCase());
const planPeriod = (period?: string) => String(period || "month").replace(/^per\s+/i, "");

// Signing in only returns a name and an email; the account's own record has the phone, the plan and the rest.
type Profile = NonNullable<ReturnType<typeof useAuth>["user"]>;
const ACCOUNT_KEY = ["account", "me"] as const;
const fetchAccount = async (): Promise<Partial<Profile>> => {
  const res = await apiFetch("/api/auth/me");
  if (!res.ok) throw new Error("Failed to load account");
  return res.json();
};

/** A sheet that rises from the bottom on phones and sits in the middle on larger screens. */
function Sheet({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rq-sheet-scrim" />
        <Dialog.Content className="rq-sheet rq-ac-sheet" aria-describedby={undefined}>
          <div className="rq-sheet-grab" aria-hidden="true" />
          <Dialog.Title className="rq-sheet-title">{title}</Dialog.Title>
          {sub ? <p className="rq-sheet-sub">{sub}</p> : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Switch({ name, say, on, disabled, onFlip }: { name: string; say: string; on: boolean; disabled?: boolean; onFlip: (next: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="rq-ac-toggle" disabled={disabled} onClick={() => onFlip(!on)}>
      <span className="rq-ac-row-text"><b>{name}</b><span>{say}</span></span>
      <span className={cn("rq-ac-switch", on && "is-on")} aria-hidden="true" />
    </button>
  );
}

/** A page inside Account: back, then its heading. */
function Inner({ title, sub, onBack, children }: { title: string; sub: string; onBack: () => void; children: ReactNode }) {
  return (
    <>
      <button type="button" className="rq-icon-btn rq-press" aria-label="Back to Account" onClick={onBack}><MaterialSymbol name="arrow_back" /></button>
      <p className="rq-ac-kicker">Account</p>
      <h1 className="rq-pg-h1">{title}</h1>
      <p className="rq-pg-sub">{sub}</p>
      {children}
    </>
  );
}

/** How many requests the customer has made, and how they went: the counts and six-month chart Account has always had. */
function Numbers({ requests }: { requests: MyRequest[] }) {
  const state = (request: MyRequest) => String(request.status || "").toLowerCase();
  const total = requests.length;
  const completed = requests.filter((request) => ["completed", "paid"].includes(state(request))).length;
  const cancelled = requests.filter((request) => ["cancelled", "rejected"].includes(state(request))).length;
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const count = requests.filter((request) => {
      const made = new Date(requestTime(request));
      return requestTime(request) > 0 && made.getFullYear() === month.getFullYear() && made.getMonth() === month.getMonth();
    }).length;
    return { name: MONTHS[month.getMonth()], count };
  });
  const most = Math.max(1, ...months.map((month) => month.count));
  return (
    <>
      <div className="rq-ac-group rq-ac-first">
        <p className="rq-ac-count"><span><i aria-hidden="true" />Completed</span><b>{completed}</b></p>
        <p className="rq-ac-count is-live"><span><i aria-hidden="true" />In progress</span><b>{total - completed - cancelled}</b></p>
        <p className="rq-ac-count is-void"><span><i aria-hidden="true" />Cancelled</span><b>{cancelled}</b></p>
      </div>
      <h2 className="rq-ac-sec">Last 6 months</h2>
      <div className="rq-ac-chart" role="img" aria-label={`Requests each month: ${months.map((month) => `${month.name} ${month.count}`).join(", ")}`}>
        {months.map((month, index) => (
          <span key={`${month.name}-${index}`} className={cn("rq-ac-bar", month.count === 0 ? "is-none" : index === months.length - 1 && "is-now")}>
            <b>{month.count}</b>
            <i style={{ height: month.count === 0 ? 4 : Math.round((month.count / most) * 88) }} />
            {month.name}
          </span>
        ))}
      </div>
      <Link to="/my-requests" className="rq-btn rq-btn-soft rq-btn-block rq-ac-wide rq-press">See every request<MaterialSymbol name="arrow_forward" /></Link>
    </>
  );
}

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user: session, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: pricingConfig } = usePricingConfig();

  const tab = searchParams.get("tab") ?? "";
  const view: View = (VIEWS as Record<string, View>)[tab] ?? "main";
  const open = (next: keyof typeof VIEWS) => setSearchParams({ tab: next });
  // Back from a page inside Account: to where the customer came from, or to Account when this was the first page opened.
  const back = () => (location.key !== "default" ? navigate(-1) : setSearchParams({}, { replace: true }));

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!session?.id) {
      setSettingsLoading(false);
      return;
    }
    try {
      setSettingsLoading(true);
      const res = await apiFetch("/api/users/me/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      const normalized = mergeUserSettings(DEFAULT_USER_SETTINGS, data);
      setSettings(normalized);
      setTheme(normalized.appearance.theme);
    } catch (error) {
      console.error("Failed to fetch settings", error);
      toast.error("Failed to load settings. Using defaults.");
      setSettings(DEFAULT_USER_SETTINGS);
    } finally {
      setSettingsLoading(false);
    }
  }, [setTheme, session?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (patch: DeepPartial<UserSettings>) => {
    const previous = settings;
    const optimistic = mergeUserSettings(previous, patch);
    setSettings(optimistic);
    if (patch.appearance?.theme) setTheme(patch.appearance.theme);

    try {
      setIsSavingSettings(true);
      const res = await apiFetch("/api/users/me/settings", { method: "PATCH", body: JSON.stringify(patch) });
      if (!res.ok) throw new Error("Failed to save settings");
      const body = await res.json();
      const normalized = mergeUserSettings(DEFAULT_USER_SETTINGS, body?.settings || {});
      setSettings(normalized);
      setTheme(normalized.appearance.theme);
    } catch (error) {
      console.error("Failed to update settings", error);
      setSettings(previous);
      setTheme(previous.appearance.theme);
      toast.error("Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const accountKey = [...ACCOUNT_KEY, session?.id];
  const me = useQuery({ queryKey: accountKey, queryFn: fetchAccount, enabled: Boolean(session?.id), staleTime: 30_000 });
  const user = session && me.data ? { ...session, ...me.data, id: session.id } : session;
  const garage = useQuery({ queryKey: GARAGE_QUERY_KEY, queryFn: listVehicles, enabled: Boolean(user?.id) });
  const requests = useQuery({ queryKey: MY_REQUESTS_KEY, queryFn: ({ signal }) => fetchMyRequests(signal), enabled: Boolean(user?.id), staleTime: 60_000 });

  // Sheets: one detail being changed, how to reach support, and the question before logging out.
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [support, setSupport] = useState<null | { title: string; sub: string }>(null);
  const [leaving, setLeaving] = useState(false);

  const name = user?.name || user?.email?.split("@")[0] || "User";
  const phone = user?.phone || "";
  const email = user?.email || "";
  const member = Boolean(user?.subscription) && user?.subscription !== "free" && user?.subscription !== "none";
  const plans = pricingConfig?.subscription_plans ?? [];
  const ownPlan = plans.find((plan) => plan.id === user?.subscription);
  const paidPlan = plans.find((plan) => plan.active !== false && Number(plan.amount) > 0);
  const disabled = settingsLoading || isSavingSettings;

  const startEdit = (field: Field) => {
    const current = field === "birthday" ? (user?.birthday ? new Date(user.birthday).toISOString().split("T")[0] : "") : String(user?.[field] ?? "");
    setDraft(current);
    setEditing(field);
  };
  const saveEdit = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await updateProfile({ [editing]: draft.trim() });
      queryClient.setQueryData<Partial<Profile>>(accountKey, (old) => ({ ...old, [editing]: draft.trim() }));
      void queryClient.invalidateQueries({ queryKey: accountKey });
      setEditing(null);
    } catch {
      // updateProfile has already said what went wrong.
    } finally {
      setSaving(false);
    }
  };
  const openSupport = () => setSupport({ title: "Contact support", sub: "Pick how you’d like to reach us." });
  const askAssistant = () => {
    setSupport(null);
    window.dispatchEvent(new Event("resqnow:open-chat"));
  };

  // My garage is its own page.
  if (tab === "garage") return <Navigate to="/my-garage" replace />;

  const EDIT: Record<Field, { title: string; sub: string }> = {
    name: { title: "Your name", sub: "What your technician will call you." },
    phone: { title: "Phone number", sub: "Your technician calls this number when they are on the way." },
    birthday: { title: "Birthday", sub: "Day, month and year." },
    gender: { title: "Gender", sub: "Pick one." },
  };

  let body: ReactNode;
  if (view === "details") {
    const fields: { id: Field; label: string; value: string }[] = [
      { id: "name", label: "Name", value: user?.name || "" },
      { id: "phone", label: "Phone", value: phone },
      { id: "birthday", label: "Birthday", value: birthdayText(user?.birthday) },
      { id: "gender", label: "Gender", value: capital(user?.gender) },
    ];
    const row = (field: (typeof fields)[number]) => (
      <button key={field.id} type="button" className="rq-ac-field" onClick={() => startEdit(field.id)} aria-label={`${field.label}: ${field.value || "not added"}. ${field.value ? "Change" : "Add"}`}>
        <span className="rq-ac-field-text"><span>{field.label}</span><b className={field.value ? undefined : "is-none"}>{field.value || "Not added"}</b></span>
        <span className="rq-text-btn" aria-hidden="true">{field.value ? "Change" : "Add"}</span>
      </button>
    );
    body = (
      <Inner title="Your details" sub="Your technician sees your name and calls your phone number." onBack={back}>
        <div className="rq-ac-group rq-ac-first">
          {fields.slice(0, 2).map(row)}
          <div className="rq-ac-field">
            <span className="rq-ac-field-text"><span>Email</span><b>{email}</b></span>
            {user?.isVerified ? <span className="rq-ac-ok"><MaterialSymbol name="verified" />Verified</span> : null}
          </div>
          {fields.slice(2).map(row)}
        </div>
        <p className="rq-ac-note">Your email is how you sign in, so it can’t be changed here.</p>
      </Inner>
    );
  } else if (view === "numbers") {
    const total = requests.data?.length ?? 0;
    body = (
      <Inner title="Your requests" sub={requests.isPending ? "Counting your requests…" : `${total} ${total === 1 ? "request" : "requests"} so far.`} onBack={back}>
        <Numbers requests={requests.data ?? []} />
      </Inner>
    );
  } else if (view === "alerts") {
    body = (
      <Inner title="Alerts" sub="How we tell you what’s happening with your request." onBack={back}>
        <div className="rq-ac-group rq-ac-first">
          <Switch name="Alerts on this phone" say="Technician found, on the way and arrived" on={!!settings.notifications.push_alerts} disabled={disabled} onFlip={(push_alerts) => updateSettings({ notifications: { push_alerts } })} />
          <Switch name="Request updates by email" say={email ? `Sent to ${email}` : "About your request’s progress"} on={!!settings.notifications.service_updates_email} disabled={disabled} onFlip={(service_updates_email) => updateSettings({ notifications: { service_updates_email } })} />
          <Switch name="Offers and news by email" say="New services and discounts" on={!!settings.notifications.marketing_email} disabled={disabled} onFlip={(marketing_email) => updateSettings({ notifications: { marketing_email } })} />
        </div>
        <p className="rq-ac-note">If alerts don’t arrive, allow notifications for ResQNow in your phone’s settings. Calls from your technician always come through.</p>
      </Inner>
    );
  } else if (view === "look") {
    const picked = settings.appearance.theme || (theme as ThemeMode);
    body = (
      <Inner title="Appearance" sub="How the app looks on this phone." onBack={back}>
        <div className="rq-ac-themes" role="radiogroup" aria-label="Theme">
          {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={picked === mode} disabled={disabled} className={cn("rq-ac-theme rq-press", picked === mode && "is-on")} onClick={() => updateSettings({ appearance: { theme: mode, force_dark_mode: mode === "dark" } })}>
              {picked === mode ? <span className="rq-ac-tick" aria-hidden="true"><MaterialSymbol name="check" /></span> : null}
              <span className={cn("rq-ac-screen", mode === "dark" && "is-dark", mode === "system" && "is-auto")} aria-hidden="true"><i /><i /><i /></span>
              {THEME_NAMES[mode]}
            </button>
          ))}
        </div>
        <h2 className="rq-ac-sec">Bottom bar</h2>
        <div className="rq-ac-group">
          <Switch name="Show the bottom bar" say="Home, Map, Get help, Activity, Account" on={!!settings.navigation.mobile_bottom_nav_enabled} disabled={disabled} onFlip={(mobile_bottom_nav_enabled) => updateSettings({ navigation: { mobile_bottom_nav_enabled } })} />
          <Switch name="Hide it while scrolling" say="It comes back when you scroll up" on={!!settings.navigation.auto_hide_bottom_nav && !!settings.navigation.mobile_bottom_nav_enabled} disabled={disabled || !settings.navigation.mobile_bottom_nav_enabled} onFlip={(auto_hide_bottom_nav) => updateSettings({ navigation: { auto_hide_bottom_nav } })} />
        </div>
      </Inner>
    );
  } else if (view === "security") {
    const viaSupport = (title: string) => setSupport({ title, sub: "This isn’t in the app yet. Our support team will do it for you." });
    body = (
      <Inner title="Privacy and security" sub="Your password and your data." onBack={back}>
        <div className="rq-ac-group rq-ac-first">
          <div className="rq-ac-row is-plain">
            <MaterialSymbol name="mail" />
            <span className="rq-ac-row-text"><b>{user?.googleId ? "Signed in with Google" : "Signed in with email"}</b><span>{email}</span></span>
            {user?.isVerified ? <span className="rq-ac-ok"><MaterialSymbol name="verified" />Verified</span> : null}
          </div>
        </div>
        <div className="rq-ac-group rq-ac-next">
          {user?.googleId ? null : (
            <button type="button" className="rq-ac-row" onClick={() => viaSupport("Change password")}>
              <MaterialSymbol name="key" /><span className="rq-ac-row-text"><b>Change password</b></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
            </button>
          )}
          <Link to="/privacy-policy" className="rq-ac-row">
            <MaterialSymbol name="policy" /><span className="rq-ac-row-text"><b>How we use your data</b><span>Privacy policy</span></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </Link>
        </div>
        <div className="rq-ac-group rq-ac-next">
          <button type="button" className="rq-ac-row is-danger" onClick={() => viaSupport("Delete my account")}>
            <MaterialSymbol name="delete" /><span className="rq-ac-row-text"><b>Delete my account</b><span>Removes your details, vehicles and request history</span></span>
          </button>
        </div>
        <p className="rq-ac-note">Deleting can’t be undone. We ask you to confirm before anything is removed.</p>
      </Inner>
    );
  } else {
    const vehicles = garage.data?.length;
    const made = requests.data?.length;
    body = (
      <>
        <div className="rq-ac-id">
          <div className="rq-ac-id-text">
            <h1 className="rq-pg-h1 rq-ac-name">{name}</h1>
            <span className={cn("rq-ac-pill", member && "is-member")}>
              <MaterialSymbol name={member ? "workspace_premium" : "payments"} />
              {member ? `${planName(ownPlan?.name) || capital(user?.subscription)} member` : "Pay as you go"}
            </span>
          </div>
          <button type="button" className="rq-ac-face rq-press" aria-label="Your details" onClick={() => open("profile")}>{initialsOf(name)}</button>
        </div>
        <p className="rq-ac-contact">{[phone, email].filter(Boolean).join(" · ")}</p>

        {phone || me.isPending ? null : (
          <p className="rq-ac-nudge">
            <MaterialSymbol name="call" /><span>Add your phone number so your technician can call you.</span>
            <button type="button" className="rq-text-btn" onClick={() => { open("profile"); startEdit("phone"); }}>Add</button>
          </p>
        )}

        <div className="rq-ac-quick">
          <Link to="/my-garage" className="rq-ac-tile rq-press">
            <span className="rq-ac-tile-art"><img src="/images/vehicles/car.webp" alt="" draggable={false} /></span>
            <b>My garage</b>
            <span>{vehicles == null ? " " : vehicles === 0 ? "Add a vehicle" : `${vehicles} ${vehicles === 1 ? "vehicle" : "vehicles"}`}</span>
          </Link>
          <button type="button" className="rq-ac-tile rq-press" onClick={() => open("stats")}>
            <span className="rq-ac-tile-art"><MaterialSymbol name="receipt_long" /></span>
            <b>Requests</b>
            <span>{made == null ? " " : made === 0 ? "None yet" : `${made} so far`}</span>
          </button>
          <button type="button" className="rq-ac-tile rq-press" onClick={openSupport}>
            <span className="rq-ac-tile-art"><MaterialSymbol name="support_agent" /></span>
            <b>Help</b>
            <span>Call or chat</span>
          </button>
        </div>

        <div className="rq-ac-plan">
          <span className="rq-ac-plan-tag">
            <MaterialSymbol name="workspace_premium" />
            {member ? planName(ownPlan?.name) || "Your plan" : paidPlan ? `${planName(paidPlan.name)} · ₹${Math.round(paidPlan.amount)}/${planPeriod(paidPlan.period)}` : "Plans"}
          </span>
          <b>{member ? "You’re covered" : "Priority help, zero fees"}</b>
          <span className="rq-ac-plan-text">{member ? "Priority help and zero fees are on." : "Faster technician assignment."}</span>
          <Link to="/subscription" className="rq-ac-plan-cta rq-press">{member ? "Manage plan" : "View plan"}<MaterialSymbol name="chevron_right" /></Link>
          <img src="/images/vehicles/bike.webp" alt="" draggable={false} />
        </div>

        <div className="rq-ac-group rq-ac-list">
          <button type="button" className="rq-ac-row" onClick={() => open("profile")}>
            <MaterialSymbol name="person" /><span className="rq-ac-row-text"><b>Your details</b></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </button>
          <button type="button" className="rq-ac-row" onClick={() => open("notifications")}>
            <MaterialSymbol name="notifications" /><span className="rq-ac-row-text"><b>Alerts</b></span>
            <span className="rq-ac-val">{settingsLoading ? "" : settings.notifications.push_alerts ? "On" : "Off"}</span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </button>
          <button type="button" className="rq-ac-row" onClick={() => open("appearance")}>
            <MaterialSymbol name="contrast" /><span className="rq-ac-row-text"><b>Appearance</b></span>
            <span className="rq-ac-val">{settingsLoading ? "" : THEME_NAMES[settings.appearance.theme] ?? ""}</span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </button>
          <button type="button" className="rq-ac-row" onClick={() => open("privacy")}>
            <MaterialSymbol name="lock" /><span className="rq-ac-row-text"><b>Privacy and security</b></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </button>
          <Link to="/technician/login" className="rq-ac-row">
            <MaterialSymbol name="handshake" /><span className="rq-ac-row-text"><b>Work with ResQNow</b><span>Join as a technician</span></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </Link>
          <button type="button" className="rq-ac-row is-danger" onClick={() => setLeaving(true)}>
            <MaterialSymbol name="logout" /><span className="rq-ac-row-text"><b>Log out</b></span>
          </button>
        </div>
        <p className="rq-ac-foot"><Link to="/terms-of-service">Terms of service</Link>·<Link to="/privacy-policy">Privacy policy</Link></p>
      </>
    );
  }

  return (
    <div className="rq-pg rq-ac">
      <div className="rq-pg-in">{body}</div>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? EDIT[editing].title : ""} sub={editing ? EDIT[editing].sub : undefined}>
        {editing === "gender" ? (
          <div className="rq-ac-pick" role="radiogroup" aria-label="Gender">
            {["male", "female", "other"].map((choice) => (
              <button key={choice} type="button" role="radio" aria-checked={draft === choice} className={cn("rq-ac-choice", draft === choice && "is-on")} onClick={() => setDraft(choice)}>
                {capital(choice)}{draft === choice ? <MaterialSymbol name="check" /> : null}
              </button>
            ))}
          </div>
        ) : editing ? (
          <label className="rq-ac-input">
            <input
              type={editing === "birthday" ? "date" : editing === "phone" ? "tel" : "text"}
              inputMode={editing === "phone" ? "tel" : undefined}
              autoComplete={editing === "phone" ? "tel" : editing === "name" ? "name" : "bday"}
              value={draft}
              placeholder={editing === "phone" ? "e.g. 9876543210" : undefined}
              aria-label={EDIT[editing].title}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
        ) : null}
        <button type="button" className="rq-btn rq-btn-block rq-press" disabled={saving || (editing !== "phone" && !draft.trim())} onClick={() => void saveEdit()}>{saving ? "Saving…" : "Save"}</button>
        <button type="button" className="rq-btn rq-btn-soft rq-btn-block rq-press" onClick={() => setEditing(null)}>Cancel</button>
      </Sheet>

      <Sheet open={Boolean(support)} onClose={() => setSupport(null)} title={support?.title ?? ""} sub={support?.sub}>
        <div className="rq-ac-group rq-ac-first">
          <a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`} className="rq-ac-row">
            <MaterialSymbol name="call" /><span className="rq-ac-row-text"><b>Call us</b><span>{SUPPORT_PHONE}</span></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </a>
          <button type="button" className="rq-ac-row" onClick={askAssistant}>
            <MaterialSymbol name="forum" /><span className="rq-ac-row-text"><b>Ask the assistant</b><span>Answers straight away</span></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </button>
          <Link to="/contact" className="rq-ac-row">
            <MaterialSymbol name="edit" /><span className="rq-ac-row-text"><b>Send a message</b><span>We reply by email</span></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="rq-ac-row">
            <MaterialSymbol name="mail" /><span className="rq-ac-row-text"><b>Email us</b><span>{SUPPORT_EMAIL}</span></span><MaterialSymbol name="chevron_right" className="rq-ac-chev" />
          </a>
        </div>
        <button type="button" className="rq-btn rq-btn-soft rq-btn-block rq-press" onClick={() => setSupport(null)}>Close</button>
      </Sheet>

      <Sheet open={leaving} onClose={() => setLeaving(false)} title="Log out?" sub="You’ll need to sign in again to ask for help or see your requests.">
        <button type="button" className="rq-btn rq-btn-block rq-press" onClick={() => { logout(); navigate("/"); }}>Log out</button>
        <button type="button" className="rq-btn rq-btn-soft rq-btn-block rq-press" onClick={() => setLeaving(false)}>Stay signed in</button>
      </Sheet>
    </div>
  );
};

export default SettingsPage;
