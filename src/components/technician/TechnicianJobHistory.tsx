import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { format } from "date-fns";
import { Clock, MapPin, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface JobHistoryItem {
    id: string;
    service_type: string;
    vehicle_type: string;
    vehicle_model: string;
    address: string;
    status: string;
    created_at: string;
    amount: number | null;
}

interface TechnicianJobHistoryProps {
    jobs: JobHistoryItem[];
    compact?: boolean;
}

const TechnicianJobHistory: React.FC<TechnicianJobHistoryProps> = ({ jobs, compact = false }) => {
    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-2 py-0.5"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
            // ... (keep other cases but maybe update classes for consistency if needed, but existing are fine)
            case 'cancelled':
                return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-2 py-0.5"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
            case 'rejected':
                return <Badge className="bg-muted/50 text-foreground border-border text-[10px] px-2 py-0.5"><Clock className="w-3 h-3 mr-1" /> Rejected</Badge>;
            case 'in-progress':
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200 animate-pulse text-[10px] px-2 py-0.5"><AlertCircle className="w-3 h-3 mr-1" /> In Progress</Badge>;
            default:
                return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] px-2 py-0.5">{status}</Badge>;
        }
    };

    if (compact) {
        return (
            <div className="space-y-3">
                {jobs.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground">No recent jobs.</div>
                ) : (
                    jobs.map((job) => (
                        <div key={job.id} className="flex items-center justify-between p-2 border-b last:border-0">
                            <div>
                                <p className="font-medium text-sm text-muted-foreground capitalize">{job.service_type.replace(/-/g, ' ')}</p>
                                <p className="text-xs text-slate-400">{format(new Date(job.created_at), "MMM d, h:mm a")}</p>
                            </div>
                            <div className="text-right">
                                <div className="font-semibold text-sm">₹{job.amount || 0}</div>
                                <div className="scale-90 origin-right">{getStatusBadge(job.status)}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl">Job History</CardTitle>
            </CardHeader>
            <CardContent>
                {jobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No previous jobs found.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {jobs.map((job) => (
                            <div
                                key={job.id}
                                className="p-4 border rounded-xl hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-semibold text-lg capitalize">
                                            {job.service_type.replace(/-/g, ' ')}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {job.vehicle_type} - {job.vehicle_model}
                                        </p>
                                    </div>
                                    {getStatusBadge(job.status)}
                                </div>

                                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {format(new Date(job.created_at), "MMM d, h:mm a")}
                                    </div>
                                    <div className="flex items-center gap-1 flex-1 truncate">
                                        <MapPin className="w-4 h-4" />
                                        <span className="truncate">{job.address}</span>
                                    </div>
                                    {job.amount && (
                                        <div className="font-bold text-foreground">
                                            ₹{job.amount}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TechnicianJobHistory;
