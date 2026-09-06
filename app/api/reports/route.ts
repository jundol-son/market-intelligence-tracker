import { listReports } from '@/db/reports';
import { apiError, json } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const requested = Number(new URL(request.url).searchParams.get('limit') ?? 90);
    const limit = Number.isInteger(requested) ? Math.min(365, Math.max(1, requested)) : 90;
    return json({ reports: await listReports(limit) });
  } catch (error) {
    return apiError(error);
  }
}
