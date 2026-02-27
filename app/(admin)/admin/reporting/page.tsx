import { Suspense } from "react";
import { subDays, endOfDay, startOfDay, parseISO } from "date-fns";
import { getChartData, getTopPosts, getTopNewsletters } from "@/lib/analytics";
import { PerformanceChart } from "./PerformanceChart";
import { ContentBreakdown } from "./ContentBreakdown";
import { ReportingDatePicker } from "./ReportingDatePicker";
import { ExportReportButton } from "./ExportReportButton";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

function parseDateRange(fromStr: string | undefined, toStr: string | undefined): {
  startDate: Date;
  endDate: Date;
} {
  const today = endOfDay(new Date());
  const defaultStart = subDays(today, 30);

  if (!fromStr || !toStr) {
    return { startDate: defaultStart, endDate: today };
  }

  const fromDate = parseISO(fromStr);
  const toDate = parseISO(toStr);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return { startDate: defaultStart, endDate: today };
  }

  const startDate = startOfDay(fromDate);
  const endDate = endOfDay(toDate);

  if (startDate > endDate) {
    return { startDate: defaultStart, endDate: today };
  }

  return { startDate, endDate };
}

export default async function ReportingPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const { startDate, endDate } = parseDateRange(resolved.from, resolved.to);

  const [chartData, topPosts, topNewsletters] = await Promise.all([
    getChartData(startDate, endDate),
    getTopPosts(startDate, endDate),
    getTopNewsletters(startDate, endDate),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      <div className="mx-auto w-[95%] space-y-8 py-10">
        {/* Header Section: Title + Date Picker (left) | Export (right) */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="font-serif text-2xl font-bold text-hot-white">
              Platform Performance
            </h1>
            <Suspense
              fallback={
                <div className="mt-6 h-9 w-64 animate-pulse rounded-md bg-white/5" />
              }
            >
              <div className="mt-6">
                <ReportingDatePicker
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            </Suspense>
          </div>
          <div className="shrink-0">
            <ExportReportButton />
          </div>
        </div>

        {/* Report content for PDF export (explicit backgrounds for html2canvas) */}
        <div
          id="report-container"
          className="space-y-8 rounded-lg bg-[#0a0a0a] p-6"
        >
          {/* Chart Section */}
          <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
            <PerformanceChart data={chartData} />
          </div>

          {/* Table Section */}
          <ContentBreakdown posts={topPosts} newsletters={topNewsletters} />
        </div>
      </div>
    </div>
  );
}
