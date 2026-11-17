import { NextResponse, type NextRequest } from "next/server";
import { currentStaff } from "@/lib/admin/auth";
import { REPORTS, reportWorkbook, type ReportName } from "@/lib/reports/export";
import { parseFilters } from "@/lib/reports/filters";

export const dynamic = "force-dynamic";

// The Excel file for the report on screen: same filters in, same numbers out. Staff only.
export async function GET(req: NextRequest) {
  if (!(await currentStaff())) return new NextResponse(null, { status: 401 });
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const report = REPORTS.find((r) => r === params.report);
  if (!report) return new NextResponse(null, { status: 400 });
  const now = new Date();
  const f = parseFilters(params, now);
  const status = params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : undefined;
  const file = await reportWorkbook(report as ReportName, f, now, { q: params.q, status });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ayeneh-rang-${report}-${f.from}_${f.to}${f.sample ? "-sample" : ""}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
