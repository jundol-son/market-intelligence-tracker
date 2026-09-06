import { getDb } from './index';
import type { EconomicEventInput } from '@/lib/economic-event';

type EventRow = Omit<EconomicEventInput, 'affectedAssetIds'> & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export async function listEconomicEvents() {
  const db = getDb();
  const [events, assets] = await Promise.all([
    db.prepare(`SELECT id, event_name AS eventName, event_type AS eventType, country,
      scheduled_at AS scheduledAt, previous_value AS previousValue,
      consensus_value AS consensusValue, actual_value AS actualValue,
      expected_impact AS expectedImpact, status, source_url AS sourceUrl,
      created_at AS createdAt, updated_at AS updatedAt
      FROM economic_events ORDER BY datetime(scheduled_at), expected_impact DESC LIMIT 500`).all<EventRow>(),
    db.prepare(`SELECT m.event_id AS eventId, a.id AS assetId, a.symbol, a.name
      FROM economic_event_assets m JOIN assets a ON a.id=m.asset_id ORDER BY a.symbol`).all(),
  ]);
  return events.results.map((event) => ({
    ...event,
    assets: assets.results.filter((asset) => asset.eventId === event.id),
  }));
}

export async function createEconomicEvent(input: EconomicEventInput) {
  const db = getDb();
  const row = await db.prepare(`INSERT INTO economic_events
    (event_name, event_type, country, scheduled_at, previous_value, consensus_value,
      actual_value, expected_impact, status, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(input.eventName, input.eventType, input.country, input.scheduledAt, input.previousValue,
      input.consensusValue, input.actualValue, input.expectedImpact, input.status, input.sourceUrl)
    .first<{ id: number }>();
  if (!row) throw new Error('경제 이벤트 저장에 실패했습니다.');
  if (input.affectedAssetIds.length) {
    await db.batch(input.affectedAssetIds.map((assetId) => db.prepare(
      'INSERT INTO economic_event_assets (event_id, asset_id) VALUES (?, ?)',
    ).bind(row.id, assetId)));
  }
  return (await listEconomicEvents()).find((event) => event.id === row.id);
}

export async function updateEconomicEvent(id: number, input: EconomicEventInput) {
  const db = getDb();
  const statements = [
    db.prepare(`UPDATE economic_events SET event_name=?, event_type=?, country=?, scheduled_at=?,
      previous_value=?, consensus_value=?, actual_value=?, expected_impact=?, status=?, source_url=?,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(input.eventName, input.eventType, input.country, input.scheduledAt, input.previousValue,
        input.consensusValue, input.actualValue, input.expectedImpact, input.status, input.sourceUrl, id),
    db.prepare('DELETE FROM economic_event_assets WHERE event_id=?').bind(id),
    ...input.affectedAssetIds.map((assetId) => db.prepare(
      'INSERT INTO economic_event_assets (event_id, asset_id) VALUES (?, ?)',
    ).bind(id, assetId)),
  ];
  const [updated] = await db.batch(statements);
  if (!updated.meta.changes) return null;
  return (await listEconomicEvents()).find((event) => event.id === id) ?? null;
}

export async function deleteEconomicEvent(id: number) {
  return (await getDb().prepare('DELETE FROM economic_events WHERE id=?').bind(id).run()).meta.changes > 0;
}
