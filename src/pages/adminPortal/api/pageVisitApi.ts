import { adminApi } from "@/pages/adminExtended/api/adminExtendedApi";

export interface PageVisitSummary {
  visitorsToday: number;
  pageViewsToday: number;
  avgTimeOnPageSeconds: number;
  topPageToday: string | null;
  topPageViews: number;
  topSourceToday: string | null;
  topSourceVisits: number;
}

export interface PageVisitRow {
  id: string;
  ip_address: string;
  page_visited: string;
  previous_page: string;
  time_spent_seconds: number;
  device: string;
  browser: string;
  location: string;
  session_id: string;
  created_at: string;
}

export interface PageVisitListResponse {
  rows: PageVisitRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sources: string[];
  devices: string[];
  browsers: string[];
}

export interface PageVisitQuery {
  page?: number;
  limit?: number;
  range?: string;
  source?: string;
  device?: string;
  browser?: string;
  search?: string;
}

export const getPageVisitSummary = async (range: string = "today"): Promise<PageVisitSummary> => {
  return (await adminApi.get<PageVisitSummary>("/page-visits/summary", { params: { range } })).data;
};

export const listPageVisits = async (params: PageVisitQuery): Promise<PageVisitListResponse> => {
  return (await adminApi.get<PageVisitListResponse>("/page-visits", { params })).data;
};
