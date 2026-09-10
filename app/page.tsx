'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChartNoAxesCombined, CheckCircle2,
  CircleGauge, Database, LayoutDashboard, Loader2, Newspaper, Pencil, Plus, Settings2,
  RefreshCw, Star, Trash2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ASSET_TYPES, type AssetInput, type AssetType } from '@/lib/asset';
import type { AnalyticsState } from '@/lib/analytics';
import { isCollectable, newsTickerFor } from '@/lib/catalog';
import { EVENT_STATUSES, EVENT_TYPES, type EconomicEventInput } from '@/lib/economic-event';
import { DEFAULT_WEIGHTS, type ScoreWeight } from '@/lib/scoring';
import { sparklinePoints } from '@/lib/sparkline';

type Asset = AssetInput & { id: number; createdAt: string; updatedAt: string };
type ProviderQuota = { limit: number; used: number; remaining: number; providerLimited: boolean };
type MarketSnapshot = {
  id: number; symbol: string; name: string; date: string | null; price: number | null;
  return1d: number | null; ma20: number | null; ma60: number | null; ma120: number | null; ma200: number | null;
  rsi14: number | null; atr14: number | null; relativeStrength: number | null;
  newsScore: number | null; compositeScore: number | null; scoreChange1d: number | null;
};
type AssetHistory = {
  date: string; open: number; high: number; low: number; close: number; volume: number | null; source: string;
  ma20: number | null; ma60: number | null; ma120: number | null; ma200: number | null;
  rsi14: number | null; relativeStrength: number | null; return1d: number | null;
};
type MarketScore = {
  date: string; overallScore: number; globalScore: number | null; koreaScore: number | null;
  overallChange: number | null; globalChange: number | null; koreaChange: number | null;
  marketRegime: string;
};
type ReportListItem = {
  id: number; reportDate: string; reportType: string; overallScore: number;
  globalScore: number | null; koreaScore: number | null; marketRegime: string;
  summary: string; metricCount: number; createdAt: string;
};
type ReportMetric = {
  assetId: number; symbol: string; name: string; price: number | null;
  dailyReturn: number | null; ma20: number | null; ma60: number | null;
  ma120: number | null; ma200: number | null; rsi: number | null;
  trendScore: number | null; momentumScore: number | null; riskScore: number | null;
  newsScore: number | null; compositeScore: number | null; scoreChange: number | null;
};
type ReportDetail = {
  report: ReportListItem & {
    upProbability: number | null; downProbability: number | null;
    expectedLow: number | null; expectedHigh: number | null;
    bullProbability: number | null; baseProbability: number | null;
    bearProbability: number | null; confidence: number | null;
  };
  metrics: ReportMetric[];
  forecasts: Array<{
    id: number; targetAssetId: number; symbol: string | null;
    upProbability: number; downProbability: number; expectedLow: number; expectedHigh: number;
    bullProbability: number; baseProbability: number; bearProbability: number; confidence: number;
    responseLevel: string; actualReturn: number | null; directionHit: number | null; rangeHit: number | null;
  }>;
  similarDays: Array<{
    targetAssetId: number; symbol: string | null; historicalDate: string;
    similarityScore: number; nextDayReturn: number;
  }>;
};
type NewsEvent = {
  id: number; title: string; summary: string; category: string; eventTime: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED'; impactScore: number;
  confidenceScore: number; durationType: string; isDuplicateGroup: boolean;
  sources: Array<{ source: string; sourceUrl: string; sourceRank: number }>;
  assets: Array<{ assetId: number; symbol: string; name: string; relevanceScore: number }>;
};
type NewsScore = {
  assetId: number; symbol: string; name: string; date: string; score: number;
  eventCount: number; divergence: string | null;
};
type NewsData = { events: NewsEvent[]; scores: NewsScore[] };
type EconomicEvent = EconomicEventInput & {
  id: number; createdAt: string; updatedAt: string;
  assets: Array<{ assetId: number; symbol: string; name: string }>;
};
type NotificationChannel = 'TELEGRAM' | 'EMAIL';
type NotificationSetting = {
  id: number; channel: NotificationChannel; enabled: boolean; sendTime: string;
  timezone: string; updatedAt: string;
};
type NotificationJob = {
  id: number; jobName: string; startedAt: string; finishedAt: string | null;
  status: string; errorMessage: string | null;
};
type NotificationState = {
  settings: NotificationSetting[];
  configured: Record<NotificationChannel, boolean>;
  jobs: NotificationJob[];
  deliveries: Array<{ id: number; channel: NotificationChannel; reportDate: string; status: string; errorMessage: string | null; sentAt: string | null }>;
};
type View = 'dashboard' | 'reports' | 'news' | 'calendar' | 'analytics' | 'watchlist' | 'admin';

const sampleScores = [
  { label: 'Overall Market', value: 72, change: '+4', tone: 'text-emerald-600', bar: 'bg-emerald-500' },
  { label: 'Global Risk', value: 75, change: '+2', tone: 'text-blue-600', bar: 'bg-blue-500' },
  { label: 'Korea Risk', value: 68, change: '-1', tone: 'text-amber-600', bar: 'bg-amber-500' },
];

const samplePulse = [
  { symbol: 'NASDAQ', value: '18,240.11', change: '+1.21%', score: 82, up: true },
  { symbol: 'KOSPI', value: '2,689.42', change: '+0.82%', score: 74, up: true },
  { symbol: 'VIX', value: '14.62', change: '-3.40%', score: 81, up: false },
  { symbol: 'US 10Y', value: '4.21%', change: '+4bp', score: 55, up: false },
];

const emptyForm: AssetInput = {
  symbol: '', name: '', assetType: 'STOCK', market: 'NASDAQ', currency: 'USD',
  benchmarkAssetId: null, groupId: null, enabled: true, importanceWeight: 1,
};

const emptyEventForm: EconomicEventInput = {
  eventName: '', eventType: 'CPI', country: 'US', scheduledAt: '', previousValue: null,
  consensusValue: null, actualValue: null, expectedImpact: 80, status: 'SCHEDULED',
  sourceUrl: null, affectedAssetIds: [],
};

const emptyNotifications: NotificationState = {
  settings: [], configured: { TELEGRAM: false, EMAIL: false }, jobs: [], deliveries: [],
};

