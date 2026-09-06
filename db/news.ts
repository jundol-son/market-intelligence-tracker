import { getDb } from './index';
import {
  calculateNewsScore, detectDivergence, isDuplicateEvent, newsFingerprint,
  type NewsArticle,
} from '@/lib/news';

type CandidateEvent = {
  id: number;
  title: string;
  category: NewsArticle['category'];
  eventTime: string;
};

type ScoreEvent = Pick<NewsArticle, 'sentimentScore' | 'impactScore' | 'confidenceScore' | 'sourceRank'>;

export async function saveNews(assetId: number, articles: NewsArticle[]) {
  const db = getDb();
  const existing = await db.prepare(`SELECT id, title, category, event_time AS eventTime
    FROM news_events ORDER BY event_time DESC LIMIT 300`).all<CandidateEvent>();
  const candidates = [...existing.results];
  let created = 0;

  // ponytail: at most 50 provider rows are matched in memory; move similarity search to a worker/vector index only if the feed grows materially.
  for (const article of articles) {
    const sourceEvent = await db.prepare('SELECT event_id AS eventId FROM news_sources WHERE source_url=?')
      .bind(article.sourceUrl).first<{ eventId: number }>();
    let eventId = sourceEvent?.eventId ?? candidates.find((event) => isDuplicateEvent(article, event))?.id;
    if (!eventId) {
      await db.prepare(`INSERT OR IGNORE INTO news_events
        (fingerprint, title, summary, category, event_time, sentiment, sentiment_score,
          impact_score, confidence_score, duration_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(newsFingerprint(article), article.title, article.summary, article.category,
          article.eventTime, article.sentiment, article.sentimentScore, article.impactScore,
          article.confidenceScore, article.durationType).run();
      const inserted = await db.prepare('SELECT id FROM news_events WHERE fingerprint=?')
        .bind(newsFingerprint(article)).first<{ id: number }>();
      if (!inserted) throw new Error('뉴스 Event 저장에 실패했습니다.');
      eventId = inserted.id;
      candidates.push({ id: eventId, title: article.title, category: article.category, eventTime: article.eventTime });
      created += 1;
    } else {
      await db.prepare(`UPDATE news_events SET
        impact_score=MAX(impact_score, ?), confidence_score=MAX(confidence_score, ?)
        WHERE id=?`).bind(article.impactScore, article.confidenceScore, eventId).run();
    }
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO news_sources
        (event_id, source, source_url, source_rank, published_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(eventId, article.source, article.sourceUrl, article.sourceRank, article.eventTime),
      db.prepare(`INSERT INTO news_event_assets
        (event_id, asset_id, relevance_score, sentiment_score) VALUES (?, ?, ?, ?)
        ON CONFLICT(event_id, asset_id) DO UPDATE SET
          relevance_score=MAX(relevance_score, excluded.relevance_score),
          sentiment_score=excluded.sentiment_score`)
        .bind(eventId, assetId, article.relevanceScore, article.sentimentScore),
      db.prepare(`UPDATE news_events SET is_duplicate_group=(
        SELECT COUNT(*)>1 FROM news_sources WHERE event_id=?) WHERE id=?`).bind(eventId, eventId),
    ]);
  }

  const scoreRows = await db.prepare(`SELECT a.sentiment_score AS sentimentScore,
    e.impact_score AS impactScore, e.confidence_score AS confidenceScore,
    MIN(s.source_rank) AS sourceRank
    FROM news_events e JOIN news_event_assets a ON a.event_id=e.id
    JOIN news_sources s ON s.event_id=e.id
    WHERE a.asset_id=? AND a.relevance_score>=0.7
      AND datetime(e.event_time)>=datetime('now', '-3 days')
    GROUP BY e.id`).bind(assetId).all<ScoreEvent>();
  const score = calculateNewsScore(scoreRows.results);
  const latest = await db.prepare(`SELECT i.return_1d AS return1d
    FROM asset_indicators i WHERE i.asset_id=? ORDER BY i.date DESC LIMIT 1`)
    .bind(assetId).first<{ return1d: number | null }>();
  const divergence = detectDivergence(latest?.return1d ?? null, score);
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  await db.batch([
    db.prepare(`INSERT INTO news_scores (asset_id, date, score, event_count, divergence)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(asset_id, date) DO UPDATE SET
      score=excluded.score, event_count=excluded.event_count, divergence=excluded.divergence`)
      .bind(assetId, date, score, scoreRows.results.length, divergence),
    db.prepare(`UPDATE asset_scores SET news_score=? WHERE id=(SELECT id FROM asset_scores
      WHERE asset_id=? ORDER BY date DESC LIMIT 1)`).bind(score, assetId),
  ]);
  return { fetched: articles.length, created, score, divergence };
}

export async function listNews(limit = 50) {
  const db = getDb();
  const [events, sources, assets, scores] = await Promise.all([
    db.prepare(`SELECT id, title, summary, category, event_time AS eventTime,
      sentiment, sentiment_score AS sentimentScore, impact_score AS impactScore,
      confidence_score AS confidenceScore, duration_type AS durationType,
      is_duplicate_group AS isDuplicateGroup, created_at AS createdAt
      FROM news_events e WHERE EXISTS (SELECT 1 FROM news_event_assets m
        WHERE m.event_id=e.id AND m.relevance_score>=0.7)
      ORDER BY event_time DESC, id DESC LIMIT ?`).bind(limit).all(),
    db.prepare(`SELECT event_id AS eventId, source, source_url AS sourceUrl,
      source_rank AS sourceRank, published_at AS publishedAt FROM news_sources
      WHERE event_id IN (SELECT e.id FROM news_events e WHERE EXISTS
        (SELECT 1 FROM news_event_assets m WHERE m.event_id=e.id AND m.relevance_score>=0.7)
        ORDER BY event_time DESC, id DESC LIMIT ?)
      ORDER BY source_rank, id`).bind(limit).all(),
    db.prepare(`SELECT m.event_id AS eventId, m.asset_id AS assetId, a.symbol, a.name,
      m.relevance_score AS relevanceScore FROM news_event_assets m JOIN assets a ON a.id=m.asset_id
      WHERE m.relevance_score>=0.7 AND m.event_id IN (SELECT e.id FROM news_events e WHERE EXISTS
        (SELECT 1 FROM news_event_assets x WHERE x.event_id=e.id AND x.relevance_score>=0.7)
        ORDER BY event_time DESC, id DESC LIMIT ?)
      ORDER BY m.relevance_score DESC`).bind(limit).all(),
    db.prepare(`SELECT n.asset_id AS assetId, a.symbol, a.name, n.date, n.score,
      n.event_count AS eventCount, n.divergence FROM news_scores n JOIN assets a ON a.id=n.asset_id
      WHERE n.id IN (SELECT MAX(id) FROM news_scores GROUP BY asset_id) ORDER BY n.score DESC`).all(),
  ]);
  return {
    events: events.results.map((event) => ({
      ...event,
      isDuplicateGroup: Boolean(event.isDuplicateGroup),
      sources: sources.results.filter((source) => source.eventId === event.id),
      assets: assets.results.filter((asset) => asset.eventId === event.id),
    })),
    scores: scores.results,
  };
}
