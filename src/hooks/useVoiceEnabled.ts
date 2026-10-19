import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchVoiceStatus, VOICE_STATUS_KEY } from "@/lib/voice/api";

/** Whether to show ResQNow-Thozhan to this customer (the server can switch it off or limit it to a few accounts). */
export function useVoiceEnabled() {
  const { isAuthenticated } = useAuth();
  const status = useQuery({ queryKey: VOICE_STATUS_KEY, queryFn: fetchVoiceStatus, enabled: isAuthenticated, staleTime: 60_000, retry: 0 });
  return Boolean(isAuthenticated && status.data?.enabled);
}
