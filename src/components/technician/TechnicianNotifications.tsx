import React from "react";
import { Bell, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

interface TechnicianNotificationsProps {
    notifications: Notification[];
}

const TechnicianNotifications: React.FC<TechnicianNotificationsProps> = ({ notifications }) => {
    const getIcon = (type: string) => {
        switch (type) {
            case "info": return <Info className="h-4 w-4 text-blue-500" />;
            case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
            default: return <Bell className="h-4 w-4 text-muted-foreground/80" />;
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-red-500" />
                    Recent Alerts
                </CardTitle>
                {notifications.filter(n => !n.is_read).length > 0 && (
                    <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[10px]">
                        {notifications.filter(n => !n.is_read).length} New
                    </Badge>
                )}
            </CardHeader>
            <CardContent>
                {notifications.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">No notifications.</p>
                ) : (
                    <div className="space-y-4">
                        {notifications.map((notif) => (
                            <div key={notif.id} className={`flex gap-3 pb-3 border-b last:border-0 last:pb-0 ${!notif.is_read ? "opacity-100" : "opacity-70"}`}>
                                <div className="mt-0.5">{getIcon(notif.type)}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground leading-none mb-1">{notif.title}</p>
                                    <p className="text-xs text-muted-foreground/80 line-clamp-2">{notif.message}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TechnicianNotifications;
