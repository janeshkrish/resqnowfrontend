import { afterEach, describe, expect, it } from "vitest";
import {
  announceClosedJobOffer,
  announcePushedJobOffer,
  classifyJobPush,
  offerRequestId,
  onClosedJobOffer,
  onPushedJobOffer,
} from "./jobOfferEvents";

const stops: Array<() => void> = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));

describe("job pushes", () => {
  it("tells an offer from a closed offer and a direct assignment", () => {
    expect(classifyJobPush({ type: "EMERGENCY_JOB", event: "job_offer", requestId: "6101" })).toBe("offer");
    expect(classifyJobPush({ event: "job_offer" })).toBe("offer");
    expect(classifyJobPush({ type: "JOB_REVOKED", event: "job:revoked" })).toBe("closed");
    expect(classifyJobPush({ type: "EMERGENCY_JOB", event: "job:assigned" })).toBe("assigned");
    expect(classifyJobPush({ event: "technician:new_review" })).toBe("other");
    expect(classifyJobPush(undefined)).toBe("other");
  });

  it("reads the request id however the backend named it", () => {
    expect(offerRequestId({ requestId: 6101 })).toBe("6101");
    expect(offerRequestId({ jobId: " 6102 " })).toBe("6102");
    expect(offerRequestId({ id: "6103" })).toBe("6103");
    expect(offerRequestId({ id: "undefined" })).toBe("");
    expect(offerRequestId(null)).toBe("");
  });

  it("reports an offer as shown only when a card on screen claims it", () => {
    expect(announcePushedJobOffer({ requestId: "6101" })).toBe(false);

    const seen: string[] = [];
    stops.push(onPushedJobOffer(() => false));
    expect(announcePushedJobOffer({ requestId: "6101" })).toBe(false);

    stops.push(onPushedJobOffer((offer) => (seen.push(offerRequestId(offer)), true)));
    expect(announcePushedJobOffer({ requestId: "6102" })).toBe(true);
    expect(seen).toEqual(["6102"]);
  });

  it("passes a closed offer's id to the card", () => {
    const closed: string[] = [];
    stops.push(onClosedJobOffer((id) => closed.push(id)));
    announceClosedJobOffer("6101");
    announceClosedJobOffer("");
    expect(closed).toEqual(["6101"]);
  });
});
