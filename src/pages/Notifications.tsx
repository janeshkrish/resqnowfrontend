import React from "react";
import { ArrowLeft, Bell, Settings, Circle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Mock Data for the demonstration. Real app would fetch this via context/API.
const MOCK_NOTIFICATIONS = [
    {
        id: "1",
        title: "10% Off Any Two Services Code",
        message: "Your welcome discount is here! Use code RESQ10 at checkout to claim your offer.",
        timestamp: "2 mins ago",
        unread: true,
        type: "promo",
    },
    {
        id: "2",
        title: "Service Request Completed",
        message: "Your car towing service requested on Oct 25th has been successfully completed. Rate your technician now!",
        timestamp: "2 days ago",
        unread: false,
        type: "system",
    },
    {
        id: "3",
        title: "Welcome to ResQNow!",
        message: "We're glad you're here. Ensure your profile is complete so technicians can reach you faster.",
        timestamp: "1 week ago",
        unread: false,
        type: "system",
    }
];

const Notifications = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 relative pb-24">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-slate-100 -ml-2">
                        <ArrowLeft className="w-5 h-5 text-slate-700" />
                    </Button>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Updates</h1>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-slate-900">
                    <Settings className="w-5 h-5" />
                </Button>
            </div>

            <div className="pt-2">
                {MOCK_NOTIFICATIONS.length > 0 ? (
                    <div className="bg-white border-y border-slate-100 divide-y divide-slate-100">
                        {MOCK_NOTIFICATIONS.map((notif) => (
                            <div
                                key={notif.id}
                                className={`p-4 flex gap-4 transition-colors active:bg-slate-50 ${notif.unread ? "bg-blue-50/30" : ""}`}
                            >
                                <div className="shrink-0 pt-0.5">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${notif.type === 'promo' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {notif.type === 'promo' ? <Bell className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                        <h3 className={`font-bold text-sm truncate ${notif.unread ? "text-slate-900" : "text-slate-700"}`}>
                                            {notif.title}
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap pt-0.5">
                                            {notif.timestamp}
                                        </span>
                                    </div>
                                    <p className={`text-sm leading-snug line-clamp-2 ${notif.unread ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                                        {notif.message}
                                    </p>
                                </div>

                                {notif.unread && (
                                    <div className="shrink-0 flex items-center justify-center w-3 pt-2">
                                        <Circle className="w-2.5 h-2.5 fill-blue-600 text-blue-600" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <Bell className="w-10 h-10 text-slate-300" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">No updates yet</h2>
                        <p className="text-slate-500 text-sm">We'll notify you when there's something new.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
