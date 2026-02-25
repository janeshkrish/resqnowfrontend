import React from 'react';
import { MapPin, Car, Bike, Truck, Loader2 } from 'lucide-react';

interface FindingTechnicianProps {
    vehicleType?: string;
}

const FindingTechnician = ({ vehicleType = 'car' }: FindingTechnicianProps) => {
    const isBike = vehicleType?.toLowerCase() === 'bike';
    const isCommercial = vehicleType?.toLowerCase() === 'commercial' || vehicleType?.toLowerCase() === 'truck';

    const VehicleIcon = isBike ? Bike : isCommercial ? Truck : Car;

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] md:min-h-[500px] w-full bg-card dark:bg-slate-900 relative overflow-hidden rounded-3xl pb-10">

            {/* Background Ambient Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,theme(colors.slate.50)_0%,theme(colors.white)_100%)] pointer-events-none" />

            {/* Vertical Scanner Line (Subtle) */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-slate-200 to-transparent shadow-[0_0_15px_rgba(225,29,72,0.1)]" />

            {/* Main Radar Container */}
            <div className="relative mb-12 mt-8">
                {/* Ripple Rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border border-rose-100 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                    <div className="w-[300px] h-[300px] border border-rose-50/50 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_1s]" />
                    <div className="w-[350px] h-[350px] bg-rose-50/30 rounded-full animate-pulse blur-2xl" />
                </div>

                {/* Central Identity Puck */}
                <div className="relative z-10 w-28 h-28 bg-card dark:bg-slate-900 rounded-full shadow-[0_8px_30px_rgb(225,29,72,0.15)] flex items-center justify-center border border-border">
                    <div className="absolute inset-2 bg-muted rounded-full flex items-center justify-center">
                        <VehicleIcon className="w-10 h-10 text-foreground" strokeWidth={1.5} />
                    </div>
                    {/* Activity Dot */}
                    <div className="absolute top-2 right-2">
                        <span className="flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white"></span>
                        </span>
                    </div>
                </div>

                {/* Orbiting Element */}
                <div className="absolute inset-0 w-full h-full animate-[spin_4s_linear_infinite]">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-card dark:bg-slate-900 p-2 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-border">
                        <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                    </div>
                </div>
            </div>

            {/* Typography & Status Pill */}
            <div className="text-center z-10 space-y-4 px-6 relative w-full flex flex-col items-center">
                <h3 className="text-2xl font-black text-foreground tracking-tight">Connecting to Partners</h3>

                <div className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground bg-card dark:bg-slate-900 shadow-[0_2px_10px_rgba(0,0,0,0.06)] py-2.5 px-5 rounded-full border border-border">
                    <MapPin className="w-4 h-4 text-rose-500 animate-bounce" />
                    <span>Locating nearest experts...</span>
                </div>
            </div>

        </div>
    );
};

export default FindingTechnician;
