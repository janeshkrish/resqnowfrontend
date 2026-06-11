import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Search, Star, Truck, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import { assignAdminRequest } from "../api/adminExtendedApi";
import { getAdminRequestAssignmentCandidates } from "@/services/adminDetailsService";

export default function TechnicianAssignmentModal({
  open,
  requestId,
  onClose,
  onAssigned,
}: {
  open: boolean;
  requestId: number | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const candidatesQuery = useQuery({
    queryKey: ["admin", "request-candidates", requestId, search],
    queryFn: () => getAdminRequestAssignmentCandidates(requestId!, search),
    enabled: open && Boolean(requestId),
  });

  const assignMutation = useMutation({
    mutationFn: (technicianId: number) => assignAdminRequest({ requestId: requestId!, technicianId }),
    onSuccess: async () => {
      toast.success("Technician assigned successfully.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "request-details", requestId] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "request-candidates", requestId] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "technicians"] }),
      ]);
      onAssigned();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Technician"
      description={requestId ? `Request #${requestId}` : ""}
      size="xl"
    >
      <div className="sticky top-0 z-10 bg-white pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, phone, service, fleet type, or vehicle number"
            className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {candidatesQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : candidatesQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(candidatesQuery.error as Error).message}
        </div>
      ) : candidatesQuery.data?.data.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {candidatesQuery.data.data.map((candidate) => (
            <article
              key={candidate.technicianId}
              className={`rounded-xl border p-4 ${candidate.matchesService ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {candidate.profileImage ? (
                    <img src={candidate.profileImage} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <UserRoundCheck className="h-5 w-5 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{candidate.name}</p>
                    <p className="text-xs text-slate-500">#{candidate.technicianId} | {candidate.phone || "-"}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${candidate.availability === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {candidate.availability}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <span className="rounded-lg bg-white p-2 font-semibold text-slate-700">
                  <MapPin className="mb-1 h-3.5 w-3.5" /> {candidate.distanceKm == null ? "-" : `${candidate.distanceKm} km`}
                </span>
                <span className="rounded-lg bg-white p-2 font-semibold text-slate-700">
                  <Star className="mb-1 h-3.5 w-3.5" /> {candidate.rating.toFixed(1)}
                </span>
                <span className="rounded-lg bg-white p-2 font-semibold text-slate-700">
                  Jobs<br />{candidate.jobsCompleted}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {candidate.services.slice(0, 5).map((service) => (
                  <span key={service} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                    {service}
                  </span>
                ))}
                {candidate.fleet.slice(0, 3).map((fleet) => (
                  <span key={`${fleet.vehicleType}-${fleet.vehicleNumber}`} className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                    <Truck className="mr-1 h-3 w-3" /> {fleet.vehicleType}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => assignMutation.mutate(candidate.technicianId)}
                disabled={assignMutation.isPending}
                className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Assign Technician
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
          No approved technicians match this search.
        </div>
      )}
    </Modal>
  );
}
