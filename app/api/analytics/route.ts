import { getAnalytics } from '@/db/analytics';
import { apiError, json } from '@/lib/api';

export async function GET() {
  try {
    return json(await getAnalytics());
  } catch (error) {
    return apiError(error);
  }
}
