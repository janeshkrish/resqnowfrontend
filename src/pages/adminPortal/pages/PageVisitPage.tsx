import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getPageVisitSummary,
  listPageVisits,
  type PageVisitQuery,
  type PageVisitRow,
} from "../api/pageVisitApi";
import {
  Btn,
  Card,
  Cell,
  Empty,
  ErrorState,
  Kpis,
  Loading,
  Pager,
  Pill,
  Row,
  SearchBox,
  Select,
  Table,
  usePortalHeader,
  type Tone,
} from "../ui";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const COLS = "130px 120px 140px 130px 120px minmax(130px, 1.2fr) minmax(150px, 1.4fr) 90px";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatVisitTime(dateString: string): string {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateString;
  }
}

function resolveSourceTone(source: string): Tone {
  const s = String(source || "").toLowerCase();
  if (s.startsWith("direct")) return "ok";
  if (s.includes("chatgpt") || s.includes("gemini") || s.includes("claude") || s.includes("perplexity") || s.includes("copilot")) {
    return "hot";
  }
  if (s.startsWith("campaign") || s.includes("[utm:")) return "warn";
  if (s.startsWith("referral")) return "dark";
  return "";
}

export default function PageVisitPage() {
  usePortalHeader("Page Visit", "Real-time visitor tracking and traffic source attribution");

  const [range, setRange] = useState("today");
  const [source, setSource] = useState("");
  const [device, setDevice] = useState("");
  const [browser, setBrowser] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [range, source, device, browser]);

  // Fetch KPI Summary
  const summaryQuery = useQuery({
    queryKey: ["portal", "page-visits", "summary", range],
    queryFn: () => getPageVisitSummary(range),
    refetchInterval: 30_000,
  });

  // Fetch Visits List
  const params: PageVisitQuery = useMemo(() => ({
    page,
    limit: 25,
    range,
    source: source || undefined,
    device: device || undefined,
    browser: browser || undefined,
    search: search || undefined,
  }), [page, range, source, device, browser, search]);

  const listQuery = useQuery({
    queryKey: ["portal", "page-visits", "list", params],
    queryFn: () => listPageVisits(params),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const summary = summaryQuery.data;
  const list = listQuery.data;

  const sourceOptions = useMemo(() => [
    { value: "", label: "All sources" },
    ...(list?.sources || []).map((s) => ({ value: s, label: s })),
  ], [list?.sources]);

  const deviceOptions = useMemo(() => [
    { value: "", label: "All devices" },
    ...(list?.devices || []).map((d) => ({ value: d, label: d })),
  ], [list?.devices]);

  const browserOptions = useMemo(() => [
    { value: "", label: "All browsers" },
    ...(list?.browsers || []).map((b) => ({ value: b, label: b })),
  ], [list?.browsers]);

  return (
    <div className="adm-stack" data-testid="page-visit-page">
      {/* KPI Cards */}
      <Kpis
        cols={5}
        items={[
          {
            label: "Visitors today",
            value: summary ? summary.visitorsToday.toLocaleString() : "—",
            note: "Unique client IPs",
            testId: "kpi-visitors",
          },
          {
            label: "Page views today",
            value: summary ? summary.pageViewsToday.toLocaleString() : "—",
            note: "Total route hits",
            testId: "kpi-pageviews",
          },
          {
            label: "Average time on page",
            value: summary ? formatDuration(summary.avgTimeOnPageSeconds) : "—",
            note: "Active dwell time",
            testId: "kpi-dwelltime",
          },
          {
            label: "Top page today",
            value: summary?.topPageToday || "—",
            note: summary?.topPageViews ? `${summary.topPageViews} views` : "No visits today",
            testId: "kpi-toppage",
          },
          {
            label: "Top source today",
            value: summary?.topSourceToday || "—",
            note: summary?.topSourceVisits ? `${summary.topSourceVisits} visits` : "No visits today",
            testId: "kpi-topsource",
          },
        ]}
      />

      {/* Filter and Search Bar */}
      <div className="ap-bar">
        <div className="ap-filters" style={{ flexWrap: "wrap", gap: 8 }}>
          <Select
            label="Date range"
            icon="calendar_month"
            value={range}
            onChange={setRange}
            options={RANGE_OPTIONS}
          />
          <Select
            label="Traffic source"
            icon="traffic"
            value={source}
            onChange={setSource}
            options={sourceOptions}
          />
          <Select
            label="Device"
            icon="devices"
            value={device}
            onChange={setDevice}
            options={deviceOptions}
          />
          <Select
            label="Browser"
            icon="web"
            value={browser}
            onChange={setBrowser}
            options={browserOptions}
          />
        </div>

        <div className="ap-filters" style={{ flex: "1 1 240px", justifyContent: "flex-end" }}>
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search page, IP, location, or source..."
            style={{ width: "100%", maxWidth: 320 }}
          />
          {(source || device || browser || search) && (
            <Btn
              variant="ghost"
              size="sm"
              icon="filter_alt_off"
              onClick={() => {
                setSource("");
                setDevice("");
                setBrowser("");
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              Reset
            </Btn>
          )}
        </div>
      </div>

      {/* Table Section */}
      <Card title="Visitor Log">
        {listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : !list ? (
          <Loading height={320} label="Loading page visits..." />
        ) : list.rows.length === 0 ? (
          <Empty
            icon="visibility"
            title="No page visits recorded"
            sub="No visitor activity matches the selected filters or date range."
          />
        ) : (
          <Table
            label="Page visits"
            testId="page-visits-table"
            cols={COLS}
            minWidth={980}
            head={[
              "Time",
              "IP Address",
              "Location",
              "Device",
              "Browser",
              "Page Visited",
              "Previous Page",
              "Time Spent",
            ]}
            foot={
              <>
                <span>
                  Showing {list.rows.length} of {list.total.toLocaleString()} visit{list.total === 1 ? "" : "s"}
                </span>
                <Pager page={list.page} totalPages={list.totalPages} onPage={setPage} />
              </>
            }
          >
            {list.rows.map((row: PageVisitRow) => (
              <Row key={row.id} cols={COLS} label={`Visit from ${row.ip_address} on ${row.page_visited}`}>
                <Cell className="ap-faint">
                  <span style={{ fontSize: "12.5px" }}>{formatVisitTime(row.created_at)}</span>
                </Cell>
                <Cell>
                  <code style={{ fontSize: "12px", background: "var(--hair)", padding: "2px 5px", border: "1px solid var(--line)", borderRadius: 4 }}>
                    {row.ip_address}
                  </code>
                </Cell>
                <Cell>
                  <span title={row.location} style={{ display: "block", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.location || "Local/Unknown"}
                  </span>
                </Cell>
                <Cell>
                  <span style={{ display: "block", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.device || "Unknown"}
                  </span>
                </Cell>
                <Cell>
                  <span style={{ display: "block", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.browser || "Unknown"}
                  </span>
                </Cell>
                <Cell>
                  <b title={row.page_visited} style={{ display: "block", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.page_visited}
                  </b>
                </Cell>
                <Cell>
                  <Pill tone={resolveSourceTone(row.previous_page)}>
                    {row.previous_page}
                  </Pill>
                </Cell>
                <Cell>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>
                    {formatDuration(row.time_spent_seconds)}
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
