import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchVoiceStatus, VOICE_STATUS_KEY } from "@/lib/voice/api";

/** Whether to show ResQNow-Thozhan to this customer (the server can switch it off or limit it to a few accounts). */
export function useVoiceStatus() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({ queryKey: [...VOICE_STATUS_KEY, user?.id], queryFn: fetchVoiceStatus, enabled: isAuthenticated, staleTime: 60_000, retry: 0 });
}

export function useVoiceEnabled() {
  return useVoiceStatus().data?.enabled === true;
}

export function useWakeEnabled() {
  const { data } = useVoiceStatus();
  return data?.enabled === true && data.wake !== false && data.recognition !== false;
}
