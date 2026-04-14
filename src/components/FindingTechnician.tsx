import React from 'react';
import { Car, Bike, Truck, Sparkles, Navigation, Wrench, Battery, Droplets, Disc } from 'lucide-react';

interface FindingTechnicianProps {
    vehicleType?: string;
    serviceType?: string;
}

const FindingTechnician = ({ vehicleType = 'car', serviceType = '' }: FindingTechnicianProps) => {
    const isBike = vehicleType?.toLowerCase() === 'bike' || vehicleType?.toLowerCase() === 'motorcycle';
    const isCommercial = vehicleType?.toLowerCase() === 'commercial' || vehicleType?.toLowerCase() === 'truck';

    const vehicleName = isBike ? 'bike' : isCommercial ? 'commercial vehicle' : 'car';
    const VehicleIcon = isBike ? Bike : isCommercial ? Truck : Car;

    // Determine Context based on Service Type
    const getContext = () => {
        const type = serviceType.toLowerCase();
        if (type.includes('tow')) {
            return {
                title: 'Searching for Towing Operators',
                subtitle: `Dispatching the nearest tow truck for your ${vehicleName}...`,
                ContextIcon: Truck
            };
        }
        if (type.includes('battery') || type.includes('jump')) {
            return {
                title: 'Finding Battery Specialists',
                subtitle: `Connecting with battery experts nearby...`,
                ContextIcon: Battery
            };
        }
        if (type.includes('tire') || type.includes('tyre') || type.includes('flat')) {
            return {
                title: 'Locating Tire Experts',
                subtitle: `Finding quick assistance for your flat tire...`,
                ContextIcon: Disc
            };
        }
        if (type.includes('fuel') || type.includes('gas')) {
            return {
                title: 'Requesting Fuel Delivery',
                subtitle: `Finding partners to deliver fuel to your location...`,
                ContextIcon: Droplets
            };
        }
        // Default context
        return {
            title: 'Connecting to Partners',
            subtitle: `Locating the nearest experts for your ${vehicleName}...`,
            ContextIcon: Wrench
        };
    };

    const { title, subtitle, ContextIcon } = getContext();

    return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[100dvh] bg-slate-50 relative overflow-hidden">
            <style>
                {`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.8); opacity: 0.8; border-width: 2px; }
                    100% { transform: scale(4); opacity: 0; border-width: 1px; }
                }
                @keyframes map-scan {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes shimmer {
                    from { background-position: 200% center; }
                    to { background-position: -200% center; }
                }
                .anti-gravity {
                    animation: float 4s ease-in-out infinite;
                }
                .radar-pulse {
                    animation: pulse-ring 3s cubic-bezier(0.25, 0.8, 0.25, 1) infinite;
                }
                .radar-pulse-delayed {
                    animation: pulse-ring 3s cubic-bezier(0.25, 0.8, 0.25, 1) infinite 1.5s;
                }
                .radar-spin {
                    animation: map-scan 4.5s linear infinite;
                }
                `}
            </style>

            {/* Neat & Clean Map Grid Background (Light Theme) */}
            <div 
                className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_40%,#000_20%,transparent_80%)] border-t border-white/40" 
            />
            
            {/* Soft Core Ambient Glow */}
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-50 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center justify-center -mt-24">
                {/* Radar System Wrapper */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                    
                    {/* Clean expanding radar rings in brand color */}
                    <div className="absolute inset-0 border border-rose-400 rounded-full radar-pulse shadow-[0_0_30px_rgba(225,29,72,0.1)]" />
                    <div className="absolute inset-0 border border-rose-300/60 rounded-full radar-pulse-delayed shadow-[0_0_20px_rgba(225,29,72,0.05)]" />
                    
                    {/* Orbiting Map Pin */}
                    <div className="absolute inset-0 radar-spin">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center border border-slate-100">
                             <div className="w-6 h-6 bg-rose-50 rounded-full flex items-center justify-center">
                                <ContextIcon className="w-3.5 h-3.5 text-rose-500" strokeWidth={2.5} />
                             </div>
                        </div>
                    </div>

                    {/* Light Theme Vehicle Puck */}
                    <div className="relative z-20 w-32 h-32 sm:w-40 sm:h-40 anti-gravity">
                        {/* Outer Glass Ring */}
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-xl border border-white/60 rounded-full flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.5)]">
                            {/* Inner Clean Box */}
                            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-tr from-slate-50 to-white rounded-full border border-slate-100/80 flex items-center justify-center shadow-[inset_0_0_12px_rgba(0,0,0,0.02)] relative overflow-hidden">
                                <VehicleIcon className="w-12 h-12 sm:w-16 sm:h-16 text-slate-800 drop-shadow-sm relative z-10" strokeWidth={1.5} />
                            </div>
                        </div>
                        {/* Minimalist Live Data Ping */}
                        <div className="absolute top-1 right-2 sm:top-2 sm:right-3 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white"></span>
                        </div>
                    </div>
                </div>

                {/* Typography and Contextual Pill */}
                <div className="mt-16 sm:mt-24 text-center space-y-4 px-6 animate-in slide-in-from-bottom-8 fade-in duration-700 w-full max-w-md">
                    <h3 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
                        {title}
                    </h3>
                    
                    <div className="inline-flex items-center gap-2.5 bg-white border border-slate-200/60 py-2.5 px-5 sm:px-6 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.04)] max-w-full overflow-hidden shrink-0">
                        <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="text-xs sm:text-[13px] font-semibold text-slate-600 truncate animate-[shimmer_3s_linear_infinite] bg-[linear-gradient(110deg,#475569,45%,#0f172a,55%,#475569)] bg-[length:200%_100%] bg-clip-text text-transparent">
                            {subtitle}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Gradient Fade to merge with white bottom sheet */}
            <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-slate-100 to-transparent pointer-events-none z-10" />
        </div>
    );
};

export default FindingTechnician;
