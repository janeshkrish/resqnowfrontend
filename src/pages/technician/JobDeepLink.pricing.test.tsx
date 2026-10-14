import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import JobDeepLink from "./JobDeepLink";
const auth = vi.hoisted(() => ({ isAuthenticated: true }));
vi.mock("@/contexts/TechnicianAuthContext", () => ({ useTechnicianAuth: () => auth }));
beforeEach(() => { sessionStorage.clear(); auth.isAuthenticated = true; });
const Destination = () => { const location = useLocation(); return <div data-testid="destination">{JSON.stringify({ search: location.search, state: location.state })}</div>; };
const show = () => render(<MemoryRouter initialEntries={["/technician/job/101?alertAction=accept&offerId=81"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/technician/job/:jobId" element={<JobDeepLink />} /><Route path="/technician/dashboard" element={<Destination />} /><Route path="/technician/login" element={<div>Login</div>} /></Routes></MemoryRouter>);
it("preserves the priced offer identity when forwarding a notification action", async () => {
  show();
  const destination = JSON.parse((await screen.findByTestId("destination")).textContent!);
  expect(new URLSearchParams(destination.search).get("offerId")).toBe("81");
  expect(destination.state).toMatchObject({ jobId: "101", alertAction: "accept", offerId: "81" });
});
it("keeps the same priced offer identity while requiring login", async () => {
  auth.isAuthenticated = false;
  show();
  expect(await screen.findByText("Login")).toBeInTheDocument();
  expect(sessionStorage.getItem("resqnow_pending_job_offer_id")).toBe("81");
});
