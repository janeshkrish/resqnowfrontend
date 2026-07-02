import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("towing classification contract", () => {
  it("keeps every rendered job/request classification on the server flag", async () => {
    const [activeJobSource, dashboardSource, activeJobHookSource, trackingSource] =
      await Promise.all([
        readFile("src/pages/technician/ActiveJob.tsx", "utf8"),
        readFile(
          "src/pages/technician/TechnicianDashboard.tsx",
          "utf8"
        ),
        readFile("src/hooks/useTechnicianActiveJob.ts", "utf8"),
        readFile("src/components/RequestTracking.tsx", "utf8"),
      ]);

    expect(activeJobSource).toContain(
      "const isTowingActiveJob = Boolean(job.isTowing);"
    );
    expect(dashboardSource).toMatch(
      /const isTowingJob = \(job: any\) =>\s+Boolean\(job\?\.isTowing\);/
    );
    expect(activeJobHookSource).toContain(
      "const isTowingJob = Boolean(job.isTowing);"
    );
    expect(trackingSource).toContain(
      "const isTowingRequest = Boolean(request?.isTowing);"
    );
  });
});
