import { useParams } from "react-router-dom";
import RequestReplayPage from "@/pages/adminExtended/monitor/RequestReplayPage";
import { usePortalHeader } from "../ui";

export default function ReplayPage() {
  const { requestId } = useParams();
  usePortalHeader(`#${requestId} · replay`, "A finished job: the route as driven, with every step and how long it took.");
  return <RequestReplayPage />;
}
