import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

const DeliberateError = () => {
  throw new Error("deliberate boundary test error");
};

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a collapsed stack trace in development", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <DeliberateError />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    const summary = screen.getByText("Debug stack trace");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("deliberate boundary test error");
    expect(details).toHaveTextContent("React component stack:");
    expect(consoleError).toHaveBeenCalledWith(
      "Uncaught error:",
      expect.objectContaining({
        message: "deliberate boundary test error",
        componentStack: expect.any(String),
      }),
    );
  });
});
