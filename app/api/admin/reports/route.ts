import { generateDailyReport, getReport } from '@/db/reports';
import { apiError, json, requireAdmin } from '@/lib/api';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const generated = await generateDailyReport();
    return json({ ...generated, detail: await getReport(generated.id) }, generated.created ? 201 : 200);
  } catch (error) {
    return apiError(error);
  }
}
