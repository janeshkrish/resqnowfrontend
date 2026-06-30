import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoState } from './AppDemoContainer';
import { Loader2, Star, ShieldCheck, ChevronRight } from 'lucide-react';

const AppBottomSheet = ({ demoState }: { demoState: DemoState }) => {
  const isSearching = demoState === 'SEARCHING' || demoState === 'FOUND';
  const isAssigned = demoState === 'ASSIGNED' || demoState === 'EN_ROUTE' || demoState === 'ARRIVED';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 px-5 pb-8 pt-4 bg-white rounded-t-[32px] shadow-[0_-15px_40px_rgba(0,0,0,0.1)] border-t border-slate-100">
      {/* iOS drag handle */}
      <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />

      <AnimatePresence mode="wait">
        {isSearching && (
          <motion.div
            key="searching"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-6"
          >
            <div className="relative mb-4">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
            </div>
            <p className="text-sm font-bold text-slate-800 text-center">
              Searching for nearest mechanic...
            </p>
            <p className="text-[11px] font-medium text-slate-400 text-center mt-1.5 uppercase tracking-wider">
              Contacting verified partners
            </p>
          </motion.div>
        )}

        {isAssigned && (
          <motion.div
            key="assigned"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col w-full"
          >
            {/* Profile Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full border border-slate-200 overflow-hidden flex items-center justify-center">
                  <img src="https://i.pravatar.cc/150?img=11" alt="Mechanic" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">Ramesh Kumar</h4>
                  <div className="flex items-center text-[11px] font-semibold text-slate-500 mt-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-current mr-1" />
                    4.9 <span className="mx-1.5 font-normal text-slate-300">•</span> Tow Truck
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider border border-emerald-100">
                <ShieldCheck className="w-3 h-3" /> Verified
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-5 flex justify-between items-center shadow-inner">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mb-1">Status</span>
                <span className="text-sm font-black text-slate-800">
                  {demoState === 'ARRIVED' ? 'Arrived at location' : 'En Route to you'}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mb-1">ETA</span>
                <span className="text-xl font-black text-red-500 leading-none">
                  {demoState === 'ARRIVED' ? '0m' : '12m'}
                </span>
              </div>
            </div>

            {/* Action Button */}
            <button className="w-full bg-slate-900 text-white rounded-2xl py-4 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
              {demoState === 'ARRIVED' ? 'Contact Mechanic' : 'Track Live'} 
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppBottomSheet;
