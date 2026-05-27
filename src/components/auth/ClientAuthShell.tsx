import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

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
  "h-[3.25rem] sm:h-14 rounded-full border border-slate-200 bg-white pl-12 pr-12 text-[15px] font-medium text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#ef233c]/20 focus-visible:ring-offset-0 focus-visible:border-[#ef233c]";

export const clientAuthPrimaryButtonClassName =
  "mt-2 h-[3.25rem] sm:h-14 w-full rounded-full bg-[#ef233c] px-4 text-[15px] sm:text-base font-bold text-white shadow-[0_8px_20px_rgba(239,35,60,0.25)] transition-all hover:bg-[#dc1f38] hover:shadow-[0_12px_25px_rgba(239,35,60,0.35)] active:scale-[0.98]";

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
      className="min-h-[100dvh] overflow-x-hidden bg-white px-0 py-0 sm:px-6 sm:py-8 relative"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      {/* Corner wave graphic */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-64 h-64 overflow-hidden z-0">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="absolute -bottom-8 -left-8 w-full h-full">
          {/* Deep Navy/Black Blob */}
          <path fill="#0f172a" d="M34.8,-53.4C46.8,-46.8,59.3,-39.8,65.8,-29.1C72.3,-18.4,72.9,-4,68.9,8.5C65,21,56.5,31.7,46.7,39.6C36.9,47.5,25.7,52.6,13.8,55.9C1.8,59.2,-11,60.7,-22.4,57.4C-33.8,54.1,-43.8,46,-51.7,36C-59.5,26,-65.2,14.1,-66.1,1.8C-67,-10.5,-63.1,-23.3,-55.4,-33.5C-47.7,-43.7,-36.2,-51.4,-24.5,-57.8C-12.8,-64.2,-1,-69.3,10.6,-68.8C22.2,-68.3,34.4,-62.1,34.8,-53.4Z" transform="translate(40 160) scale(1.1)" />
          {/* Red Blob */}
          <path fill="#ef233c" d="M41.4,-57.8C54,-48.5,64.8,-35.6,69.5,-21C74.3,-6.4,73,9.8,65.4,22.8C57.7,35.7,43.6,45.4,29.3,51.8C15,58.1,0.5,61.1,-13.4,59.5C-27.3,57.9,-40.6,51.8,-52.1,42.1C-63.5,32.4,-73.1,19.2,-74.6,5.1C-76.1,-9,-69.4,-23.8,-59.1,-34.5C-48.8,-45.3,-34.9,-51.9,-21.5,-60C-8.1,-68.1,4.7,-77.6,17.4,-77.2C30,-76.8,42.6,-66.4,41.4,-57.8Z" transform="translate(60 190) scale(1.1)" />
        </svg>
      </div>

      <div className="mx-auto flex min-h-[100dvh] max-w-[440px] items-stretch justify-center relative z-10 sm:min-h-[calc(100dvh-4rem)]">
        <motion.div 
          className="relative flex w-full flex-col overflow-hidden bg-white/60 backdrop-blur-xl sm:rounded-[34px] sm:border sm:border-slate-100 sm:shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative z-10 flex min-h-[100dvh] w-full flex-col px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:min-h-0 sm:pb-10 sm:pt-8">
            {/* Header */}
            <div className="mb-4 sm:mb-6 mt-4 relative">
              {isSignup ? (
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all hover:scale-105 active:scale-95"
                  >
                    <Link to="/login" aria-label="Back to login">
                      <ChevronLeft className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              ) : null}

              <div className="flex justify-center w-full">
                <ResQNowWordmark />
              </div>
            </div>

            {!isSignup ? (
              <div className="mb-2 flex justify-center">
                <RoadsideScene />
              </div>
            ) : null}

            <div className={cn("text-center", isSignup ? "mb-6 mt-2" : "mb-6")}>
              <h1 className="text-[1.75rem] font-bold tracking-tight text-[#0f172a] sm:text-[2rem]">
                {title}
              </h1>
              <p className="mt-1.5 text-[14px] font-medium text-slate-500 sm:mt-2">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-1 flex-col">
              {error ? (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              ) : null}

              <div className="flex-1">{children}</div>

              <div className="mt-6 sm:mt-8">
                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="bg-slate-100" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      or continue with
                    </span>
                  </div>
                </div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-[3.25rem] sm:h-14 w-full justify-center rounded-full border border-slate-200 bg-white text-[15px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    onClick={onGoogleAction}
                    disabled={isLoading}
                  >
                    <GoogleMark className="mr-3 h-5 w-5" />
                    {googleLabel}
                  </Button>
                </motion.div>
              </div>

              <div className="mt-8 text-center text-[13.5px] font-medium text-slate-500 mb-6 sm:mb-0">
                {footer}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ResQNowWordmark() {
  return (
    <div className="inline-flex flex-col items-center relative">
      {/* Concentric Circles Background */}
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] pointer-events-none flex items-center justify-center">
        <div className="absolute w-[180px] h-[180px] rounded-full border border-slate-200/60" />
        <div className="absolute w-[130px] h-[130px] rounded-full border border-slate-200/80" />
        <div className="absolute w-[80px] h-[80px] rounded-full border border-slate-200" />
        {/* Subtle dashed ring to give that precision/target feel */}
        <svg className="absolute w-[100px] h-[100px] text-slate-200 animate-[spin_60s_linear_infinite]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
        </svg>
      </div>

      <div className="relative inline-flex items-end text-[2.2rem] font-black tracking-[-0.08em] text-[#1e293b]">
        <span>Res</span>
        <span className="relative mx-[0.03em] inline-flex h-[1em] w-[0.86em] items-center justify-center z-10">
          <span className="absolute inset-[14%_8%_14%_8%] rounded-full border-[0.14em] border-[#ef233c] shadow-[0_2px_10px_rgba(239,35,60,0.2)]" />
          <span className="absolute right-[7%] top-[2%] h-[0.55em] w-[0.12em] origin-top rotate-[-36deg] rounded-full bg-[#ef233c] shadow-[0_2px_5px_rgba(239,35,60,0.2)]" />
        </span>
        <span>Now</span>
        <span className="pointer-events-none absolute left-[34.5%] top-[65%] h-[0.11em] w-[1.05em] rotate-[128deg] rounded-full bg-[#ef233c] shadow-[0_2px_5px_rgba(239,35,60,0.2)] z-20" />
      </div>
      <div className="mt-1 text-[0.45rem] font-extrabold uppercase tracking-[0.22em] text-slate-400 relative z-10 bg-white/50 px-2 rounded-full backdrop-blur-sm">
        On time. <span className="text-[#ef233c]">Every time.</span>
      </div>
    </div>
  );
}

function RoadsideScene() {
  return (
    <div className="relative mb-2 mt-4 flex justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        <svg viewBox="0 0 200 60" className="h-[45px] w-auto max-w-[200px]" aria-hidden="true">
          {/* Ground Line */}
          <line x1="20" y1="50" x2="160" y2="50" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          
          {/* Background subtle elements */}
          <path d="M120 48 L130 25 L145 48 Z" fill="#f1f5f9" />
          <path d="M140 48 L155 15 L175 48 Z" fill="#f8fafc" />

          {/* Simple Truck */}
          <g transform="translate(30 25)">
            {/* Truck Body */}
            <path d="M0 15 h35 v10 h-35 z" fill="#1e293b" />
            <path d="M35 10 h15 l5 5 v10 h-20 z" fill="#334155" />
            <path d="M37 12 h10 l3 3 v5 h-13 z" fill="#e2e8f0" />
            
            {/* Wheels */}
            <circle cx="10" cy="25" r="4" fill="#0f172a" />
            <circle cx="45" cy="25" r="4" fill="#0f172a" />
            
            {/* Flatbed & Car */}
            <path d="M-15 15 h15 v2 h-15 z" fill="#64748b" />
            {/* Car outline on bed */}
            <path d="M-10 13 v-5 h5 l3-3 h8 l2 3 h4 v5 z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="-5" cy="13" r="2" fill="#94a3b8" />
            <circle cx="7" cy="13" r="2" fill="#94a3b8" />

            {/* Tow boom */}
            <line x1="15" y1="15" x2="-2" y2="0" stroke="#ef233c" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="15" cy="15" r="2" fill="#1e293b" />
          </g>

          {/* Location Pin */}
          <motion.g 
            transform="translate(135 15)"
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <path d="M10 0 C4.5 0 0 4.5 0 10 C0 17 10 25 10 25 C10 25 20 17 20 10 C20 4.5 15.5 0 10 0 Z" fill="#ef233c" />
            <circle cx="10" cy="9" r="3.5" fill="#ffffff" />
          </motion.g>
        </svg>
      </motion.div>
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
