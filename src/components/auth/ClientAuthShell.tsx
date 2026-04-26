import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ClientAuthShellProps = {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  error?: string | null;
  isLoading?: boolean;
  onGoogleAction: () => void | Promise<void>;
  googleLabel?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
};

export const clientAuthInputClassName =
  "h-[3.25rem] sm:h-14 rounded-[1.25rem] border border-slate-200 bg-white/95 pl-12 pr-12 text-[15px] font-medium text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#ef233c]/15 focus-visible:ring-offset-0 focus-visible:border-[#ef233c]";

export const clientAuthPrimaryButtonClassName =
  "mt-2 h-[3.25rem] sm:h-14 w-full rounded-[1.25rem] bg-[#ef233c] px-4 text-[15px] sm:text-base font-bold text-white shadow-[0_18px_35px_rgba(239,35,60,0.32)] transition-all hover:bg-[#dc1f38] active:scale-[0.99]";

export function ClientAuthShell({
  mode,
  title,
  subtitle,
  error,
  isLoading = false,
  onGoogleAction,
  googleLabel = "Continue with Google",
  footer,
  children,
}: ClientAuthShellProps) {
  const isSignup = mode === "signup";

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(235,240,247,0.96)_46%,_rgba(228,233,242,1)_100%)] px-0 py-0 sm:px-6 sm:py-8"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div className="mx-auto flex min-h-[100dvh] max-w-[440px] items-stretch justify-center sm:min-h-[calc(100dvh-4rem)]">
        <div className="relative flex w-full flex-col overflow-hidden bg-white sm:rounded-[34px] sm:border sm:border-white/70 sm:shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(248,250,252,0.98)_0%,_rgba(255,255,255,1)_34%,_rgba(248,250,252,1)_100%)]" />
          <div className="pointer-events-none absolute inset-x-4 top-0 h-48 rounded-full bg-[radial-gradient(circle,_rgba(239,35,60,0.16),_rgba(239,35,60,0)_72%)] blur-3xl sm:inset-x-6 sm:top-16 sm:h-44" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 overflow-hidden sm:h-28">
            <div className="absolute -bottom-12 -left-8 h-24 w-40 rounded-[999px] bg-slate-900 sm:-bottom-10 sm:-left-10 sm:h-28 sm:w-44" />
            <div className="absolute -bottom-10 -left-2 h-16 w-32 rounded-[999px] rotate-[-11deg] bg-[#ef233c] sm:-bottom-8 sm:-left-4 sm:h-20 sm:w-36" />
            <div className="absolute -bottom-10 left-10 h-14 w-36 rounded-[999px] rotate-[-8deg] bg-[#f7f8fb] sm:left-12 sm:h-16 sm:w-48" />
          </div>

          <div className="relative z-10 flex min-h-[100dvh] w-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:min-h-0 sm:px-6 sm:pb-10 sm:pt-5">
            <div className={cn("mb-4 flex items-center sm:mb-5", isSignup ? "justify-between" : "justify-center")}>
              {isSignup ? (
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-2xl border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Link to="/login" aria-label="Back to login">
                    <ChevronLeft className="h-5 w-5" />
                  </Link>
                </Button>
              ) : null}

              <div className={cn("flex-1", isSignup ? "pr-10 text-center" : "text-center")}>
                <ResQNowWordmark />
              </div>
            </div>

            {!isSignup ? <RoadsideScene /> : null}

            <div className={cn("text-center", isSignup ? "mb-4 mt-1 sm:mt-2" : "mb-4 sm:mb-5")}>
              <h1 className="text-[1.72rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">
                {title}
              </h1>
              <p className="mt-1.5 text-[13px] font-medium text-slate-500 sm:mt-2 sm:text-sm">{subtitle}</p>
            </div>

            <div className="flex flex-1 flex-col">
              {error ? (
                <div className="mb-3 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm sm:mb-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="flex-1">{children}</div>

              <div className="mt-5 sm:mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="bg-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 sm:text-[11px]">
                      or continue with
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 sm:mt-5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-[3.25rem] sm:h-14 w-full justify-center rounded-[1.25rem] border-slate-200 bg-white text-[15px] font-semibold text-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.05)] hover:bg-slate-50"
                    onClick={onGoogleAction}
                    disabled={isLoading}
                  >
                    <GoogleMark className="mr-3 h-5 w-5" />
                    {googleLabel}
                  </Button>
                </div>
              </div>

              <div className="mt-5 text-center text-[13px] font-medium text-slate-600 sm:mt-6 sm:text-sm">{footer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResQNowWordmark() {
  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative inline-flex items-end text-[1.9rem] font-black tracking-[-0.08em] text-slate-900 sm:text-[2.2rem]">
        <span>Res</span>
        <span className="relative mx-[0.03em] inline-flex h-[1em] w-[0.86em] items-center justify-center">
          <span className="absolute inset-[14%_8%_14%_8%] rounded-full border-[0.14em] border-[#ef233c]" />
          <span className="absolute right-[7%] top-[2%] h-[0.55em] w-[0.12em] origin-top rotate-[-36deg] rounded-full bg-[#ef233c]" />
        </span>
        <span>Now</span>
        <span className="pointer-events-none absolute left-[34.5%] top-[65%] h-[0.11em] w-[1.05em] rotate-[128deg] rounded-full bg-[#ef233c]" />
      </div>
      <div className="mt-1 text-[0.45rem] font-extrabold uppercase tracking-[0.22em] text-slate-400 sm:text-[0.5rem]">
        On time. <span className="text-[#ef233c]">Every time.</span>
      </div>
    </div>
  );
}

