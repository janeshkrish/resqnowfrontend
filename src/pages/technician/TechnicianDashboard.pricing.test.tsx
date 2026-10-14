import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import TechnicianDashboard from "./TechnicianDashboard";

const state = vi.hoisted(() => ({ job: null as any, technician: { id: "7", name: "Ravi", verification_status: "verified", service_type: "mechanic", vehicle_types: ["car"] }, refresh: vi.fn(), accept: vi.fn(), fetch: vi.fn() }));
vi.mock("@/contexts/TechnicianAuthContext", () => ({ useTechnicianAuth: () => ({ technician: state.technician, isOnline: false, isLoading: false, setIsOnline: vi.fn() }) }));
vi.mock("@/contexts/TechnicianJobContext", () => ({ useTechnicianJob: () => ({ acceptedJobId: null, setAcceptedJobId: vi.fn(), clearAcceptedJobId: vi.fn(), acceptJob: state.accept, pendingAcceptanceId: null, acceptanceMessage: null, checkAcceptance: vi.fn(), canRetryAcceptance: false, retryAcceptance: vi.fn() }) }));
vi.mock("@/hooks/useTechnicianActiveJob", () => ({ useTechnicianActiveJob: () => ({ activeJob: state.job, setActiveJob: vi.fn(), refreshActiveJob: state.refresh }) }));
vi.mock("@/hooks/useRoadRouteEstimate", () => ({ useRoadRouteEstimate: () => ({ status: "ready", distanceKm: 2.4, durationMinutes: 8 }) }));
vi.mock("@/hooks/useTechnicianTowingManagement", () => ({ useTechnicianTowingManagement: () => ({ vehicles: [], employees: [] }) }));
vi.mock("@/lib/api", () => ({ apiFetch: state.fetch, apiUrl: (path: string) => path, FRONTEND_ONLY_MODE: true, getRequiredApiBaseUrl: () => "" , readJsonSafely: async (response: Response) => response.json() }));
vi.mock("@/components/technician/TechnicianJobMap", () => ({ default: () => <div>Map</div> }));
vi.mock("@/components/technician/JobAlertsBanner", () => ({ default: () => null }));
vi.mock("@/components/technician/TechnicianJobCompletion", () => ({ default: () => null }));
vi.mock("@/components/technician/app/TechHome", () => ({ default: () => <div>Home</div> }));
vi.mock("@/components/technician/TechnicianJobModal", () => ({ TechnicianJobModal: ({ job, isOpen, onAccept }: any) => isOpen && job ? <div><span>Offer earnings {job.amount}</span><button onClick={() => onAccept(job.id, job.offerId)}>Accept offer</button></div> : null }));
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  localStorage.clear(); sessionStorage.clear();
  state.job = { id: "101", status: "assigned", offerId: "81", amount: 1200, technicianEstimatedEarning: 1200, isTowing: false, service_type: "flat-tyre" };
  state.refresh.mockReset().mockResolvedValue(state.job);
  state.accept.mockReset().mockResolvedValue({ success: true, job: { id: "101", status: "accepted" } });
  state.fetch.mockReset().mockImplementation(async (path: string) => new Response(JSON.stringify(path.includes("technician-offer") ? { available: true, request: { id: "101", offerId: "92", amount: 1250, technicianEstimatedEarning: 1250, offer_status: "pending" } } : /history|reviews|notifications|requests/.test(path) ? [] : {}), { status: 200 }));
});
const show = (path = "/technician/dashboard") => render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TechnicianDashboard /></MemoryRouter>);
it.each([false, true])("offers explicit acceptance before showing assigned-job journey actions (towing=%s)", async (isTowing) => {
  state.job = { ...state.job, isTowing }; state.refresh.mockResolvedValue(state.job);
  show();
  expect(screen.queryAllByRole("button", { name: /start journey|start pickup|navigate/i })).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
  await waitFor(() => expect(state.accept).toHaveBeenCalledWith("101", "81"));
});
it("opens the latest offer for review without auto accepting an old link missing its price identity", async () => {
  state.job = null; state.refresh.mockResolvedValue(null);
  show("/technician/dashboard?jobId=101&alertAction=accept");
  expect(await screen.findByText("Offer earnings 1250")).toBeInTheDocument();
  expect(state.accept).not.toHaveBeenCalled();
});
it("passes the original link offer identity even when a newer offer is available", async () => {
  state.job = { ...state.job, offerId: "92" }; state.refresh.mockResolvedValue(state.job);
  state.accept.mockRejectedValue(Object.assign(new Error("This offer has expired."), { code: "offer_expired", status: 409 }));
  show("/technician/dashboard?jobId=101&alertAction=accept&offerId=81");
  await waitFor(() => expect(state.accept).toHaveBeenCalledWith("101", "81"));
});
it("lets a legacy assigned job review regenerated earnings before accepting its new offer identity", async () => {
  state.job = { ...state.job, offerId: null, technicianEstimatedEarning: null, amount: 0 };
  state.refresh.mockResolvedValue(state.job);
  show();
  fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
  expect(await screen.findByText("Offer earnings 1250")).toBeInTheDocument();
  expect(state.accept).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Accept offer" }));
  await waitFor(() => expect(state.accept).toHaveBeenCalledWith("101", "92"));
});
