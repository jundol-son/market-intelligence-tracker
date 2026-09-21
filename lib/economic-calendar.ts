import type { EconomicEventInput } from './economic-event';

export const BLS_CALENDAR_URL = 'https://www.bls.gov/schedule/news_release/bls.ics';

export type SyncedEconomicEvent = Pick<EconomicEventInput,
  'eventName' | 'eventType' | 'country' | 'scheduledAt' | 'expectedImpact' | 'status' | 'sourceUrl'> & {
  externalId: string;
};

const rules: Array<{ match: RegExp; eventType: EconomicEventInput['eventType']; impact: number }> = [
  { match: /Consumer Price Index/i, eventType: 'CPI', impact: 95 },
  { match: /Producer Price Index/i, eventType: 'PPI', impact: 85 },
  { match: /Employment Situation/i, eventType: 'EMPLOYMENT', impact: 95 },
  { match: /Job Openings and Labor Turnover Survey/i, eventType: 'EMPLOYMENT', impact: 75 },
  { match: /Employment Cost Index/i, eventType: 'EMPLOYMENT', impact: 70 },
];

function localTimeToUtc(value: string, timeZone: string) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new Error(`지원하지 않는 캘린더 시각입니다: ${value}`);
  const numbers = match.slice(1).map(Number);
  const target = Date.UTC(numbers[0], numbers[1] - 1, numbers[2], numbers[3], numbers[4], numbers[5]);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(candidate)).reduce<Record<string, number>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = Number(part.value);
      return result;
    }, {});
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
    candidate += target - represented;
  }
  return new Date(candidate).toISOString();
}

function calendarTime(line: string) {
  const separator = line.indexOf(':');
  const params = line.slice(0, separator);
  const value = line.slice(separator + 1);
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return new Date(value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')).toISOString();
  }
  const sourceZone = /TZID=([^;:]+)/.exec(params)?.[1] ?? 'America/New_York';
  const zone = sourceZone === 'US-Eastern' ? 'America/New_York' : sourceZone;
  return localTimeToUtc(value, zone);
}

export function parseBlsCalendar(source: string): SyncedEconomicEvent[] {
  if (!source.includes('BEGIN:VCALENDAR')) throw new Error('BLS 캘린더 응답이 올바르지 않습니다.');
  const unfolded = source.replace(/\r?\n[ \t]/g, '');
  return unfolded.split('BEGIN:VEVENT').slice(1).flatMap((block) => {
    const lines = block.split(/\r?\n/);
    const line = (name: string) => lines.find((item) => item.startsWith(`${name}:`) || item.startsWith(`${name};`));
    const summary = line('SUMMARY')?.slice(line('SUMMARY')!.indexOf(':') + 1).replace(/\\([,;\\])/g, '$1').trim();
    const start = line('DTSTART');
    const rule = summary && rules.find((item) => item.match.test(summary));
    if (!summary || !start || !rule) return [];
    const scheduledAt = calendarTime(start);
    return [{
      externalId: line('UID')?.slice(4).trim() || `${summary}:${scheduledAt}`,
      eventName: summary,
      eventType: rule.eventType,
      country: 'US',
      scheduledAt,
      expectedImpact: rule.impact,
      status: 'SCHEDULED',
      sourceUrl: BLS_CALENDAR_URL,
    }];
  });
}
