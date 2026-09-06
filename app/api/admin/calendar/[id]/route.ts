import { deleteEconomicEvent, updateEconomicEvent } from '@/db/economic-events';
import { apiError, json, pathId, requireAdmin } from '@/lib/api';
import { parseEconomicEventInput } from '@/lib/economic-event';

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const event = await updateEconomicEvent(pathId(request), parseEconomicEventInput(await request.json()));
    return event ? json({ event }) : json({ error: '경제 이벤트를 찾을 수 없습니다.' }, 404);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return (await deleteEconomicEvent(pathId(request)))
      ? json({ deleted: true })
      : json({ error: '경제 이벤트를 찾을 수 없습니다.' }, 404);
  } catch (error) {
    return apiError(error);
  }
}