function RoadsideScene() {
  return (
    <div className="relative mb-4 flex justify-center sm:mb-6">
      <svg viewBox="0 0 320 144" className="h-[96px] w-full max-w-[224px] sm:h-[132px] sm:max-w-[300px]" aria-hidden="true">
        <path
          d="M24 104c11-28 18-41 31-46l14 46H24Zm26-14c8-16 13-24 19-28l10 42H50V90Zm44-7c7-11 13-16 22-17l9 38H94V83Zm50-4c5-8 10-13 18-14l8 39h-26V79Zm44-10c5-7 12-11 21-12l11 47h-32V69Zm57 31c8-18 14-27 26-30l18 34h-44V100Z"
          fill="#f4f6fb"
        />
        <rect x="34" y="106" width="214" height="4" rx="2" fill="#d5dbe6" />
        <g transform="translate(42 68)">
          <rect x="2" y="26" width="114" height="12" rx="6" fill="#394150" />
          <rect x="28" y="12" width="68" height="10" rx="4" fill="#9aa3b2" />
          <rect x="0" y="7" width="30" height="22" rx="6" fill="#ffffff" stroke="#d7dde8" strokeWidth="2" />
          <path d="M7 7h16l6 8H7Z" fill="#ef233c" />
          <rect x="10" y="13" width="10" height="6" rx="2" fill="#dbe6f6" />
          <rect x="21" y="34" width="10" height="10" rx="5" fill="#111827" />
          <rect x="88" y="34" width="10" height="10" rx="5" fill="#111827" />
          <rect x="62" y="8" width="34" height="14" rx="7" fill="#4b5563" />
          <path d="M60 22h40c2 0 4 2 4 4v1H58v-1c0-2 2-4 2-4Z" fill="#6b7280" />
          <circle cx="72" cy="22" r="3" fill="#cbd5e1" />
          <circle cx="29" cy="22" r="3" fill="#ef233c" />
          <path d="M28 20c9-1 17-7 23-17" stroke="#ef233c" strokeWidth="3" strokeLinecap="round" />
          <path d="M48 4l6 2-2 7" stroke="#ef233c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M120 26h14" stroke="#9aa3b2" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g transform="translate(261 78)">
          <path
            d="M13.5 0C7.15 0 2 5.12 2 11.43c0 8.9 11.5 19.57 11.5 19.57S25 20.33 25 11.43C25 5.12 19.85 0 13.5 0Zm0 15.86a4.43 4.43 0 1 1 0-8.86 4.43 4.43 0 0 1 0 8.86Z"
            fill="#ef233c"
            opacity="0.82"
          />
        </g>
      </svg>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}
