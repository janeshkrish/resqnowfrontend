import { useSearchParams } from "react-router-dom";
import LiveRequestsBoard from "@/pages/adminExtended/monitor/LiveRequestsBoard";
import { usePortalHeader } from "../ui";

export default function LivePage() {
  usePortalHeader("Live requests", "Every live job, updated as it happens. Monitor opens one job with its live map.");
  const [params] = useSearchParams();
  const open = Number(params.get("open"));
  return <LiveRequestsBoard key={open || "all"} initialOpenId={Number.isInteger(open) && open > 0 ? open : null} />;
}
