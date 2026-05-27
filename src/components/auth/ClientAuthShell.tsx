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
  "h-[3.25rem] sm:h-14 rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-[15px] font-medium text-slate-900 shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition-all placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#ef233c]/20 focus-visible:ring-offset-0 focus-visible:border-[#ef233c]";

export const clientAuthPrimaryButtonClassName =
  "mt-2 h-[3.25rem] sm:h-14 w-full rounded-[1.25rem] bg-[#ef233c] px-4 text-[15px] sm:text-base font-bold text-white shadow-[0_8px_20px_rgba(239,35,60,0.25)] transition-all hover:bg-[#dc1f38] hover:shadow-[0_12px_25px_rgba(239,35,60,0.35)] active:scale-[0.98]";

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
      {/* Corner wave graphic for signup only */}
      {isSignup && (
        <div className="pointer-events-none absolute bottom-0 right-0 w-64 h-64 overflow-hidden z-0">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="absolute bottom-0 right-0 w-full h-full transform translate-x-1/4 translate-y-1/4">
            <path fill="#ef233c" d="M41.4,-57.8C54,-48.5,64.8,-35.6,69.5,-21C74.3,-6.4,73,9.8,65.4,22.8C57.7,35.7,43.6,45.4,29.3,51.8C15,58.1,0.5,61.1,-13.4,59.5C-27.3,57.9,-40.6,51.8,-52.1,42.1C-63.5,32.4,-73.1,19.2,-74.6,5.1C-76.1,-9,-69.4,-23.8,-59.1,-34.5C-48.8,-45.3,-34.9,-51.9,-21.5,-60C-8.1,-68.1,4.7,-77.6,17.4,-77.2C30,-76.8,42.6,-66.4,41.4,-57.8Z" transform="translate(100 100) scale(1.4)" opacity="0.9" />
            <path fill="#ffb3bd" d="M41.4,-57.8C54,-48.5,64.8,-35.6,69.5,-21C74.3,-6.4,73,9.8,65.4,22.8C57.7,35.7,43.6,45.4,29.3,51.8C15,58.1,0.5,61.1,-13.4,59.5C-27.3,57.9,-40.6,51.8,-52.1,42.1C-63.5,32.4,-73.1,19.2,-74.6,5.1C-76.1,-9,-69.4,-23.8,-59.1,-34.5C-48.8,-45.3,-34.9,-51.9,-21.5,-60C-8.1,-68.1,4.7,-77.6,17.4,-77.2C30,-76.8,42.6,-66.4,41.4,-57.8Z" transform="translate(100 100) scale(1.6)" opacity="0.3" />
          </svg>
        </div>
      )}

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

            {/* No Roadside Scene */}

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
                    className="h-[3.25rem] sm:h-14 w-full justify-center rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.02)] hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
    <div className="inline-flex flex-col items-center relative mt-6 mb-4">
      {/* Concentric Circles Background */}
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] pointer-events-none flex items-center justify-center">
        <div className="absolute w-[180px] h-[180px] rounded-full border border-slate-200/60" />
        <div className="absolute w-[130px] h-[130px] rounded-full border border-slate-200/80" />
        <div className="absolute w-[80px] h-[80px] rounded-full border border-slate-200" />
        
        {/* Subtle diagonal line across the logo matching the mockup */}
        <div className="absolute w-[180px] h-px bg-slate-200 rotate-[-35deg]" />
        {/* Tiny red dots on the ends of the line */}
        <div className="absolute w-1 h-1 bg-[#ef233c] rounded-full -translate-x-[75px] translate-y-[52px]" />
        <div className="absolute w-1 h-1 bg-[#ef233c] rounded-full translate-x-[75px] -translate-y-[52px]" />
      </div>

      <div className="relative inline-flex items-end text-[2.2rem] font-black tracking-[-0.08em] text-[#0f172a]">
        <span>Res</span>
        <span className="relative mx-[0.03em] inline-flex h-[1em] w-[0.86em] items-center justify-center z-10">
          <span className="absolute inset-[14%_8%_14%_8%] rounded-full border-[0.14em] border-[#ef233c]" />
          <span className="absolute right-[7%] top-[2%] h-[0.55em] w-[0.12em] origin-top rotate-[-36deg] rounded-full bg-[#ef233c]" />
        </span>
        <span>Now</span>
        <span className="pointer-events-none absolute left-[34.5%] top-[65%] h-[0.11em] w-[1.05em] rotate-[128deg] rounded-full bg-[#ef233c] z-20" />
      </div>
      <div className="mt-1 text-[0.45rem] font-extrabold uppercase tracking-[0.22em] text-[#0f172a] relative z-10 bg-white px-2 rounded-full hidden">
        {/* Hidden wordmark since mockup doesn't seem to show "On time. Every time." */}
        On time. <span className="text-[#ef233c]">Every time.</span>
      </div>
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
