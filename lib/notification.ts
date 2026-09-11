export const NOTIFICATION_CHANNELS = ['TELEGRAM', 'EMAIL'] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

export type NotificationSettingInput = {
  channel: NotificationChannel;
  enabled: boolean;
  sendTime: string;
  timezone: string;
};

export type NotificationPayload = {
  reportId: number;
  reportDate: string;
  overallScore: number;
  globalScore: number | null;
  koreaScore: number | null;
  summary: string;
  upProbability: number | null;
  expectedLow: number | null;
  expectedHigh: number | null;
  responseLevel: string;
  metrics: Array<{
    symbol: string;
    name: string;
    price: number | null;
    dailyReturn: number | null;
    compositeScore: number | null;
    trendScore: number | null;
    momentumScore: number | null;
    riskScore: number | null;
    newsScore: number | null;
  }>;
  news: Array<{ title: string; sentiment: string; impactScore: number }>;
  events: Array<{ eventName: string; scheduledAt: string; expectedImpact: number }>;
  kis?: {
    asOf: string | null;
    decision: { title: string; stance: 'POSITIVE' | 'NEUTRAL' | 'CAUTIOUS'; reasons: string[]; risks: string[]; nextChecks: string[] };
    markets: Array<{ symbol: string; breadthPercent: number | null; foreignNetAmount: number | null; institutionNetAmount: number | null }>;
    assets: Array<{ symbol: string; foreignNetQty: number | null; institutionNetQty: number | null; programNetQty: number | null; per: number | null; pbr: number | null; high52wDistance: number | null; warnings: string[] }>;
  };
};

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseNotificationSettings(input: unknown): NotificationSettingInput[] {
  const settings = (input as { settings?: unknown })?.settings;
  if (!Array.isArray(settings) || settings.length !== NOTIFICATION_CHANNELS.length) {
    throw new Error('Telegram과 Email 설정이 모두 필요합니다.');
  }
  const parsed = settings.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('알림 설정 형식이 올바르지 않습니다.');
    const value = item as Record<string, unknown>;
    if (!NOTIFICATION_CHANNELS.includes(value.channel as NotificationChannel)) throw new Error('지원하지 않는 알림 채널입니다.');
    if (typeof value.enabled !== 'boolean') throw new Error('알림 활성 상태가 올바르지 않습니다.');
    if (typeof value.sendTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.sendTime)) throw new Error('발송 시각은 HH:mm 형식이어야 합니다.');
    if (typeof value.timezone !== 'string' || !validTimezone(value.timezone)) throw new Error('시간대가 올바르지 않습니다.');
    return value as NotificationSettingInput;
  });
  if (new Set(parsed.map((item) => item.channel)).size !== NOTIFICATION_CHANNELS.length) throw new Error('알림 채널이 중복되었습니다.');
  return parsed;
}

export function notificationDue(now: Date, sendTime: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  const localTime = `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`;
  return { localDate: `${parts.year}-${parts.month}-${parts.day}`, due: localTime >= sendTime };
}

