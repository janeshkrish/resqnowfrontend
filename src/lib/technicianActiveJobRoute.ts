const normalizeJobId = (value: unknown) => String(value ?? "").trim();

export function getTechnicianActiveJobPath(jobId: unknown): string {
  const normalizedJobId = normalizeJobId(jobId);
  return normalizedJobId
    ? `/technician/active-job/${encodeURIComponent(normalizedJobId)}`
    : "/technician/active-job";
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
