export type CollectionJob = {
  id: number;
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  errorMessage: string | null;
};

export type CollectionPipelineKey = 'PRICE' | 'NEWS' | 'MACRO' | 'NOTIFICATION';

export type CollectionPipelineStatus = {
  key: CollectionPipelineKey;
  label: string;
  latest: CollectionJob | null;
  lastSuccess: CollectionJob | null;
  lastFailure: CollectionJob | null;
  nextRunAt: string | null;
};

type NotificationSchedule = { enabled: boolean; sendTime: string };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const PIPELINES: Array<{
  key: CollectionPipelineKey;
  label: string;
  matches: (name: string) => boolean;
}> = [
  {
    key: 'PRICE',
    label: '가격 수집',
    matches: (name) => /^(DAILY_KIS:|CRON:DAILY_KIS|KIS_API:PRICE:|ALPHA_API:PRICE:)/.test(name),
  },
  {
    key: 'NEWS',
    label: '뉴스 수집',
    matches: (name) => /^(NAVER_API:NEWS:|ALPHA_API:NEWS:|CRON:NAVER_NEWS)/.test(name),
  },
  {
    key: 'MACRO',
    label: '거시·캘린더',
    matches: (name) => /^(CALENDAR:|CRON:CALENDAR|CRON:KEYLESS_MACRO|YAHOO_API:PRICE:|TREASURY_API:PRICE:)/.test(name),
  },
  {
    key: 'NOTIFICATION',
    label: '알림 발송',
    matches: (name) => /^(NOTIFICATION|CRON:NOTIFICATION)/.test(name),
  },
];

function nextSeoulTime(now: Date, times: string[], weekdaysOnly = false) {
  if (!times.length) return null;
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const date = kst.getUTCDate();
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(Date.UTC(year, month, date + offset));
    if (weekdaysOnly && (day.getUTCDay() === 0 || day.getUTCDay() === 6)) continue;
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      const candidate = new Date(Date.UTC(
        day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - 9, minute,
      ));
      if (candidate > now) return candidate.toISOString();
    }
  }
  return null;
}

function nextRunAt(key: CollectionPipelineKey, now: Date, notifications: NotificationSchedule[]) {
  if (key === 'PRICE') return nextSeoulTime(now, ['16:10'], true);
  if (key === 'NEWS') return nextSeoulTime(now, ['00:00', '00:30', '06:00', '06:30', '12:00', '12:30', '18:00', '18:30']);
  if (key === 'MACRO') return nextSeoulTime(now, ['09:00', '09:15', '10:15']);
  return nextSeoulTime(now, notifications.filter((item) => item.enabled).map((item) => item.sendTime).sort());
}

export function summarizeCollectionJobs(
  jobs: CollectionJob[],
  notifications: NotificationSchedule[],
  now = new Date(),
): CollectionPipelineStatus[] {
  return PIPELINES.map((pipeline) => {
    const matching = jobs.filter((job) => pipeline.matches(job.jobName));
    return {
      key: pipeline.key,
      label: pipeline.label,
      latest: matching[0] ?? null,
      lastSuccess: matching.find((job) => job.status === 'SUCCESS') ?? null,
      lastFailure: matching.find((job) => job.status === 'FAILED' || job.status === 'PARTIAL') ?? null,
      nextRunAt: nextRunAt(pipeline.key, now, notifications),
    };
  });
}
