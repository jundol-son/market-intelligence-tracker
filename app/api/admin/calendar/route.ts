import { createEconomicEvent, listEconomicEvents } from '@/db/economic-events';
import { apiError, json, requireAdmin } from '@/lib/api';
import { parseEconomicEventInput } from '@/lib/economic-event';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json({ events: await listEconomicEvents() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json({ event: await createEconomicEvent(parseEconomicEventInput(await request.json())) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
