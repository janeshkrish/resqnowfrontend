import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

const SplashWrapper = ({ children }: { children: React.ReactNode }) => {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        let mounted = true;

        const initApp = async () => {
            const isNative = Capacitor.isNativePlatform();

            if (isNative) {
                // Request permissions gracefully on Android/iOS
                try {
                    await Geolocation.requestPermissions().catch(e => console.warn("Geo Perm Err:", e));
                } catch (err) {
                    console.warn("Geolocation permission request error:", err);
                }

                // Hide native splash screen immediately to show our animated React splash screen 
                // avoiding any white screen delay or backend blocking.
                try {
                    await SplashScreen.hide();
                } catch (e) {
                    console.warn("Splash hide error:", e);
                }
            }

            // Check if running in standalone mode (installed PWA) or Native Capacitor
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);

            if (isNative || isStandalone) {
                setShowSplash(true);
                // Wait for all animations to complete, then trigger exit
                // Fallback timeout max 2-3 seconds as requested
                const timer = setTimeout(() => {
                    if (mounted) setShowSplash(false);
                }, 2800);
                return () => clearTimeout(timer);
            } else {
                setShowSplash(false);
            }
        };

        initApp();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <>
            <AnimatePresence>
                {showSplash && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                        className="fixed inset-0 z-[9999] bg-card dark:bg-slate-900 flex flex-col items-center justify-center overflow-hidden"
                    >

                        {/* Background Route Line with Pulse (Subtle Tailored Tech Element) */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <motion.svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="none" className="opacity-20">
                                {/* Base tracking route */}
                                <motion.path
                                    d="M -50 350 C 100 350, 150 200, 200 200 C 250 200, 300 50, 450 50"
                                    fill="transparent"
                                    stroke="#D32F2F"
                                    strokeWidth="1.5"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 2, ease: "easeInOut", delay: 0.2 }}
                                />
                                {/* Route Data Packet / Tracking Blip moving along the path */}
                                <motion.path
                                    d="M -50 350 C 100 350, 150 200, 200 200 C 250 200, 300 50, 450 50"
                                    fill="transparent"
                                    stroke="#D32F2F"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray="1 1000"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                                    transition={{ duration: 2.5, ease: "easeInOut", delay: 0.8 }}
                                    className="drop-shadow-md"
                                />
                            </motion.svg>
                        </div>

                        <div className="relative flex flex-col items-center justify-center w-full h-full">

                            {/* Main Logo Container */}
                            <div className="flex items-center justify-center text-5xl md:text-6xl font-black tracking-tighter">

                                {/* "Res" */}
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "auto", opacity: 1 }}
                                    transition={{ duration: 0.8, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden whitespace-nowrap text-foreground flex justify-end"
                                >
                                    <span className="shrink-0 pr-[1px]">Res</span>
                                </motion.div>

                                {/* "Q" */}
                                <motion.div
                                    initial={{ y: -80, opacity: 0, scale: 0.5 }}
                                    animate={{ y: 0, opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.8, delay: 0.5, type: "spring", bounce: 0.5 }}
                                    className="relative z-10 flex items-center justify-center text-[#D32F2F] font-black"
                                >
                                    <span>Q</span>
                                    {/* Dual Radar Pulse Effect */}
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: [0.5, 3], opacity: [0, 0.3, 0] }}
                                        transition={{ duration: 2, delay: 0.8, repeat: 1, ease: "easeOut" }}
                                        className="absolute w-12 h-12 border-2 border-[#D32F2F] bg-[#D32F2F]/10 rounded-full z-[-1]"
                                    />
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: [0.5, 4], opacity: [0, 0.15, 0] }}
                                        transition={{ duration: 2.5, delay: 1, repeat: 1, ease: "easeOut" }}
                                        className="absolute w-12 h-12 bg-[#D32F2F] rounded-full z-[-1]"
                                    />
                                </motion.div>

                                {/* "Now" */}
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "auto", opacity: 1 }}
                                    transition={{ duration: 0.8, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden whitespace-nowrap text-foreground flex justify-start"
                                >
                                    <span className="shrink-0 pl-[1px]">Now</span>
                                </motion.div>

                            </div>

                            {/* Tagline */}
                            <motion.div
                                initial={{ opacity: 0, y: 15, filter: "blur(10px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 1, delay: 2.2, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute top-1/2 mt-12 z-20"
                            >
                                <p className="text-[10px] md:text-xs font-bold text-muted-foreground/80 tracking-[0.4em] uppercase text-center bg-card dark:bg-slate-900/90 backdrop-blur-xl px-5 py-2 rounded-full border border-border shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1)]">
                                    When the road stops, we start.
                                </p>
                            </motion.div>

                        </div>

                        {/* Premium Loading Beam Indicator */}
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-muted/50 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ x: "-100%" }}
                                animate={{ x: "100%" }}
                                transition={{ duration: 2, delay: 2.5, ease: "easeInOut" }}
                                className="w-full h-full bg-gradient-to-r from-transparent via-[#D32F2F] to-transparent rounded-full"
                            />
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hide overflow on body while splash is active to prevent scroll judder */}
            <div className={showSplash ? "h-screen w-screen overflow-hidden" : ""}>
                {children}
            </div>
        </>
    );
};

export default SplashWrapper;
