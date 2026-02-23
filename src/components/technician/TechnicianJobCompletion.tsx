import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, CheckCircle, Wallet } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface TechnicianJobCompletionProps {
    amount: number;
    onClose: () => void;
}

const TechnicianJobCompletion = ({ amount, onClose }: TechnicianJobCompletionProps) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 w-full max-w-sm text-center relative border border-slate-700 shadow-2xl"
            >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                        className="bg-amber-400 p-4 rounded-full shadow-lg border-4 border-slate-900"
                    >
                        <Trophy className="w-10 h-10 text-slate-900 fill-slate-900" />
                    </motion.div>
                </div>

                <div className="mt-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Great Job!</h2>
                    <p className="text-slate-400 text-sm mb-6">
                        You've successfully completed another mission. Thanks for your hard work and cooperation!
                    </p>

                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-8 backdrop-blur-md">
                        <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-1">Total Earnings</p>
                        <div className="flex items-center justify-center gap-2 text-green-400">
                            <Wallet className="w-6 h-6" />
                            <span className="text-4xl font-bold">₹{amount}</span>
                        </div>
                    </div>

                    <Button
                        onClick={onClose}
                        className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold h-12 rounded-xl"
                    >
                        Back to Dashboard
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default TechnicianJobCompletion;