const number = (value: number | null, suffix = '') => value === null ? '—' : `${value.toFixed(1)}${suffix}`;
const signed = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export function telegramMessage(payload: NotificationPayload, reportUrl: string) {
  const markets = payload.metrics.slice(0, 4).map((item) => `${item.symbol.padEnd(8)} ${number(item.compositeScore)}`).join('\n');
  return [
    'DAILY MARKET SIGNAL', '',
    `Overall   ${number(payload.overallScore)}`,
    `Global    ${number(payload.globalScore)}`,
    `Korea     ${number(payload.koreaScore)}`, '',
    markets, '',
    `Up Probability   ${number(payload.upProbability, '%')}`,
    payload.expectedLow === null ? '' : `Expected Range   ${signed(payload.expectedLow)} ~ ${signed(payload.expectedHigh)}`,
    `Response   ${payload.responseLevel}`, '',
    payload.events[0] ? `Top Risk   ${payload.events[0].eventName} (Impact ${payload.events[0].expectedImpact})` : 'Top Risk   예정된 주요 이벤트 없음', '',
    `View Full Report\n${reportUrl}`,
  ].filter((line) => line !== '').join('\n');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function emailMessage(payload: NotificationPayload, reportUrl: string) {
  const money = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${(value / 100).toFixed(0)}억원`;
  const text = [telegramMessage(payload, reportUrl), '', 'WATCHLIST',
    ...payload.metrics.map((item) => `${item.symbol} ${number(item.compositeScore)} · ${signed(item.dailyReturn)}`), '',
    'NEWS', ...payload.news.map((item) => `${item.sentiment} · Impact ${item.impactScore} · ${item.title}`), '',
    'EVENTS', ...payload.events.map((item) => `Impact ${item.expectedImpact} · ${item.eventName} · ${item.scheduledAt}`),
  ].join('\n');
  const rows = payload.metrics.map((item) => `<tr><td><strong>${escapeHtml(item.symbol)}</strong><br>${escapeHtml(item.name)}</td><td>${number(item.price)}</td><td>${signed(item.dailyReturn)}</td><td>${number(item.trendScore)}</td><td>${number(item.momentumScore)}</td><td>${number(item.riskScore)}</td><td>${number(item.newsScore)}</td><td><strong>${number(item.compositeScore)}</strong></td></tr>`).join('');
  const news = payload.news.map((item) => `<li><strong>${escapeHtml(item.sentiment)}</strong> · Impact ${item.impactScore} · ${escapeHtml(item.title)}</li>`).join('') || '<li>주요 뉴스 없음</li>';
  const events = payload.events.map((item) => `<li>Impact ${item.expectedImpact} · ${escapeHtml(item.eventName)} · ${escapeHtml(item.scheduledAt)}</li>`).join('') || '<li>예정된 주요 이벤트 없음</li>';
  const kisMarkets = payload.kis?.markets.map((item) => `<tr><td><strong>${escapeHtml(item.symbol)}</strong></td><td>${item.breadthPercent?.toFixed(1) ?? '—'}%</td><td>${money(item.foreignNetAmount)}</td><td>${money(item.institutionNetAmount)}</td></tr>`).join('') ?? '';
  const kisDecision = payload.kis ? `<section style="padding:16px;border-radius:12px;background:#f1f5f9"><h2 style="margin-top:0">오늘의 판단 · ${escapeHtml(payload.kis.decision.title)}</h2>${payload.kis.decision.reasons.map((item) => `<p>• ${escapeHtml(item)}</p>`).join('')}<p><strong>확인할 것:</strong> ${escapeHtml(payload.kis.decision.nextChecks.join(' · '))}</p></section><h2>한국 수급 · 시장폭</h2><table style="border-collapse:collapse;width:100%"><thead><tr><th>시장</th><th>상승 비중</th><th>외국인</th><th>기관</th></tr></thead><tbody>${kisMarkets}</tbody></table>` : '';
  const html = `<main style="font-family:Arial,sans-serif;color:#172033;max-width:760px;margin:auto"><h1>Daily Market Intelligence · ${escapeHtml(payload.reportDate)}</h1><p>${escapeHtml(payload.summary)}</p>${kisDecision}<h2>Market Score</h2><p>Overall <strong>${number(payload.overallScore)}</strong> · Global ${number(payload.globalScore)} · Korea ${number(payload.koreaScore)}</p><h2>Next Session</h2><p>Up ${number(payload.upProbability, '%')} · Range ${signed(payload.expectedLow)} ~ ${signed(payload.expectedHigh)} · ${escapeHtml(payload.responseLevel)}</p><h2>Watchlist</h2><table style="border-collapse:collapse;width:100%"><thead><tr><th>Asset</th><th>Price</th><th>1D</th><th>Trend</th><th>Momentum</th><th>Risk</th><th>News</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table><h2>News</h2><ul>${news}</ul><h2>Upcoming Events</h2><ul>${events}</ul><p><a href="${escapeHtml(reportUrl)}">View full report</a></p></main>`;
  return { subject: `Market Intelligence · ${payload.reportDate}`, text, html };
}

export function telegramCommandMessage(command: string, payload: NotificationPayload, reportUrl: string) {
  const normalized = command.trim().split(/\s+/)[0].replace(/^\//, '').split('@')[0].toUpperCase();
  if (!normalized || normalized === 'START' || normalized === 'MARKET') return telegramMessage(payload, reportUrl);
  if (normalized === 'GLOBAL') return `Global Score   ${number(payload.globalScore)}\n${payload.summary}\n${reportUrl}`;
  if (normalized === 'KOREA') return `Korea Score   ${number(payload.koreaScore)}\n${payload.summary}\n${reportUrl}`;
  if (normalized === 'WATCH') return ['WATCHLIST', ...payload.metrics.map((item) => `${item.symbol}   ${number(item.compositeScore)} · ${signed(item.dailyReturn)}`)].join('\n');
  if (normalized === 'NEWS') return ['MARKET MOVING NEWS', ...payload.news.map((item) => `${item.sentiment} · Impact ${item.impactScore}\n${item.title}`)].join('\n');
  if (normalized === 'EVENTS') return ['UPCOMING EVENTS', ...payload.events.map((item) => `Impact ${item.expectedImpact} · ${item.eventName}`)].join('\n');
  const symbol = normalized === 'KOSPI' ? 'KOSPI' : normalized === 'NASDAQ' ? 'NASDAQ' : normalized;
  const metric = payload.metrics.find((item) => item.symbol.toUpperCase() === symbol);
  return metric
    ? `${metric.symbol} · ${metric.name}\nPrice ${number(metric.price)}\n1D ${signed(metric.dailyReturn)}\nScore ${number(metric.compositeScore)}\nTrend ${number(metric.trendScore)} · Momentum ${number(metric.momentumScore)} · Risk ${number(metric.riskScore)} · News ${number(metric.newsScore)}\n${reportUrl}`
    : `등록된 자산에서 ${symbol} 데이터를 찾지 못했습니다.\n/market /global /korea /watch /news /events`;
}
