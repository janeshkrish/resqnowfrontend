import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashWrapper = ({ children }: { children: React.ReactNode }) => {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        // Check if running in standalone mode (installed PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);

        if (isStandalone) {
            setShowSplash(true);
            // Wait for all animations to complete, then trigger exit
            const timer = setTimeout(() => setShowSplash(false), 4600);
            return () => clearTimeout(timer);
        } else {
            setShowSplash(false);
        }
    }, []);

    return (
        <>
            <AnimatePresence>
                {showSplash && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                        className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center overflow-hidden"
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
                                    className="overflow-hidden whitespace-nowrap text-slate-900 flex justify-end"
                                >
                                    <span className="shrink-0 pr-[1px]">Res</span>
                                </motion.div>

                                {/* "Q" - The Map Pin / Radar Anchor */}
                                <div className="relative z-10 flex items-center justify-center">
                                    <motion.div
                                        initial={{ y: -80, opacity: 0, scale: 0.5 }}
                                        animate={{ y: 0, opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.8, delay: 0.5, type: "spring", bounce: 0.5 }}
                                        className="relative z-10 flex items-center justify-center w-10 h-12 drop-shadow-md"
                                        style={{ marginTop: "-12px", marginLeft: "2px" }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="#D32F2F" className="absolute top-0 left-0 w-full h-full drop-shadow-[0_2px_4px_rgba(211,47,47,0.4)]">
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                        </svg>
                                        <span className="relative z-20 text-white font-bold text-xl mb-3 pr-[1px]">Q</span>
                                    </motion.div>
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
                                    {/* Location marker dot inside the drop area */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 1.2, duration: 0.3 }}
                                        className="absolute mt-12 w-1.5 h-1.5 bg-[#D32F2F] rounded-full shadow-[0_0_8px_rgba(211,47,47,0.8)] z-0"
                                    />
                                </div>

                                {/* "Now" */}
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "auto", opacity: 1 }}
                                    transition={{ duration: 0.8, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden whitespace-nowrap text-slate-900 flex justify-start"
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
                                <p className="text-[10px] md:text-xs font-bold text-slate-500 tracking-[0.4em] uppercase text-center bg-white/90 backdrop-blur-xl px-5 py-2 rounded-full border border-slate-200 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1)]">
                                    When the road stops, we start.
                                </p>
                            </motion.div>

                        </div>

                        {/* Premium Loading Beam Indicator */}
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-slate-100 rounded-full overflow-hidden">
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
