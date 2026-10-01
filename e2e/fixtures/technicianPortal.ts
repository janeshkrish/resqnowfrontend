import { expect, type Locator, type Page, type WebSocketRoute } from "@playwright/test";

/** The signed-in technician every technician-portal test uses. */
export const TECHNICIAN = {
  id: 7, name: "Arun Kumar", email: "arun@example.test", phone: "9876500000", status: "approved",
  verification_status: "verified", is_active: true, is_available: true, service_type: "mechanic",
  specialties: ["flat-tyre"], vehicle_types: ["car", "bike"],
};

/**
 * Speaks just enough Engine.IO v4 / Socket.IO v5 to stand in for the backend's socket
 * server: every socket that joins `technician_7` gets what is sent to that room.
 */
export async function fakeSocketServer(page: Page) {
  const members = new Map<WebSocketRoute, Set<string>>();
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    const rooms = new Set<string>();
    members.set(ws, rooms);
    ws.send(`0${JSON.stringify({ sid: `e2e-${members.size}`, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1e6 })}`);
    ws.onClose(() => members.delete(ws));
    ws.onMessage((message) => {
      const text = String(message);
      if (text === "2") return ws.send("3");
      if (text.startsWith("40")) return ws.send(`40${JSON.stringify({ sid: `e2e-socket-${members.size}` })}`);
      const match = /^42(\d*)(\[.*\])$/.exec(text);
      if (!match) return;
      const [event, arg] = JSON.parse(match[2]);
      if (event === "join_technician_room") {
        rooms.add(`technician_${arg}`);
        if (match[1]) ws.send(`43${match[1]}${JSON.stringify([{ ok: true }])}`);
      }
    });
  });
  const inRoom = () => [...members].filter(([, rooms]) => rooms.has("technician_7")).map(([ws]) => ws);
  return {
    /**
     * Waits until the page's sockets have settled in the technician's room: the app's socket,
     * plus the dashboard's own one there. The app reconnects once the profile has loaded.
     */
    joined: async (sockets = 1) => {
      let steadySince = 0;
      await expect
        .poll(() => {
          if (inRoom().length !== sockets || members.size !== sockets) return (steadySince = 0, false);
          steadySince ||= Date.now();
          return Date.now() - steadySince >= 1000;
        }, { intervals: [100] })
        .toBe(true);
    },
    send: (event: string, data: unknown) => inRoom().forEach((ws) => ws.send(`42${JSON.stringify([event, data])}`)),
  };
}

/** Drags the accept slide's knob to the end, the way a thumb does. */
export async function slideToAccept(card: Locator) {
  const knob = card.getByRole("button", { name: "Slide to accept" });
  const track = card.locator(".rqf-slide");
  // On a phone the card is a bottom sheet: let it finish sliding in, then bring the control up.
  await knob.scrollIntoViewIfNeeded();
  let from = await knob.boundingBox();
  await expect
    .poll(async () => {
      const now = await knob.boundingBox();
      const settled = Boolean(now && from && now.x === from.x && now.y === from.y);
      from = now;
      return settled;
    }, { intervals: [150] })
    .toBe(true);
  const to = await track.boundingBox();
  if (!from || !to) throw new Error("slide control not found");
  const page = card.page();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(from.x + from.width / 2 + ((to.width - from.width) * step) / 12, from.y + from.height / 2);
  }
  await page.mouse.up();
}

/** The value under a label in the earnings / distance / time strip. */
export const stripValue = (scope: Locator, label: "You earn" | "Distance" | "Reach in") =>
  scope.locator(".tj-cell", { hasText: label }).locator("dd");
