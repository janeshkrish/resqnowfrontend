import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REQUEST_SENT_MIN_MS,
  REQUEST_SENT_PLAY_MS,
  REQUEST_SENT_STILL_MS,
  RequestSentOverlay,
  type RequestSentOverlayProps,
} from "./RequestSentOverlay";

const card = { title: "Towing", line: "Maruti Suzuki Swift · Car", art: "/images/vehicles/car.webp", fare: "₹902" };

const show = (props: Partial<RequestSentOverlayProps> = {}) => {
  const onDone = vi.fn();
  const view = render(
    <RequestSentOverlay
      nextLine="Finding a tow truck near you"
      art="/images/home/services/towing.webp"
      glyph="auto_towing"
      card={card}
      cutShort={false}
      reduceMotion={false}
      getTarget={() => null}
      onDone={onDone}
      {...props}
    />,
  );
  return { onDone, ...view };
};
const overlay = () => screen.getByTestId("request-sent");
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe("RequestSentOverlay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("says the request was sent, what is being found, and what was asked for", () => {
    const { container } = show();

    expect(screen.getByRole("status")).toHaveTextContent("Request sent. Finding a tow truck near you.");
    expect(container.querySelector(".rq-rs-title")).toHaveTextContent("Request sent");
    expect(container.querySelector(".rq-rs-next")).toHaveTextContent("Finding a tow truck near you");
    const sentCard = screen.getByTestId("request-sent-card");
    expect(sentCard).toHaveTextContent("Towing");
    expect(sentCard).toHaveTextContent("Maruti Suzuki Swift · Car");
    expect(sentCard).toHaveTextContent("₹902");
    // Three spots where the request lands, each carrying the service's own picture.
    const pins = container.querySelectorAll(".rq-rs-tpin img");
    expect(pins).toHaveLength(3);
    expect(pins[0]).toHaveAttribute("src", "/images/home/services/towing.webp");
    expect(overlay()).toHaveAttribute("data-stage", "playing");
    expect(container.querySelector(".rq-rs-wipe")).not.toBeNull();
  });

  it("waits for the request before showing its card, and uses a symbol when the service has no picture", () => {
    const { container } = show({ card: null, art: null, glyph: "two_wheeler" });

    expect(screen.queryByTestId("request-sent-card")).toBeNull();
    expect(container.querySelectorAll(".rq-rs-tpin img")).toHaveLength(0);
    const symbols = container.querySelectorAll(".rq-rs-tpin .rq-symbol");
    expect(symbols).toHaveLength(3);
    expect(symbols[0]).toHaveTextContent("two_wheeler");
  });

  it("plays through, opens, and then says it is done", () => {
    const { onDone, container } = show();

    wait(REQUEST_SENT_PLAY_MS - 1);
    expect(overlay()).toHaveAttribute("data-stage", "playing");
    wait(1);
    expect(overlay()).toHaveAttribute("data-stage", "opening");
    expect(overlay()).toHaveClass("is-open");
    // The crimson sweep must not show through as the screen opens.
    expect(container.querySelector(".rq-rs-wipe")).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
    wait(719);
    expect(onDone).not.toHaveBeenCalled();
    wait(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("opens early once a technician has accepted, but never so fast that it only flashes", () => {
    const { rerender, onDone } = show();
    const again = (cutShort: boolean) =>
      rerender(
        <RequestSentOverlay nextLine="Finding a tow truck near you" art={null} glyph="auto_towing" card={card} cutShort={cutShort} reduceMotion={false} getTarget={() => null} onDone={onDone} />,
      );

    wait(300);
    again(true);
    wait(REQUEST_SENT_MIN_MS - 301);
    expect(overlay()).toHaveAttribute("data-stage", "playing");
    wait(1);
    expect(overlay()).toHaveAttribute("data-stage", "opening");
    wait(720);
    expect(onDone).toHaveBeenCalledTimes(1);
    // The full-length timer coming due later changes nothing.
    wait(REQUEST_SENT_PLAY_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("opens at once when the acceptance comes after the shortest showing", () => {
    const { rerender, onDone } = show();
    wait(REQUEST_SENT_MIN_MS + 400);
    rerender(
      <RequestSentOverlay nextLine="Finding a tow truck near you" art={null} glyph="auto_towing" card={card} cutShort reduceMotion={false} getTarget={() => null} onDone={onDone} />,
    );
    wait(0);
    expect(overlay()).toHaveAttribute("data-stage", "opening");
  });

  it("opens from the customer's marker, and moves the pin onto it when it is close", () => {
    // In this test the pin's tip measures as the top-left corner.
    show({ getTarget: () => ({ x: 60, y: 80 }) });
    wait(REQUEST_SENT_PLAY_MS);

    expect(overlay()).toHaveClass("is-glide");
    expect(overlay().style.getPropertyValue("--rs-x")).toBe("60px");
    expect(overlay().style.getPropertyValue("--rs-y")).toBe("80px");
    expect(overlay().style.getPropertyValue("--rs-dx")).toBe("60px");
    expect(overlay().style.getPropertyValue("--rs-dy")).toBe("80px");
  });

  it("opens where the marker is without dragging the pin across the screen when it is far away", () => {
    const { onDone } = show({ getTarget: () => ({ x: 400, y: 400 }) });
    wait(REQUEST_SENT_PLAY_MS);

    expect(overlay()).not.toHaveClass("is-glide");
    expect(overlay().style.getPropertyValue("--rs-x")).toBe("400px");
    expect(overlay().style.getPropertyValue("--rs-dx")).toBe("0px");
    wait(720);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("with motion reduced it is a still picture that leaves sooner", () => {
    const { onDone } = show({ reduceMotion: true });

    expect(overlay()).toHaveClass("is-still");
    wait(REQUEST_SENT_STILL_MS - 1);
    expect(overlay()).toHaveAttribute("data-stage", "playing");
    wait(1);
    expect(overlay()).toHaveAttribute("data-stage", "opening");
    wait(220);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("stops its timers when it is taken away", () => {
    const { onDone, unmount } = show();
    unmount();
    wait(REQUEST_SENT_PLAY_MS * 2);
    expect(onDone).not.toHaveBeenCalled();
  });
});
