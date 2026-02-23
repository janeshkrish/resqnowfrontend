
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { apiFetch } from "@/lib/api";
import TechnicianJobHistory from "@/components/technician/TechnicianJobHistory";
import { Skeleton } from "@/components/ui/skeleton";

const TechnicianHistoryPage = () => {
    const { technician, token } = useTechnicianAuth();
    const { socket } = useSocket();
    const [jobHistory, setJobHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

    const fetchHistory = useCallback(async () => {
        if (!technician || !token) return;

        try {
            const res = await apiFetch(`/api/technicians/jobs/history`, { technician: true });
            if (res.ok) {
                const historyData = await res.json();
                if (Array.isArray(historyData)) {
                    setJobHistory(historyData);
                }
            } else {
                console.error("Failed to fetch history:", res.status);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    }, [technician, token]);

    useEffect(() => {
        if (technician && token) {
            fetchHistory();
        }
    }, [technician, token, fetchHistory]);

    useEffect(() => {
        if (!technician || !token) return;
        const id = setInterval(fetchHistory, 20000);
        return () => clearInterval(id);
    }, [technician, token, fetchHistory]);

    useEffect(() => {
        if (!socket || !technician?.id) return;

        const refresh = () => fetchHistory();
        const handleStatusUpdate = (payload: any) => {
            const status = String(payload?.status || "").toLowerCase();
            if (!status || ["paid", "completed", "cancelled", "payment_pending"].includes(status)) {
                refresh();
            }
        };

        socket.on("job:list_update", refresh);
        socket.on("job:status_update", handleStatusUpdate);
        socket.on("dashboard:stats_update", refresh);

        return () => {
            socket.off("job:list_update", refresh);
            socket.off("job:status_update", handleStatusUpdate);
            socket.off("dashboard:stats_update", refresh);
        };
    }, [socket, technician?.id, fetchHistory]);

    const filteredJobs = jobHistory.filter((job: any) => {
        if (filter === 'all') return true;
        if (filter === 'completed') return ['completed', 'paid'].includes(job.status?.toLowerCase());
        if (filter === 'cancelled') return job.status?.toLowerCase() === 'cancelled';
        return true;
    });

    return (
        <div className="container max-w-4xl mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/technician/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
                </Button>
                <h1 className="text-2xl font-bold text-slate-800">Job History</h1>
            </div>

            <div className="flex items-center justify-between">
                <div className="bg-slate-100 p-1 rounded-lg inline-flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('all')}
                        className={`h-8 rounded-md text-xs font-medium ${filter === 'all' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
                    >
                        All Jobs
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('completed')}
                        className={`h-8 rounded-md text-xs font-medium ${filter === 'completed' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
                    >
                        Completed
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('cancelled')}
                        className={`h-8 rounded-md text-xs font-medium ${filter === 'cancelled' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
                    >
                        Cancelled
                    </Button>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="w-3.5 h-3.5" /> Filter
                </Button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
            ) : (
                <Card className="border-none shadow-none bg-transparent">
                    <CardContent className="p-0">
                        <TechnicianJobHistory jobs={filteredJobs} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default TechnicianHistoryPage;
