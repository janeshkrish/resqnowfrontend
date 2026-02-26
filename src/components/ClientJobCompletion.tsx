import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ClientJobCompletionProps {
    technicianName: string;
    onSubmitReview: (rating: number, comment: string) => void;
}

const ClientJobCompletion = ({ technicianName, onSubmitReview }: ClientJobCompletionProps) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");

    const handleSubmit = () => {
        if (rating === 0) {
            toast.error("Please rate the service quality");
            return;
        }
        onSubmitReview(rating, comment);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
                className="bg-card dark:bg-slate-900 w-full max-w-sm overflow-hidden shadow-2xl rounded-sm border-t-4 border-red-600 ring-1 ring-zinc-200"
            >
                {/* Corporate Header */}
                <div className="bg-zinc-50 border-b border-zinc-100 p-6 text-center relative">
                    <div className="absolute top-4 right-4">
                        <ShieldCheck className="w-5 h-5 text-zinc-300" />
                    </div>

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-16 h-16 bg-card dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-zinc-100"
                    >
                        <CheckCircle2 className="w-9 h-9 text-green-600" />
                    </motion.div>

                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Service Successful</h2>
                    <p className="text-zinc-500 text-xs mt-1 font-medium uppercase tracking-wide">Case Closed • {new Date().toLocaleDateString()}</p>
                </div>

                <div className="p-6">
                    <div className="text-center mb-6">
                        <p className="text-zinc-600 text-sm leading-relaxed">
                            Assistance provided by <strong className="text-zinc-900">{technicianName}</strong>.
                            <br />
                            We hope you are safe and back on the road.
                        </p>
                    </div>

                    <div className="bg-zinc-50/50 rounded-sm p-5 mb-6 border border-zinc-100">
                        <label className="block text-xs font-semibold text-zinc-500 mb-3 text-center uppercase tracking-wider">Service Quality Rating</label>

                        <div className="flex justify-center gap-3 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`transition-all duration-200 hover:scale-105 focus:outline-none 
                                        ${rating >= star ? 'text-amber-500' : 'text-zinc-200'}`}
                                >
                                    <Star className="w-7 h-7 fill-current" strokeWidth={1.5} />
                                </button>
                            ))}
                        </div>

                        <Textarea
                            placeholder="Additional comments (Optional)"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="resize-none bg-card dark:bg-slate-900 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 min-h-[80px] text-sm rounded-sm"
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        className="w-full bg-red-700 hover:bg-red-800 text-white h-11 rounded-sm text-sm font-semibold shadow-sm transition-all uppercase tracking-wide"
                    >
                        Complete & Return Home
                    </Button>

                    <div className="mt-4 text-center">
                        <p className="text-[10px] text-zinc-400">
                            Invoice has been sent to your registered email.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ClientJobCompletion;
