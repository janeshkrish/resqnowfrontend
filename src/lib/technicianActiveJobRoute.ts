const normalizeJobId = (value: unknown) => String(value ?? "").trim();

export type TechnicianActiveJobNavigation<T> = {
  path: string;
  state: {
    jobId: string;
    job: T;
    openNavigation?: boolean;
  };
};

export function getTechnicianActiveJobPath(jobId: unknown): string {
  const normalizedJobId = normalizeJobId(jobId);
  return normalizedJobId
    ? `/technician/active-job/${encodeURIComponent(normalizedJobId)}`
    : "/technician/active-job";
}

export function getTechnicianActiveJobNavigation<
  T extends { requestId?: unknown; id?: unknown }
>(
  job: T | null | undefined,
  options: { openNavigation?: boolean } = {},
): TechnicianActiveJobNavigation<T> | null {
  if (!job) return null;
  const jobId = normalizeJobId(job.requestId ?? job.id);
  if (!jobId) return null;

  return {
    path: getTechnicianActiveJobPath(jobId),
    state: {
      jobId,
      job,
      ...(options.openNavigation ? { openNavigation: true } : {}),
    },
  };
}

export function selectMatchingActiveJobNavigationState<
  T extends { requestId?: unknown; id?: unknown }
>(
  candidateJob: T | null | undefined,
  routeRequestId: unknown
): T | null {
  const expectedJobId = normalizeJobId(routeRequestId);
  const candidateJobId = normalizeJobId(candidateJob?.requestId ?? candidateJob?.id);
  return expectedJobId && candidateJobId === expectedJobId ? candidateJob : null;
}
