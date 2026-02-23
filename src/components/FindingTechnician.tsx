import React from 'react';
import { Search, MapPin, Car, Bike, Truck } from 'lucide-react';

interface FindingTechnicianProps {
    vehicleType?: string;
}

const FindingTechnician = ({ vehicleType = 'car' }: FindingTechnicianProps) => {
    const isBike = vehicleType?.toLowerCase() === 'bike';
    const isCommercial = vehicleType?.toLowerCase() === 'commercial' || vehicleType?.toLowerCase() === 'truck';

    const VehicleIcon = isBike ? Bike : isCommercial ? Truck : Car;

    return (
        <div className="flex flex-col items-center justify-center h-[60vh] md:h-[500px] w-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">

            {/* Ambient Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
            </div>

            {/* Radar Animation Container */}
            <div className="relative mb-8">
                {/* Expanding Rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-blue-500/20 rounded-full animate-[ping_3s_linear_infinite]" />
                    <div className="w-64 h-64 border-2 border-blue-500/20 rounded-full animate-[ping_3s_linear_infinite_1s]" />
                    <div className="w-48 h-48 bg-blue-500/10 rounded-full animate-pulse blur-xl" />
                </div>

                {/* Central Vehicle Icon */}
                <div className="relative z-10 w-24 h-24 bg-white dark:bg-slate-800 rounded-full shadow-xl shadow-blue-500/20 flex items-center justify-center border-4 border-white dark:border-slate-700">
                    <div className="relative">
                        <VehicleIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                        <div className="absolute -top-1 -right-1">
                            <span className="flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Orbiting Search Icon */}
                <div className="absolute inset-0 w-full h-full animate-[spin_4s_linear_infinite]">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-100 dark:border-slate-700">
                        <Search className="w-4 h-4 text-blue-600" />
                    </div>
                </div>
            </div>

            {/* Status Text */}
            <div className="text-center space-y-3 z-10 max-w-xs mx-auto">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Connecting to Partners</h3>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 py-1.5 px-4 rounded-full border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                    <MapPin className="w-3.5 h-3.5 animate-bounce text-blue-500" />
                    <span>Locating nearest experts...</span>
                </div>
            </div>

        </div>
    );
};

export default FindingTechnician;