function localDateTime(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

async function api<T>(url: string, options?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, {
    ...options,
    headers,
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? '요청을 처리하지 못했습니다.');
  return data;
}

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [market, setMarket] = useState<MarketSnapshot[]>([]);
  const [scores, setScores] = useState<MarketScore | null>(null);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [news, setNews] = useState<NewsData>({ events: [], scores: [] });
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationState>(emptyNotifications);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [weights, setWeights] = useState<ScoreWeight[]>(DEFAULT_WEIGHTS);
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminToken, setAdminToken] = useState(() => typeof location !== 'undefined' && location.hostname === 'localhost' ? 'local-dev-only' : '');
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetInput>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [collectingBatch, setCollectingBatch] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [collectingNewsId, setCollectingNewsId] = useState<number | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EconomicEvent | null>(null);
  const [eventForm, setEventForm] = useState<EconomicEventInput>(emptyEventForm);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<EconomicEvent | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const loadAssets = useCallback(async () => {
    const data = await api<{ assets: Asset[] }>('/api/assets');
    setAssets(data.assets);
  }, []);

  const loadDashboard = useCallback(async () => {
    const data = await api<{ market: MarketSnapshot[]; scores: MarketScore | null }>('/api/dashboard');
    setMarket(data.market);
    setScores(data.scores);
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const data = await api<{ reports: ReportListItem[] }>('/api/reports');
      setReports(data.reports);
      if (data.reports.length) {
        setReportDetail(await api<ReportDetail>(`/api/reports/${data.reports[0].id}`));
      } else {
        setReportDetail(null);
      }
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    try {
      setNews(await api<NewsData>('/api/news'));
    } finally {
      setLoadingNews(false);
    }
  }, []);

  const loadCalendar = useCallback(async () => {
    setLoadingCalendar(true);
    try {
      const data = await api<{ events: EconomicEvent[] }>('/api/calendar');
      setEconomicEvents(data.events);
    } finally {
      setLoadingCalendar(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      setAnalytics(await api<AnalyticsState>('/api/analytics'));
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  async function loadReport(id: number) {
    try {
      setReportDetail(await api<ReportDetail>(`/api/reports/${id}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '리포트를 불러오지 못했습니다.');
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ assets: Asset[] }>('/api/assets'),
      api<{ status: string }>('/api/health'),
      api<{ market: MarketSnapshot[]; scores: MarketScore | null }>('/api/dashboard'),
    ]).then(([assetData, health, dashboard]) => {
      if (!active) return;
      setAssets(assetData.assets);
      setMarket(dashboard.market);
      setScores(dashboard.scores);
      setDbReady(health.status === 'ok');
    }).catch((error: Error) => active && setMessage(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: {
      registerTool(tool: object, options?: { signal?: AbortSignal }): void | Promise<void>;
    } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'create_asset',
      title: '자산 등록',
      description: '관리자 화면과 같은 검증·API를 사용해 추적 자산을 등록합니다.',
      inputSchema: {
        type: 'object', additionalProperties: false,
        properties: {
          symbol: { type: 'string' }, name: { type: 'string' },
          assetType: { type: 'string', enum: ASSET_TYPES }, market: { type: 'string' },
          currency: { type: 'string' }, importanceWeight: { type: 'number', minimum: 0, maximum: 100 },
        },
        required: ['symbol', 'name', 'assetType', 'market', 'currency'],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        if (!adminToken) throw new Error('관리자 비밀번호를 먼저 입력하세요.');
        const asset = { ...emptyForm, ...(input as Partial<AssetInput>) };
        const data = await api<{ asset: Asset }>('/api/admin/assets', { method: 'POST', body: JSON.stringify(asset) }, adminToken);
        await loadAssets();
        return { id: data.asset.id, symbol: data.asset.symbol, status: 'created' };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [adminToken, loadAssets]);

  function openForm(asset?: Asset) {
    setEditing(asset ?? null);
    setForm(asset ? { ...asset } : { ...emptyForm });
    setMessage('');
    setFormOpen(true);
  }

  async function saveAsset(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api(editing ? `/api/admin/assets/${editing.id}` : '/api/admin/assets', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(form),
      }, adminToken);
      await loadAssets();
      setFormOpen(false);
      setMessage(editing ? '자산을 수정했습니다.' : '자산을 등록했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAsset() {
    if (!deleting) return;
    try {
      await api(`/api/admin/assets/${deleting.id}`, { method: 'DELETE' }, adminToken);
      await loadAssets();
      setMessage(`${deleting.symbol}을 삭제했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '삭제하지 못했습니다.');
    } finally {
      setDeleting(null);
    }
  }

  async function collectAsset(asset: Asset) {
    setCollectingId(asset.id);
    setMessage('');
    try {
      const data = await api<{ collection: { called: boolean; prices?: number; latestDate?: string | null; provider?: string; reason?: string }; quota: ProviderQuota }>(
        `/api/admin/collect/${asset.id}`, { method: 'POST' }, adminToken,
      );
      await loadDashboard();
      setMessage(data.collection.called
        ? `${asset.symbol} 일봉 ${data.collection.prices}개를 ${data.collection.provider ?? '공급자'}에서 수집했습니다. 최신 ${data.collection.latestDate ?? '—'} · Alpha 잔여 ${data.quota.remaining}/${data.quota.limit}회`
        : data.collection.reason === 'PROVIDER_LIMITED'
          ? 'Alpha Vantage가 실제 일일 한도 초과를 반환해 24시간 동안 추가 호출을 차단했습니다.'
          : data.collection.reason === 'QUOTA_EXHAUSTED'
          ? `최근 24시간 무료 호출 ${data.quota.limit}회를 모두 사용했습니다.`
          : `${asset.symbol}은 최근 수집되어 API를 호출하지 않았습니다. 잔여 ${data.quota.remaining}/${data.quota.limit}회`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '가격을 수집하지 못했습니다.');
    } finally {
      setCollectingId(null);
    }
  }

  async function bootstrapAssets() {
    setBootstrapping(true);
    setMessage('');
    try {
      const data = await api<{ bootstrap: { created: number; total: number }; assets: Asset[] }>(
        '/api/admin/bootstrap', { method: 'POST' }, adminToken,
      );
      setAssets(data.assets);
      setMessage(`기본 지표 ${data.bootstrap.created}개를 추가했습니다. 현재 ${data.bootstrap.total}개입니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '기본 지표를 등록하지 못했습니다.');
    } finally {
      setBootstrapping(false);
    }
  }

  async function collectBatch() {
    setCollectingBatch(true);
    setMessage('');
    try {
      const data = await api<{ batch: { calls: number; successful: number }; quota: ProviderQuota }>(
        '/api/admin/collect', { method: 'POST', body: JSON.stringify({ maxCalls: 5 }) }, adminToken,
      );
      await Promise.all([loadAssets(), loadDashboard()]);
      setMessage(data.quota.providerLimited && data.batch.successful === 0
        ? `우선순위 수집 ${data.batch.successful}/${data.batch.calls}개 성공 · Alpha Vantage는 24시간 차단 중이며 KIS 대상은 최근 수집 여부를 확인하세요.`
        : `우선순위 수집 ${data.batch.successful}/${data.batch.calls}개 성공 · Alpha 앱 기록 기준 최근 24시간 잔여 ${data.quota.remaining}/${data.quota.limit}회${data.quota.providerLimited ? ' (Alpha 차단 중, KIS 정상)' : ''}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '일괄 수집하지 못했습니다.');
    } finally {
      setCollectingBatch(false);
    }
  }

  async function collectNews(asset: Asset) {
    setCollectingNewsId(asset.id);
    setMessage('');
    try {
      const data = await api<{ collection: { called: boolean; fetched?: number; created?: number; score?: number; divergence?: string | null; reason?: string }; quota: ProviderQuota }>(
        `/api/admin/news/${asset.id}`, { method: 'POST' }, adminToken,
      );
      await Promise.all([loadNews(), loadDashboard()]);
      setMessage(data.collection.called
        ? `${asset.symbol} 뉴스 ${data.collection.fetched}건 확인 · 신규 Event ${data.collection.created}건 · News Score ${data.collection.score?.toFixed(1)} · 잔여 ${data.quota.remaining}/${data.quota.limit}회`
        : data.collection.reason === 'PROVIDER_LIMITED'
          ? 'Alpha Vantage가 실제 일일 한도 초과를 반환해 24시간 동안 추가 호출을 차단했습니다.'
          : data.collection.reason === 'QUOTA_EXHAUSTED'
          ? `최근 24시간 무료 호출 ${data.quota.limit}회를 모두 사용했습니다.`
          : `${asset.symbol} 뉴스는 오늘 이미 수집되어 API를 호출하지 않았습니다. 잔여 ${data.quota.remaining}/${data.quota.limit}회`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '뉴스를 수집하지 못했습니다.');
    } finally {
      setCollectingNewsId(null);
    }
  }

  async function loadWeights() {
    try {
      const data = await api<{ weights: ScoreWeight[] }>('/api/admin/weights', undefined, adminToken);
      setWeights(data.weights);
      setMessage('점수 가중치를 불러왔습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '가중치를 불러오지 못했습니다.');
    }
  }

  async function saveScoreWeights() {
    setSavingWeights(true);
    try {
      const data = await api<{ weights: ScoreWeight[] }>('/api/admin/weights', {
        method: 'PUT', body: JSON.stringify({ weights }),
      }, adminToken);
      setWeights(data.weights);
      await loadDashboard();
      setMessage('가중치를 저장하고 점수를 다시 계산했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '가중치를 저장하지 못했습니다.');
    } finally {
      setSavingWeights(false);
    }
  }

  async function generateReport() {
    setGeneratingReport(true);
    setMessage('');
    try {
      const data = await api<{ id: number; created: boolean; detail: ReportDetail }>(
        '/api/admin/reports', { method: 'POST' }, adminToken,
      );
      setReportDetail(data.detail);
      setMessage(data.created ? '오늘의 Daily Report를 생성했습니다.' : '오늘 리포트가 이미 있어 기존 Snapshot을 유지했습니다.');
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '리포트를 생성하지 못했습니다.');
    } finally {
      setGeneratingReport(false);
    }
  }

  async function loadNotifications() {
    try {
      setNotifications(await api<NotificationState>('/api/admin/notifications', undefined, adminToken));
      setMessage('알림 설정과 최근 작업 상태를 불러왔습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '알림 설정을 불러오지 못했습니다.');
    }
  }

  async function saveNotifications() {
    setSavingNotifications(true);
    try {
      const data = await api<NotificationState>('/api/admin/notifications', {
        method: 'PUT', body: JSON.stringify({ settings: notifications.settings }),
      }, adminToken);
      setNotifications(data);
      setMessage('알림 시각과 활성 상태를 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '알림 설정을 저장하지 못했습니다.');
    } finally {
      setSavingNotifications(false);
    }
  }

  async function sendNotificationsNow() {
    setSendingNotifications(true);
    try {
      const data = await api<{ results: Array<{ channel: NotificationChannel; status: string; error?: string }> }>(
        '/api/admin/notifications/send', { method: 'POST' }, adminToken,
      );
      await loadNotifications();
      setMessage(data.results.length ? data.results.map((item) => `${item.channel}: ${item.status}${item.error ? ` (${item.error})` : ''}`).join(' · ') : '활성화된 알림 채널이 없습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '알림을 발송하지 못했습니다.');
    } finally {
      setSendingNotifications(false);
    }
  }

  function openEventForm(event?: EconomicEvent) {
    setEditingEvent(event ?? null);
    setEventForm(event ? {
      ...event,
      scheduledAt: localDateTime(event.scheduledAt),
      affectedAssetIds: event.assets.map((asset) => asset.assetId),
    } : { ...emptyEventForm });
    setMessage('');
    setEventFormOpen(true);
  }

  async function saveEconomicEvent(submitEvent: React.SyntheticEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setSavingEvent(true);
    setMessage('');
    try {
      const payload = { ...eventForm, scheduledAt: new Date(eventForm.scheduledAt).toISOString() };
      await api(editingEvent ? `/api/admin/calendar/${editingEvent.id}` : '/api/admin/calendar', {
        method: editingEvent ? 'PUT' : 'POST', body: JSON.stringify(payload),
      }, adminToken);
      await loadCalendar();
      setEventFormOpen(false);
      setMessage(editingEvent ? '경제 이벤트를 수정했습니다.' : '경제 이벤트를 등록했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '경제 이벤트를 저장하지 못했습니다.');
    } finally {
      setSavingEvent(false);
    }
  }

  async function removeEconomicEvent() {
    if (!deletingEvent) return;
    try {
      await api(`/api/admin/calendar/${deletingEvent.id}`, { method: 'DELETE' }, adminToken);
      await loadCalendar();
      setMessage('경제 이벤트를 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '경제 이벤트를 삭제하지 못했습니다.');
    } finally {
      setDeletingEvent(null);
    }
  }

  function selectView(target: View) {
    setView(target);
    if (target === 'reports') void Promise.all([loadReports(), loadCalendar()]).catch((error: Error) => setMessage(error.message));
    if (target === 'news') void loadNews().catch((error: Error) => setMessage(error.message));
    if (target === 'calendar') void loadCalendar().catch((error: Error) => setMessage(error.message));
    if (target === 'analytics') void loadAnalytics().catch((error: Error) => setMessage(error.message));
    if (target === 'admin' && adminToken) void loadNotifications();
  }

  const nav = [
    { label: 'Dashboard', icon: LayoutDashboard, target: 'dashboard' as const },
    { label: 'Reports', icon: Newspaper, target: 'reports' as const },
    { label: 'News', icon: Bell, target: 'news' as const },
    { label: 'Calendar', icon: CalendarDays, target: 'calendar' as const },
    { label: 'Analytics', icon: ChartNoAxesCombined, target: 'analytics' as const },
    { label: 'Watchlist', icon: Star, target: 'watchlist' as const },
    { label: 'Admin', icon: Settings2, target: 'admin' as const },
  ];

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-screen bg-sidebar px-5 py-7 text-sidebar-foreground lg:flex lg:flex-col">
        <Brand />
        <nav aria-label="주 메뉴" className="mt-10 space-y-1">
          {nav.map(({ label, icon: Icon, target }) => (
            <button key={label} type="button" disabled={!target} onClick={() => target && selectView(target)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${view === target ? 'bg-sidebar-accent text-white' : 'text-slate-400 hover:bg-sidebar-accent hover:text-white'}`}>
              <Icon className="size-4" />{label}{!target && <span className="ml-auto text-[11px]">준비 중</span>}
            </button>
          ))}
        </nav>
        <Status dbReady={dbReady} />
      </aside>

      <section className="min-w-0">
        <header className="flex min-h-20 items-center justify-between border-b bg-white/70 px-5 py-3 backdrop-blur-xl sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Market intelligence</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{view === 'dashboard' ? '오늘의 시장 환경' : view === 'reports' ? 'Daily Reports' : view === 'news' ? 'Market Moving News' : view === 'calendar' ? 'Economic Calendar' : view === 'analytics' ? 'Model Analytics' : view === 'watchlist' ? 'Watchlist' : '운영 관리'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:inline">Phase 12</span>
            <button aria-label="알림" className="grid size-10 place-items-center rounded-xl border bg-white text-muted-foreground shadow-sm" type="button"><Bell className="size-4" /></button>
          </div>
        </header>

        <nav aria-label="모바일 주 메뉴" className="flex gap-2 overflow-x-auto border-b bg-white px-4 py-3 lg:hidden">
          {nav.map(({ label, icon: Icon, target }) => (
            <button key={label} type="button" disabled={!target} onClick={() => target && selectView(target)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 ${view === target ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </nav>

        <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
          {message && <output className="mb-5 block rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</output>}
          {view === 'dashboard'
            ? <Dashboard assets={assets} market={market} scores={scores} loading={loading} />
            : view === 'reports'
              ? <Reports reports={reports} detail={reportDetail} events={economicEvents} loading={loadingReports} onSelect={loadReport} />
              : view === 'news'
                ? <News news={news} loading={loadingNews} />
                : view === 'calendar'
                  ? <EconomicCalendar events={economicEvents} loading={loadingCalendar} canManage={Boolean(adminToken)} onAdd={() => openEventForm()} onEdit={openEventForm} onDelete={setDeletingEvent} />
                  : view === 'analytics'
                    ? <Analytics data={analytics} loading={loadingAnalytics} />
                    : view === 'watchlist'
                      ? <Watchlist assets={assets} market={market} loading={loading} />
                      : <Admin assets={assets} loading={loading} token={adminToken} collectingId={collectingId} collectingNewsId={collectingNewsId} bootstrapping={bootstrapping} collectingBatch={collectingBatch} weights={weights} savingWeights={savingWeights} generatingReport={generatingReport} notifications={notifications} savingNotifications={savingNotifications} sendingNotifications={sendingNotifications} onToken={(value) => setAdminToken(value)} onAdd={() => openForm()} onBootstrap={bootstrapAssets} onCollectBatch={collectBatch} onCollect={collectAsset} onCollectNews={collectNews} onEdit={(asset) => openForm(asset)} onDelete={(asset) => setDeleting(asset)} onWeights={setWeights} onLoadWeights={loadWeights} onSaveWeights={saveScoreWeights} onGenerateReport={generateReport} onNotifications={setNotifications} onLoadNotifications={loadNotifications} onSaveNotifications={saveNotifications} onSendNotifications={sendNotificationsNow} />}
        </div>
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={saveAsset}>
            <DialogHeader>
              <DialogTitle>{editing ? '자산 수정' : '자산 등록'}</DialogTitle>
              <DialogDescription>시세 수집과 점수 계산에 사용할 기본 정보를 입력하세요.</DialogDescription>
            </DialogHeader>
            <AssetForm value={form} onChange={(value) => setForm(value)} />
            {message && <p className="mt-3 text-sm text-rose-600">{message}</p>}
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
              <Button type="submit" disabled={saving || !adminToken}>{saving && <Loader2 className="animate-spin" />}{editing ? '변경 저장' : '자산 등록'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={eventFormOpen} onOpenChange={setEventFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={saveEconomicEvent}>
            <DialogHeader>
              <DialogTitle>{editingEvent ? '경제 이벤트 수정' : '경제 이벤트 등록'}</DialogTitle>
              <DialogDescription>공식 발표 시각과 시장 영향도를 입력하세요.</DialogDescription>
            </DialogHeader>
            <EconomicEventForm value={eventForm} assets={assets} onChange={setEventForm} />
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setEventFormOpen(false)}>취소</Button>
              <Button type="submit" disabled={savingEvent || !adminToken}>{savingEvent && <Loader2 className="animate-spin" />}{editingEvent ? '변경 저장' : '일정 등록'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting?.symbol}을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>이 자산은 추적 목록에서 영구 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={removeAsset}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingEvent)} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deletingEvent?.eventName}을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>캘린더에서 영구 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={removeEconomicEvent}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Brand() {
  return <div className="flex items-center gap-3 px-2"><span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ChartNoAxesCombined className="size-5" /></span><div><p className="font-semibold tracking-tight">Market Intel</p><p className="text-xs text-slate-400">Signal desk</p></div></div>;
}

function Status({ dbReady }: { dbReady: boolean }) {
  return <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-sm font-medium"><span className={`size-2 rounded-full ${dbReady ? 'bg-emerald-400 shadow-[0_0_12px_theme(colors.emerald.400)]' : 'bg-amber-400'}`} />{dbReady ? 'D1 연결됨' : 'D1 확인 중'}</div><p className="mt-2 text-xs leading-5 text-slate-400">Cloudflare Free · Phase 12</p></div>;
}

function Dashboard({ assets, market, scores, loading }: { assets: Asset[]; market: MarketSnapshot[]; scores: MarketScore | null; loading: boolean }) {
  const enabled = assets.filter((asset) => asset.enabled).length;
  const live = market.filter((item) => item.price !== null);
  const scoreCards = scores ? [
    { label: 'Overall Market', value: scores.overallScore, change: scores.overallChange, tone: 'text-emerald-600', bar: 'bg-emerald-500' },
    { label: 'Global Risk', value: scores.globalScore, change: scores.globalChange, tone: 'text-blue-600', bar: 'bg-blue-500' },
    { label: 'Korea Risk', value: scores.koreaScore, change: scores.koreaChange, tone: 'text-amber-600', bar: 'bg-amber-500' },
  ] : sampleScores.map((score) => ({ ...score, change: Number(score.change), sample: true }));
  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-3" aria-label="시장 점수">
      {scoreCards.map((score) => <article key={score.label} className="overflow-hidden rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{score.label}</p><div className="mt-2 flex items-baseline gap-2"><strong className="text-4xl font-semibold tracking-[-0.05em]">{score.value === null ? '—' : score.value.toFixed(0)}</strong><span className={`text-sm font-semibold ${score.tone}`}>{score.change === null ? '' : `${score.change > 0 ? '+' : ''}${score.change.toFixed(1)}`}</span></div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{'sample' in score ? '예시' : scores?.marketRegime}</span></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${score.bar}`} style={{ width: `${score.value ?? 0}%` }} /></div></article>)}
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
      <article className="rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)] sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Market Pulse</p><p className="mt-1 text-sm text-muted-foreground">{live.length ? `최근 일봉 기준 · ${live[0].date}` : 'Admin에서 가격 수집을 실행하면 실제 데이터로 전환됩니다.'}</p></div><span className="text-xs font-medium text-muted-foreground">{live.length ? 'Live' : 'Sample'}</span></div><div className="mt-5 overflow-x-auto">{live.length ? <table className="w-full min-w-[700px] text-sm"><thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">자산</th><th className="pb-3 font-medium">종가</th><th className="pb-3 font-medium">1일</th><th className="pb-3 font-medium">MA20</th><th className="pb-3 font-medium">RSI14</th><th className="pb-3 font-medium">상대강도</th><th className="pb-3 text-right font-medium">Score</th></tr></thead><tbody className="divide-y">{live.map((item) => <tr key={item.id}><td className="py-4"><p className="font-semibold">{item.symbol}</p><p className="text-xs text-muted-foreground">{item.name}</p></td><td className="py-4 tabular-nums">{item.price?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td><td className={`py-4 font-semibold tabular-nums ${(item.return1d ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.return1d === null ? '—' : `${item.return1d > 0 ? '+' : ''}${item.return1d.toFixed(2)}%`}</td><td className="py-4 tabular-nums text-muted-foreground">{item.ma20?.toFixed(2) ?? '—'}</td><td className="py-4 tabular-nums text-muted-foreground">{item.rsi14?.toFixed(1) ?? '—'}</td><td className="py-4 tabular-nums">{item.relativeStrength === null ? '—' : `${item.relativeStrength > 0 ? '+' : ''}${item.relativeStrength.toFixed(2)}%`}</td><td className="py-4 text-right"><span className="inline-flex min-w-11 justify-center rounded-lg bg-slate-100 px-2 py-1 font-semibold tabular-nums">{item.compositeScore?.toFixed(0) ?? '—'}</span></td></tr>)}</tbody></table> : <table className="w-full min-w-[560px] text-sm"><thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">지표</th><th className="pb-3 font-medium">현재</th><th className="pb-3 font-medium">변화</th><th className="pb-3 text-right font-medium">Score</th></tr></thead><tbody className="divide-y">{samplePulse.map((item) => <tr key={item.symbol}><td className="py-4 font-semibold">{item.symbol}</td><td className="py-4 tabular-nums text-muted-foreground">{item.value}</td><td className={`py-4 font-semibold tabular-nums ${item.up ? 'text-emerald-600' : 'text-rose-600'}`}><span className="inline-flex items-center gap-1">{item.up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}{item.change}</span></td><td className="py-4 text-right"><span className="inline-flex min-w-10 justify-center rounded-lg bg-slate-100 px-2 py-1 font-semibold tabular-nums">{item.score}</span></td></tr>)}</tbody></table>}</div></article>
      <article className="relative overflow-hidden rounded-2xl bg-[#10243d] p-6 text-white shadow-[0_18px_50px_rgb(16_36_61/18%)]"><div className="absolute -right-16 -top-16 size-56 rounded-full bg-blue-400/15 blur-2xl" /><CircleGauge className="size-7 text-emerald-300" /><p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Collection status</p><h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">추적 자산 {loading ? '—' : assets.length}개<br />가격 연결 {loading ? '—' : live.length}개</h2><p className="mt-4 text-sm leading-6 text-slate-300">활성 자산 {loading ? '—' : enabled}개를 관리 중입니다. Admin에서 자산별 일봉 수집을 실행할 수 있습니다.</p></article>
    </section>
    <section className="rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)] sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><ChartNoAxesCombined className="size-5" /></span><div><h2 className="font-semibold">Phase 9 Analytics</h2><p className="text-sm text-muted-foreground">예측 결과가 쌓이면 방향·범위 적중률과 시장 구간별 성과를 자동 집계합니다.</p></div></div></section>
  </div>;
}

function Watchlist({ assets, market, loading }: { assets: Asset[]; market: MarketSnapshot[]; loading: boolean }) {
  const watchAssets = assets.filter((asset) => asset.enabled && (
    asset.assetType === 'STOCK' || asset.assetType === 'ETF' || ['NASDAQ100', 'SOX'].includes(asset.symbol)
  ));
  const rows = watchAssets.map((asset) => ({ asset, snapshot: market.find((item) => item.id === asset.id) ?? null }));
  const firstId = rows.find((item) => item.snapshot?.price !== null)?.asset.id ?? rows[0]?.asset.id ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [historyState, setHistoryState] = useState<{ assetId: number | null; rows: AssetHistory[]; error: string }>({ assetId: null, rows: [], error: '' });
  const effectiveId = selectedId ?? firstId;
  const selected = rows.find((item) => item.asset.id === effectiveId) ?? null;
  const history = historyState.assetId === effectiveId ? historyState.rows : [];
  const historyLoading = effectiveId !== null && historyState.assetId !== effectiveId;
  const historyError = historyState.assetId === effectiveId ? historyState.error : '';

  useEffect(() => {
    if (!effectiveId) return;
    let active = true;
    api<{ history: AssetHistory[] }>(`/api/assets/${effectiveId}/history?limit=120`)
      .then((data) => active && setHistoryState({ assetId: effectiveId, rows: data.history, error: '' }))
      .catch((error: Error) => active && setHistoryState({ assetId: effectiveId, rows: [], error: error.message }));
    return () => { active = false; };
  }, [effectiveId]);

  if (loading) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!rows.length) return <section className="grid min-h-80 place-items-center rounded-2xl border bg-card p-8 text-center"><div><Star className="mx-auto size-10 text-slate-300" /><h2 className="mt-4 font-semibold">추적 중인 종목이 없습니다.</h2><p className="mt-2 text-sm text-muted-foreground">Admin에서 주식 또는 ETF 자산을 활성화하세요.</p></div></section>;

  const snapshot = selected?.snapshot;
  const chartRows = history.slice(0, 60).reverse();
  const points = sparklinePoints(chartRows.map((item) => item.close));
  const number = (value: number | null | undefined, digits = 2) => value === null || value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
  const percent = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

  return <div className="space-y-6">
    <section>
      <div className="mb-4"><h2 className="font-semibold">관심 종목</h2><p className="mt-1 text-sm text-muted-foreground">활성 주식·ETF와 주요 ETF 프록시 {rows.length}개를 추적합니다.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(({ asset, snapshot: item }) => <button key={asset.id} type="button" onClick={() => setSelectedId(asset.id)} className={`rounded-2xl border bg-card p-5 text-left shadow-[0_10px_30px_rgb(30_58_95/5%)] transition hover:-translate-y-0.5 hover:border-blue-300 ${effectiveId === asset.id ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
        <div className="flex items-start justify-between gap-3"><div><strong>{asset.name}</strong><p className="mt-1 text-xs text-muted-foreground">{asset.symbol} · {asset.market}</p></div><Star className={`size-4 ${(item?.price ?? null) !== null ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></div>
        <div className="mt-5 flex items-end justify-between"><strong className="text-2xl tabular-nums">{number(item?.price, 4)}</strong><span className={`text-sm font-semibold tabular-nums ${(item?.return1d ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{percent(item?.return1d)}</span></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><span className="rounded-lg bg-slate-50 p-2">Score <strong className="block text-sm">{number(item?.compositeScore, 0)}</strong></span><span className="rounded-lg bg-slate-50 p-2">MA20 <strong className="block text-sm">{number(item?.ma20)}</strong></span><span className="rounded-lg bg-slate-50 p-2">RSI <strong className="block text-sm">{number(item?.rsi14, 1)}</strong></span></div>
      </button>)}</div>
    </section>

    {selected && <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_10px_30px_rgb(30_58_95/5%)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Asset detail</p><h2 className="mt-2 text-2xl font-semibold">{selected.asset.name}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.asset.symbol} · {selected.asset.market} · {selected.asset.currency}{snapshot?.date && ` · ${snapshot.date}`}</p></div><div className="text-right"><strong className="block text-3xl tabular-nums">{number(snapshot?.price, 4)}</strong><span className={`text-sm font-semibold ${(snapshot?.return1d ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{percent(snapshot?.return1d)}</span></div></div>
      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1.3fr_1fr]">
        <div><div className="flex items-center justify-between"><h3 className="font-semibold">최근 60거래일</h3><span className="text-xs text-muted-foreground">{history[0]?.source ?? '데이터 미연결'}</span></div>
          <div className="mt-4 grid h-64 place-items-center rounded-xl bg-slate-950 p-4">{historyLoading ? <Loader2 className="size-5 animate-spin text-slate-400" /> : points ? <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true"><polyline points={points} fill="none" stroke="rgb(52 211 153)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" /></svg> : <p className="text-sm text-slate-400">가격 수집 후 차트가 표시됩니다.</p>}</div>
          {historyError && <p className="mt-2 text-sm text-rose-600">{historyError}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 content-start">{[
          ['Score', snapshot?.compositeScore, 0], ['Score Change', snapshot?.scoreChange1d, 1],
          ['MA20', snapshot?.ma20, 2], ['MA60', snapshot?.ma60, 2], ['MA120', snapshot?.ma120, 2], ['MA200', snapshot?.ma200, 2],
          ['RSI14', snapshot?.rsi14, 1], ['Relative Strength', snapshot?.relativeStrength, 2], ['News Score', snapshot?.newsScore, 0],
        ].map(([label, value, digits]) => <div key={String(label)} className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-1 block tabular-nums">{number(value as number | null | undefined, digits as number)}</strong></div>)}</div>
      </div>
      {history.length > 0 && <div className="overflow-x-auto border-t"><Table><TableHeader><TableRow><TableHead>날짜</TableHead><TableHead>종가</TableHead><TableHead>1일</TableHead><TableHead>MA20</TableHead><TableHead>RSI14</TableHead><TableHead>거래량</TableHead></TableRow></TableHeader><TableBody>{history.slice(0, 10).map((item) => <TableRow key={item.date}><TableCell>{item.date}</TableCell><TableCell>{number(item.close, 4)}</TableCell><TableCell className={(item.return1d ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{percent(item.return1d)}</TableCell><TableCell>{number(item.ma20)}</TableCell><TableCell>{number(item.rsi14, 1)}</TableCell><TableCell>{number(item.volume, 0)}</TableCell></TableRow>)}</TableBody></Table></div>}
    </section>}
  </div>;
}

function Analytics({ data, loading }: { data: AnalyticsState | null; loading: boolean }) {
  if (loading && !data) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.total) return <section className="grid min-h-80 place-items-center rounded-2xl border bg-card p-8 text-center"><div><ChartNoAxesCombined className="mx-auto size-10 text-slate-300" /><h2 className="mt-4 font-semibold">평가된 Forecast가 아직 없습니다.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Daily Report 이후 다음 거래일 가격을 수집하면 Direction Accuracy와 Range Hit Rate가 자동으로 채워집니다.</p></div></section>;
  const percent = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;
  const performance = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[['30D Direction Accuracy', percent(data.direction30.accuracy), `${data.direction30.count}건`], ['90D Direction Accuracy', percent(data.direction90.accuracy), `${data.direction90.count}건`], ['Expected Range Hit Rate', percent(data.rangeHitRate), `${data.total}건`], ['Evaluated Forecasts', data.total.toLocaleString(), `기준 ${data.asOf}`]].map(([label, value, note]) => <article key={label} className="rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)]"><p className="text-sm font-medium text-muted-foreground">{label}</p><strong className="mt-3 block text-3xl tracking-tight">{value}</strong><p className="mt-2 text-xs text-muted-foreground">{note}</p></article>)}
    </section>
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border bg-emerald-50/60 p-5"><p className="text-sm font-semibold text-emerald-800">Risk-On Next Day</p><strong className="mt-2 block text-3xl text-emerald-700">{performance(data.riskOn.averageReturn)}</strong><p className="mt-2 text-xs text-emerald-700/70">평가 {data.riskOn.count}건 평균</p></article>
      <article className="rounded-2xl border bg-rose-50/60 p-5"><p className="text-sm font-semibold text-rose-800">Risk-Off Next Day</p><strong className="mt-2 block text-3xl text-rose-700">{performance(data.riskOff.averageReturn)}</strong><p className="mt-2 text-xs text-rose-700/70">평가 {data.riskOff.count}건 평균</p></article>
    </section>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="border-b px-5 py-4"><h2 className="font-semibold">Score Performance</h2><p className="mt-1 text-sm text-muted-foreground">발행 시점 Composite Score 구간별 다음 거래일 결과입니다.</p></div><Table><TableHeader><TableRow><TableHead>Score 구간</TableHead><TableHead>표본</TableHead><TableHead>평균 수익률</TableHead><TableHead>방향 적중률</TableHead></TableRow></TableHeader><TableBody>{data.scorePerformance.map((bucket) => <TableRow key={bucket.label}><TableCell><span className="font-semibold">{bucket.label}</span><span className="ml-2 text-xs text-muted-foreground">{bucket.min}–{bucket.max}</span></TableCell><TableCell>{bucket.count}</TableCell><TableCell>{performance(bucket.averageReturn)}</TableCell><TableCell>{percent(bucket.directionAccuracy)}</TableCell></TableRow>)}</TableBody></Table></section>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="border-b px-5 py-4"><h2 className="font-semibold">Recent Forecast Results</h2><p className="mt-1 text-sm text-muted-foreground">최근 평가 결과 20건</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Report</TableHead><TableHead>자산</TableHead><TableHead>Up 확률</TableHead><TableHead>예상 범위</TableHead><TableHead>실제</TableHead><TableHead>방향</TableHead><TableHead>범위</TableHead></TableRow></TableHeader><TableBody>{data.recentResults.map((result, index) => <TableRow key={`${result.reportDate}-${result.symbol}-${index}`}><TableCell>{result.reportDate}</TableCell><TableCell className="font-semibold">{result.symbol ?? '—'}</TableCell><TableCell>{percent(result.upProbability)}</TableCell><TableCell>{performance(result.expectedLow)} ~ {performance(result.expectedHigh)}</TableCell><TableCell className={result.actualReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{performance(result.actualReturn)}</TableCell><TableCell>{result.directionHit ? 'HIT' : 'MISS'}</TableCell><TableCell>{result.rangeHit ? 'HIT' : 'MISS'}</TableCell></TableRow>)}</TableBody></Table></div></section>
  </div>;
}

function Reports({ reports, detail, events, loading, onSelect }: { reports: ReportListItem[]; detail: ReportDetail | null; events: EconomicEvent[]; loading: boolean; onSelect: (id: number) => void }) {
  if (loading && reports.length === 0) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (reports.length === 0) return <section className="grid min-h-80 place-items-center rounded-2xl border bg-card p-8 text-center"><div><Newspaper className="mx-auto size-9 text-slate-300" /><h2 className="mt-4 font-semibold">아직 발행된 리포트가 없습니다.</h2><p className="mt-2 text-sm text-muted-foreground">가격 수집 후 Admin에서 Daily Report를 생성하세요.</p></div></section>;
  return <div className="grid gap-6 xl:grid-cols-[330px_1fr]">
    <aside className="overflow-hidden rounded-2xl border bg-card shadow-[0_10px_30px_rgb(30_58_95/5%)]">
      <div className="border-b px-5 py-4"><h2 className="font-semibold">발행 이력</h2><p className="mt-1 text-sm text-muted-foreground">Snapshot {reports.length}건</p></div>
      <div className="divide-y">{reports.map((report) => <button key={report.id} type="button" aria-label={`${report.reportDate} 리포트 보기`} onClick={() => onSelect(report.id)} className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${detail?.report.id === report.id ? 'bg-blue-50' : ''}`}><div className="flex items-center justify-between gap-3"><strong>{report.reportDate}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{report.marketRegime}</span></div><div className="mt-2 flex items-center justify-between text-sm text-muted-foreground"><span>Overall {report.overallScore.toFixed(0)}</span><span>{report.metricCount} assets</span></div></button>)}</div>
    </aside>
    {detail && <article className="rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Daily Market Intelligence</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{detail.report.reportDate}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{detail.report.summary}</p></div><span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">{detail.report.marketRegime}</span></div>
      <section className="grid gap-3 py-6 sm:grid-cols-3" aria-label="리포트 시장 점수">{[
        ['Overall', detail.report.overallScore], ['Global', detail.report.globalScore], ['Korea', detail.report.koreaScore],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-1 block text-2xl tabular-nums">{typeof value === 'number' ? value.toFixed(1) : '—'}</strong></div>)}</section>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>자산</TableHead><TableHead>종가</TableHead><TableHead>1일</TableHead><TableHead>MA20</TableHead><TableHead>RSI</TableHead><TableHead className="text-right">Score</TableHead></TableRow></TableHeader><TableBody>{detail.metrics.map((metric) => <TableRow key={metric.assetId}><TableCell><p className="font-semibold">{metric.symbol}</p><p className="text-xs text-muted-foreground">{metric.name}</p></TableCell><TableCell>{metric.price?.toLocaleString() ?? '—'}</TableCell><TableCell className={(metric.dailyReturn ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{metric.dailyReturn === null ? '—' : `${metric.dailyReturn > 0 ? '+' : ''}${metric.dailyReturn.toFixed(2)}%`}</TableCell><TableCell>{metric.ma20?.toFixed(2) ?? '—'}</TableCell><TableCell>{metric.rsi?.toFixed(1) ?? '—'}</TableCell><TableCell className="text-right font-semibold">{metric.compositeScore?.toFixed(0) ?? '—'}</TableCell></TableRow>)}</TableBody></Table></div>
      <section className="mt-6"><h3 className="font-semibold">다음 거래일 전망</h3>{detail.forecasts.length ? <div className="mt-3 grid gap-4 lg:grid-cols-2">{detail.forecasts.map((forecast) => <article key={forecast.id} className="rounded-xl bg-[#10243d] p-5 text-white"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-300">{forecast.symbol} · {forecast.responseLevel}</p><strong className="mt-2 block text-3xl tabular-nums">상승 {forecast.upProbability.toFixed(1)}%</strong><p className="mt-1 text-sm text-slate-300">하락 {forecast.downProbability.toFixed(1)}% · 신뢰도 {forecast.confidence.toFixed(1)}</p></div><ChartNoAxesCombined className="size-6 text-emerald-300" /></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-white/10 p-3"><span className="text-slate-300">예상 범위</span><strong className="mt-1 block tabular-nums">{forecast.expectedLow > 0 ? '+' : ''}{forecast.expectedLow.toFixed(2)}% ~ {forecast.expectedHigh > 0 ? '+' : ''}{forecast.expectedHigh.toFixed(2)}%</strong></div><div className="rounded-lg bg-white/10 p-3"><span className="text-slate-300">Bull / Base / Bear</span><strong className="mt-1 block tabular-nums">{forecast.bullProbability.toFixed(0)} / {forecast.baseProbability.toFixed(0)} / {forecast.bearProbability.toFixed(0)}</strong></div></div>{forecast.actualReturn !== null && <p className="mt-4 text-sm text-slate-300">실제 {forecast.actualReturn > 0 ? '+' : ''}{forecast.actualReturn.toFixed(2)}% · 방향 {forecast.directionHit ? '적중' : '미적중'} · 범위 {forecast.rangeHit ? '적중' : '미적중'}</p>}</article>)}</div> : <p className="mt-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">비교 가능한 과거 데이터가 5일 이상 쌓이면 Forecast가 생성됩니다.</p>}</section>
      {detail.similarDays.length > 0 && <section className="mt-6"><div className="flex items-end justify-between gap-3"><div><h3 className="font-semibold">가장 유사한 과거 환경</h3><p className="mt-1 text-sm text-muted-foreground">상위 5개 유사일과 실제 다음 거래일 수익률입니다.</p></div><span className="text-sm text-muted-foreground">표본 {detail.similarDays.length}일</span></div><div className="mt-3 overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>자산</TableHead><TableHead>과거 날짜</TableHead><TableHead>유사도</TableHead><TableHead className="text-right">다음날</TableHead></TableRow></TableHeader><TableBody>{detail.similarDays.slice(0, 5).map((day) => <TableRow key={`${day.targetAssetId}-${day.historicalDate}`}><TableCell className="font-semibold">{day.symbol}</TableCell><TableCell>{day.historicalDate}</TableCell><TableCell>{day.similarityScore.toFixed(1)}</TableCell><TableCell className={`text-right font-semibold ${day.nextDayReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{day.nextDayReturn > 0 ? '+' : ''}{day.nextDayReturn.toFixed(2)}%</TableCell></TableRow>)}</TableBody></Table></div></section>}
      <section className="mt-4 rounded-xl bg-slate-50 p-4"><h3 className="font-semibold">다가오는 주요 이벤트</h3><div className="mt-3 space-y-2">{events.filter((event) => event.status === 'SCHEDULED' && new Date(event.scheduledAt) >= new Date()).slice(0, 3).map((event) => <div key={event.id} className="flex items-center justify-between gap-3 text-sm"><span><strong>{event.eventName}</strong><span className="ml-2 text-muted-foreground">{new Date(event.scheduledAt).toLocaleString('ko-KR')}</span></span><span className="font-semibold text-blue-700">Impact {event.expectedImpact}</span></div>)}{!events.some((event) => event.status === 'SCHEDULED' && new Date(event.scheduledAt) >= new Date()) && <p className="text-sm text-muted-foreground">등록된 예정 이벤트가 없습니다.</p>}</div></section>
    </article>}
  </div>;
}

function News({ news, loading }: { news: NewsData; loading: boolean }) {
  if (loading && news.events.length === 0) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {news.scores.map((item) => <article key={item.assetId} className="rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.symbol}</p><p className="text-xs text-muted-foreground">{item.name} · {item.eventCount} events</p></div><strong className={`text-2xl tabular-nums ${item.score >= 60 ? 'text-emerald-600' : item.score <= 40 ? 'text-rose-600' : ''}`}>{item.score.toFixed(1)}</strong></div>{item.divergence && <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"><AlertTriangle className="size-4" />{item.divergence === 'PRICE_UP_NEWS_NEGATIVE' ? '악재에도 가격이 상승 중' : '호재에도 가격이 하락 중'}</p>}</article>)}
      {!news.scores.length && <article className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground sm:col-span-2">Admin에서 자산별 뉴스 수집을 실행하면 News Score가 생성됩니다.</article>}
    </section>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="border-b px-5 py-4"><h2 className="font-semibold">News Events</h2><p className="mt-1 text-sm text-muted-foreground">동일 사건의 여러 보도는 하나의 Event와 출처 목록으로 묶습니다.</p></div><div className="divide-y">{news.events.map((event) => <article key={event.id} className="p-5"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{event.category}</span><span className={`rounded-full px-2 py-1 font-semibold ${event.sentiment === 'POSITIVE' ? 'bg-emerald-50 text-emerald-700' : event.sentiment === 'NEGATIVE' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{event.sentiment}</span><span className="text-muted-foreground">Impact {event.impactScore.toFixed(0)} · Confidence {event.confidenceScore.toFixed(0)} · {event.durationType}</span></div><h3 className="mt-3 font-semibold leading-6">{event.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{event.summary}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>{new Date(event.eventTime).toLocaleString('ko-KR')}</span><span>{event.assets.map((asset) => asset.symbol).join(', ')}</span>{event.sources.map((source) => <a key={source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">{source.source}</a>)}</div></article>)}{!news.events.length && <div className="grid min-h-56 place-items-center p-8 text-center text-sm text-muted-foreground">수집된 News Event가 없습니다.</div>}</div></section>
  </div>;
}

function EconomicCalendar({ events, loading, canManage, onAdd, onEdit, onDelete }: { events: EconomicEvent[]; loading: boolean; canManage: boolean; onAdd: () => void; onEdit: (event: EconomicEvent) => void; onDelete: (event: EconomicEvent) => void }) {
  if (loading && events.length === 0) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  return <div className="space-y-6">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div><h2 className="font-semibold">중요 경제 일정</h2><p className="mt-1 text-sm text-muted-foreground">시각은 현재 브라우저 시간대로 표시됩니다. Impact는 0~100입니다.</p></div><Button onClick={onAdd} disabled={!canManage}><Plus /> 일정 등록</Button></section>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="divide-y">{events.map((event) => <article key={event.id} className="grid gap-4 p-5 md:grid-cols-[150px_1fr_auto] md:items-center"><time className="text-sm tabular-nums text-muted-foreground" dateTime={event.scheduledAt}>{new Date(event.scheduledAt).toLocaleString('ko-KR')}</time><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{event.eventType}</span><span className="text-xs text-muted-foreground">{event.country} · {event.status}</span></div><h3 className="mt-2 font-semibold">{event.eventName}</h3><p className="mt-1 text-xs text-muted-foreground">{event.assets.length ? `영향 자산 ${event.assets.map((asset) => asset.symbol).join(', ')}` : '시장 전체'}{event.previousValue && ` · 이전 ${event.previousValue}`}{event.consensusValue && ` · 예상 ${event.consensusValue}`}{event.actualValue && ` · 실제 ${event.actualValue}`}</p>{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">공식 출처</a>}</div><div className="flex items-center justify-between gap-2 md:justify-end"><span className={`rounded-xl px-3 py-2 text-sm font-semibold ${event.expectedImpact >= 90 ? 'bg-rose-50 text-rose-700' : event.expectedImpact >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>Impact {event.expectedImpact}</span>{canManage && <><Button variant="ghost" size="icon-sm" aria-label={`${event.eventName} 수정`} onClick={() => onEdit(event)}><Pencil /></Button><Button variant="ghost" size="icon-sm" className="text-rose-600" aria-label={`${event.eventName} 삭제`} onClick={() => onDelete(event)}><Trash2 /></Button></>}</div></article>)}{!events.length && <div className="grid min-h-56 place-items-center p-8 text-center text-sm text-muted-foreground">등록된 경제 이벤트가 없습니다.</div>}</div></section>
  </div>;
}

function Admin({ assets, loading, token, collectingId, collectingNewsId, bootstrapping, collectingBatch, weights, savingWeights, generatingReport, notifications, savingNotifications, sendingNotifications, onToken, onAdd, onBootstrap, onCollectBatch, onCollect, onCollectNews, onEdit, onDelete, onWeights, onLoadWeights, onSaveWeights, onGenerateReport, onNotifications, onLoadNotifications, onSaveNotifications, onSendNotifications }: { assets: Asset[]; loading: boolean; token: string; collectingId: number | null; collectingNewsId: number | null; bootstrapping: boolean; collectingBatch: boolean; weights: ScoreWeight[]; savingWeights: boolean; generatingReport: boolean; notifications: NotificationState; savingNotifications: boolean; sendingNotifications: boolean; onToken: (value: string) => void; onAdd: () => void; onBootstrap: () => void; onCollectBatch: () => void; onCollect: (asset: Asset) => void; onCollectNews: (asset: Asset) => void; onEdit: (asset: Asset) => void; onDelete: (asset: Asset) => void; onWeights: (weights: ScoreWeight[]) => void; onLoadWeights: () => void; onSaveWeights: () => void; onGenerateReport: () => void; onNotifications: (value: NotificationState) => void; onLoadNotifications: () => void; onSaveNotifications: () => void; onSendNotifications: () => void }) {
  return <div className="space-y-6">
    <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div><Label htmlFor="admin-password">관리자 비밀번호</Label><p className="mb-2 mt-1 text-sm text-muted-foreground">브라우저에 저장하지 않으며 HTTPS API 요청 때만 사용합니다.</p><Input id="admin-password" type="password" autoComplete="off" value={token} onChange={(event) => onToken(event.target.value)} placeholder="설정한 비밀번호" className="max-w-md bg-white" /></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onBootstrap} disabled={!token || bootstrapping || collectingBatch}>{bootstrapping && <Loader2 className="animate-spin" />}기본 지표 등록</Button><Button variant="outline" onClick={onCollectBatch} disabled={!token || collectingBatch || bootstrapping}>{collectingBatch ? <Loader2 className="animate-spin" /> : <RefreshCw />}우선순위 5개 수집</Button><Button onClick={onAdd} disabled={!token}><Plus /> 자산 등록</Button></div></section>
    <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 text-sm leading-6 text-blue-950"><strong>무료 호출 최적화 · 조회 전용</strong><p className="mt-1">한국 지수·주식·ETF는 KIS 일봉 시세를, 나머지는 Alpha Vantage를 사용합니다. 일괄 수집은 미수집·오래된 자산부터 최대 5개만 처리하고 같은 자산은 18시간 동안 다시 호출하지 않습니다. 잔여 횟수는 Alpha 호출만 표시합니다. KIS 주문·정정·취소·잔고·계좌 API는 구현하지 않습니다.</p></section>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div><h2 className="font-semibold">Daily Report</h2><p className="mt-1 text-sm text-muted-foreground">최신 점수와 자산 지표를 오늘의 Snapshot으로 한 번만 발행합니다.</p></div><Button onClick={onGenerateReport} disabled={!token || generatingReport}>{generatingReport ? <Loader2 className="animate-spin" /> : <Newspaper />}오늘 리포트 생성</Button></section>
    <section className="rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Telegram · Email 알림</h2><p className="mt-1 text-sm text-muted-foreground">매일 설정 시각 이후 최신 리포트를 채널별 한 번만 발송합니다.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onLoadNotifications} disabled={!token}>불러오기</Button><Button variant="outline" onClick={onSendNotifications} disabled={!token || sendingNotifications || !notifications.settings.some((item) => item.enabled)}>{sendingNotifications && <Loader2 className="animate-spin" />}지금 발송</Button><Button onClick={onSaveNotifications} disabled={!token || savingNotifications || notifications.settings.length === 0}>{savingNotifications && <Loader2 className="animate-spin" />}설정 저장</Button></div></div>
      {notifications.settings.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-muted-foreground">관리자 비밀번호 입력 후 설정을 불러오세요.</p> : <div className="mt-5 grid gap-4 lg:grid-cols-2">{notifications.settings.map((setting) => <article key={setting.channel} className="rounded-xl border p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">{setting.channel === 'TELEGRAM' ? 'Telegram 요약' : 'Email 상세 리포트'}</p><p className={`mt-1 text-xs font-semibold ${notifications.configured[setting.channel] ? 'text-emerald-600' : 'text-amber-600'}`}>{notifications.configured[setting.channel] ? '발송 연결됨' : 'Worker 설정 필요'}</p></div><Switch aria-label={`${setting.channel} 알림 활성`} checked={setting.enabled} disabled={!notifications.configured[setting.channel]} onCheckedChange={(enabled) => onNotifications({ ...notifications, settings: notifications.settings.map((item) => item.channel === setting.channel ? { ...item, enabled } : item) })} /></div><div className="mt-4 grid grid-cols-2 gap-3"><div><Label htmlFor={`notify-time-${setting.channel}`}>발송 시각</Label><Input id={`notify-time-${setting.channel}`} type="time" value={setting.sendTime} onChange={(event) => onNotifications({ ...notifications, settings: notifications.settings.map((item) => item.channel === setting.channel ? { ...item, sendTime: event.target.value } : item) })} /></div><div><Label htmlFor={`notify-zone-${setting.channel}`}>시간대</Label><Input id={`notify-zone-${setting.channel}`} value={setting.timezone} onChange={(event) => onNotifications({ ...notifications, settings: notifications.settings.map((item) => item.channel === setting.channel ? { ...item, timezone: event.target.value } : item) })} /></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{setting.channel === 'TELEGRAM' ? 'TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · TELEGRAM_WEBHOOK_SECRET' : 'Cloudflare EMAIL binding · EMAIL_FROM · EMAIL_TO'}</p></article>)}</div>}
      {notifications.jobs.length > 0 && <div className="mt-5 overflow-x-auto"><p className="mb-2 text-sm font-semibold">최근 작업</p><Table><TableHeader><TableRow><TableHead>작업</TableHead><TableHead>상태</TableHead><TableHead>시작</TableHead><TableHead>오류</TableHead></TableRow></TableHeader><TableBody>{notifications.jobs.slice(0, 5).map((job) => <TableRow key={job.id}><TableCell>{job.jobName}</TableCell><TableCell><span className={`rounded-full px-2 py-1 text-xs font-semibold ${job.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : job.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{job.status}</span></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{new Date(job.startedAt).toLocaleString()}</TableCell><TableCell className="max-w-80 text-xs text-rose-600">{job.errorMessage ?? '—'}</TableCell></TableRow>)}</TableBody></Table></div>}
    </section>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">추적 자산</h2><p className="mt-1 text-sm text-muted-foreground">{assets.length}개 등록됨</p></div><Database className="size-5 text-muted-foreground" /></div>
      {loading ? <div className="grid min-h-48 place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div> : assets.length === 0 ? <div className="grid min-h-56 place-items-center p-8 text-center"><div><Database className="mx-auto size-8 text-slate-300" /><p className="mt-4 font-medium">등록된 자산이 없습니다.</p><p className="mt-1 text-sm text-muted-foreground">첫 번째 추적 자산을 등록하세요.</p></div></div> : <Table><TableHeader><TableRow><TableHead>자산</TableHead><TableHead>유형</TableHead><TableHead>시장 / 통화</TableHead><TableHead>중요도</TableHead><TableHead>상태</TableHead><TableHead className="text-right">관리</TableHead></TableRow></TableHeader><TableBody>{assets.map((asset) => <TableRow key={asset.id}><TableCell><p className="font-semibold">{asset.symbol}</p><p className="text-xs text-muted-foreground">{asset.name}</p></TableCell><TableCell>{asset.assetType}</TableCell><TableCell>{asset.market} · {asset.currency}</TableCell><TableCell>{asset.importanceWeight}</TableCell><TableCell><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${asset.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{asset.enabled && <CheckCircle2 className="size-3" />}{asset.enabled ? '활성' : '비활성'}</span></TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" aria-label={`${asset.symbol} 가격 수집`} disabled={!token || !isCollectable(asset.symbol) || collectingBatch || collectingId !== null || collectingNewsId !== null} onClick={() => onCollect(asset)}>{collectingId === asset.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}</Button><Button variant="ghost" size="icon-sm" aria-label={`${asset.symbol} 뉴스 수집`} disabled={!token || !newsTickerFor(asset.symbol) || collectingBatch || collectingId !== null || collectingNewsId !== null} onClick={() => onCollectNews(asset)}>{collectingNewsId === asset.id ? <Loader2 className="animate-spin" /> : <Newspaper />}</Button><Button variant="ghost" size="icon-sm" aria-label={`${asset.symbol} 수정`} onClick={() => onEdit(asset)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={`${asset.symbol} 삭제`} className="text-rose-600" onClick={() => onDelete(asset)}><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody></Table>}
    </section>
    <section className="rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgb(30_58_95/5%)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Score Weight</h2><p className="mt-1 text-sm text-muted-foreground">ASSET과 MARKET 그룹별 활성 가중치 합계는 각각 1이어야 합니다.</p></div><div className="flex gap-2"><Button variant="outline" onClick={onLoadWeights} disabled={!token}>불러오기</Button><Button onClick={onSaveWeights} disabled={!token || savingWeights}>{savingWeights && <Loader2 className="animate-spin" />}저장·재계산</Button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{weights.map((item, index) => <div key={`${item.scoreGroup}-${item.metricKey}`} className="rounded-xl border p-3"><Label htmlFor={`weight-${index}`}>{item.scoreGroup} · {item.metricKey}</Label><Input id={`weight-${index}`} type="number" min="0" max="1" step="0.05" value={item.weight} onChange={(event) => onWeights(weights.map((weight, weightIndex) => weightIndex === index ? { ...weight, weight: Number(event.target.value) } : weight))} /></div>)}</div></section>
  </div>;
}

function AssetForm({ value, onChange }: { value: AssetInput; onChange: (value: AssetInput) => void }) {
  const set = <K extends keyof AssetInput>(key: K, next: AssetInput[K]) => onChange({ ...value, [key]: next });
  return <div className="mt-5 grid gap-4 sm:grid-cols-2">
    <div><Label htmlFor="symbol">티커</Label><Input id="symbol" required maxLength={24} value={value.symbol} onChange={(e) => set('symbol', e.target.value)} placeholder="NVDA" /></div>
    <div><Label htmlFor="name">이름</Label><Input id="name" required maxLength={80} value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="NVIDIA" /></div>
    <div><Label htmlFor="asset-type">자산 유형</Label><select id="asset-type" value={value.assetType} onChange={(e) => set('assetType', e.target.value as AssetType)} className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{ASSET_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
    <div><Label htmlFor="market">시장</Label><Input id="market" required maxLength={20} value={value.market} onChange={(e) => set('market', e.target.value)} placeholder="NASDAQ" /></div>
    <div><Label htmlFor="currency">통화</Label><Input id="currency" required maxLength={3} value={value.currency} onChange={(e) => set('currency', e.target.value)} placeholder="USD" /></div>
    <div><Label htmlFor="weight">중요도 (0~100)</Label><Input id="weight" required type="number" min="0" max="100" step="0.1" value={value.importanceWeight} onChange={(e) => set('importanceWeight', Number(e.target.value))} /></div>
    <div className="sm:col-span-2 flex items-center justify-between rounded-xl border p-3"><div><Label htmlFor="enabled">추적 활성화</Label><p className="text-xs text-muted-foreground">다음 수집 작업에 포함합니다.</p></div><Switch id="enabled" checked={value.enabled} onCheckedChange={(checked) => set('enabled', checked)} /></div>
  </div>;
}

function EconomicEventForm({ value, assets, onChange }: { value: EconomicEventInput; assets: Asset[]; onChange: (value: EconomicEventInput) => void }) {
  const set = <K extends keyof EconomicEventInput>(key: K, next: EconomicEventInput[K]) => onChange({ ...value, [key]: next });
  return <div className="mt-5 grid gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2"><Label htmlFor="event-name">이벤트 이름</Label><Input id="event-name" required maxLength={120} value={value.eventName} onChange={(e) => set('eventName', e.target.value)} placeholder="미국 소비자물가지수" /></div>
    <div><Label htmlFor="event-type">유형</Label><select id="event-type" value={value.eventType} onChange={(e) => set('eventType', e.target.value as EconomicEventInput['eventType'])} className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
    <div><Label htmlFor="event-country">국가 코드</Label><Input id="event-country" required minLength={2} maxLength={3} value={value.country} onChange={(e) => set('country', e.target.value)} placeholder="US" /></div>
    <div><Label htmlFor="event-time">예정 시각</Label><Input id="event-time" required type="datetime-local" value={value.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} /></div>
    <div><Label htmlFor="event-impact">Impact (0~100)</Label><Input id="event-impact" required type="number" min="0" max="100" step="1" value={value.expectedImpact} onChange={(e) => set('expectedImpact', Number(e.target.value))} /></div>
    <div><Label htmlFor="event-status">상태</Label><select id="event-status" value={value.status} onChange={(e) => set('status', e.target.value as EconomicEventInput['status'])} className="mt-1 flex h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{EVENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div>
    <div><Label htmlFor="event-previous">이전값</Label><Input id="event-previous" maxLength={40} value={value.previousValue ?? ''} onChange={(e) => set('previousValue', e.target.value || null)} placeholder="2.7%" /></div>
    <div><Label htmlFor="event-consensus">컨센서스</Label><Input id="event-consensus" maxLength={40} value={value.consensusValue ?? ''} onChange={(e) => set('consensusValue', e.target.value || null)} placeholder="2.8%" /></div>
    <div><Label htmlFor="event-actual">실제값</Label><Input id="event-actual" maxLength={40} value={value.actualValue ?? ''} onChange={(e) => set('actualValue', e.target.value || null)} placeholder="발표 후 입력" /></div>
    <div className="sm:col-span-2"><Label htmlFor="event-source">공식 출처 URL</Label><Input id="event-source" type="url" maxLength={500} value={value.sourceUrl ?? ''} onChange={(e) => set('sourceUrl', e.target.value || null)} placeholder="https://..." /></div>
    {assets.length > 0 && <fieldset className="sm:col-span-2"><legend className="text-sm font-medium">영향 자산</legend><div className="mt-2 flex flex-wrap gap-2">{assets.map((asset) => <label key={asset.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" checked={value.affectedAssetIds.includes(asset.id)} onChange={(e) => set('affectedAssetIds', e.target.checked ? [...value.affectedAssetIds, asset.id] : value.affectedAssetIds.filter((id) => id !== asset.id))} />{asset.symbol}</label>)}</div></fieldset>}
  </div>;
}
