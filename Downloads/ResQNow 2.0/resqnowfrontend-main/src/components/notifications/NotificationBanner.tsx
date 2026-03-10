import React from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface NotificationBannerProps {
  onDismiss?: () => void;
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({ onDismiss }) => {
  const { permission, isSupported, requestPermission } = usePushNotifications();

  // Don't show if not supported or already decided
  if (!isSupported || permission !== "default") {
    return null;
  }

  const handleEnable = async () => {
    await requestPermission();
    onDismiss?.();
  };

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">Stay updated!</p>
          <p className="text-xs text-muted-foreground">
            Enable notifications to get real-time updates on your service requests
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleEnable}>
          Enable
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default NotificationBanner;
