import WatchListPage from "@/pages/adminExtended/monitor/WatchListPage";
import { usePortalHeader } from "../ui";

export default function WatchPage() {
  usePortalHeader("Watch list", "Up to four pinned jobs side by side, each with its own live map.");
  return <WatchListPage />;
}
