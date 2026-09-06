import { getReport } from '@/db/reports';
import { apiError, json, pathId } from '@/lib/api';

export async function GET(request: Request) {
  try {
    const report = await getReport(pathId(request));
    return report ? json(report) : json({ error: '리포트를 찾을 수 없습니다.' }, 404);
  } catch (error) {
    return apiError(error);
  }
}
