import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TechnicianJobCompletion from "./TechnicianJobCompletion";

const auth = vi.hoisted(() => ({ technician: { id: 7, name: "Arun Kumar" } as { id: number; name?: string } | null }));
vi.mock("@/contexts/TechnicianAuthContext", () => ({ useTechnicianAuth: () => ({ technician: auth.technician }) }));

afterEach(() => {
  vi.useRealTimers();
  auth.technician = { id: 7, name: "Arun Kumar" };
});

describe("the job-complete outro", () => {
  it("congratulates the technician by name and shows what the job earned", () => {
    render(<TechnicianJobCompletion amount={820} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Well done, Arun!" })).toBeInTheDocument();
    expect(screen.getByText("You earned on this job").nextSibling).toHaveTextContent("₹820");
    expect(screen.getByRole("status")).toHaveTextContent("Going to your dashboard in 5 seconds");
  });

  it("goes back to the dashboard by itself after five seconds", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<TechnicianJobCompletion amount={100} onClose={onClose} />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByRole("status")).toHaveTextContent("in 1 second");
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("goes straight away from the button", () => {
    const onClose = vi.fn();
    render(<TechnicianJobCompletion amount={100} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Go to dashboard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves out the name and the amount when they are not known", () => {
    auth.technician = null;
    render(<TechnicianJobCompletion amount={0} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Well done!" })).toBeInTheDocument();
    expect(screen.queryByText("You earned on this job")).not.toBeInTheDocument();
  });
});
