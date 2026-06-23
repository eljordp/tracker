// Scroll Debt logger for iOS Shortcuts.
// GET  /api/scroll?key=...&app=instagram&event=open
// GET  /api/scroll?key=...&app=instagram&event=close
// GET  /api/scroll?date=YYYY-MM-DD
// POST /api/scroll { action:'add', session } or { app, minutes }
import { Redis } from '@upstash/redis';

const TZ = 'America/Los_Angeles';
const VALID_APPS = new Set(['instagram', 'tiktok', 'youtube', 'safari', 'reddit', 'x', 'other']);

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return Redis.fromEnv();
}

function bearer(req) {
  return (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
}

function authed(req, body) {
  const key = process.env.TRACKER_API_KEY;
  if (!key) return false;
  return bearer(req) === key || req.query.key === key || body.key === key;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch(e) { return {}; }
  }
  return req.body;
}

function dateKey(input) {
  const d = input ? new Date(input) : new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeApp(app) {
  const val = String(app || 'other').trim().toLowerCase();
  if (val === 'ig') return 'instagram';
  if (val === 'yt') return 'youtube';
  if (val === 'twitter') return 'x';
  return VALID_APPS.has(val) ? val : 'other';
}

function sessionsKey(day) {
  return `scroll:sessions:${day}`;
}

function activeKey(app) {
  return `scroll:active:${app}`;
}

function safeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      return [];
    }
  }
  return [];
}

async function getSessions(redis, day) {
  return safeList(await redis.get(sessionsKey(day)));
}

async function saveSession(redis, session) {
  const day = dateKey(session.end || session.start || new Date());
  const sessions = await getSessions(redis, day);
  const next = sessions.filter(s => s.id !== session.id);
  next.push(session);
  next.sort((a, b) => new Date(a.start || a.end || 0) - new Date(b.start || b.end || 0));
  await redis.set(sessionsKey(day), next);
  return { day, sessions: next };
}

function summarize(sessions) {
  const appTotals = {};
  let total = 0;
  let longest = 0;
  sessions.forEach(session => {
    const minutes = Number(session.minutes) || 0;
    total += minutes;
    longest = Math.max(longest, minutes);
    appTotals[session.app] = (appTotals[session.app] || 0) + minutes;
  });
  return {
    totalMinutes: Math.round(total),
    appTotals,
    longestMinutes: Math.round(longest),
    sessionCount: sessions.length,
  };
}

function buildSession({ app, start, end, minutes, source, id }) {
  const endDate = end ? new Date(end) : new Date();
  const startDate = start ? new Date(start) : new Date(endDate.getTime() - (Number(minutes) || 0) * 60000);
  const rawMinutes = Number(minutes) || ((endDate - startDate) / 60000);
  const finalMinutes = Math.max(1, Math.min(1080, Math.round(rawMinutes)));
  return {
    id: id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    app: normalizeApp(app),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    minutes: finalMinutes,
    source: source || 'shortcut',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const body = parseBody(req);
  if (!authed(req, body)) return res.status(401).json({ error: 'unauthorized' });

  const redis = getRedis();
  if (!redis) return res.status(503).json({ error: 'scroll store not configured' });

  try {
    if (req.method === 'GET') {
      const app = normalizeApp(req.query.app);
      const event = String(req.query.event || req.query.action || '').toLowerCase();
      const at = req.query.at ? new Date(req.query.at) : new Date();

      if (event === 'open' || event === 'start') {
        await redis.set(activeKey(app), { app, start: at.toISOString() });
        return res.status(200).json({ ok: true, app, event: 'open', start: at.toISOString() });
      }

      if (event === 'close' || event === 'stop') {
        const active = await redis.get(activeKey(app));
        await redis.del(activeKey(app));
        if (!active || !active.start) {
          return res.status(200).json({ ok: true, app, event: 'close', skipped: 'no active session' });
        }
        const session = buildSession({ app, start: active.start, end: at.toISOString(), source: 'shortcut' });
        const saved = await saveSession(redis, session);
        return res.status(200).json({ ok: true, app, event: 'close', session, ...summarize(saved.sessions) });
      }

      const day = req.query.date || dateKey();
      const sessions = await getSessions(redis, day);
      return res.status(200).json({ ok: true, date: day, sessions, ...summarize(sessions) });
    }

    if (req.method === 'POST') {
      const action = String(body.action || 'add').toLowerCase();
      if (action !== 'add') return res.status(400).json({ error: 'unknown action' });
      const session = body.session
        ? buildSession({ ...body.session, source: body.session.source || 'manual' })
        : buildSession({ app: body.app, minutes: body.minutes, source: 'manual' });
      const saved = await saveSession(redis, session);
      return res.status(200).json({ ok: true, date: saved.day, session, ...summarize(saved.sessions) });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'server error', detail: String(err && err.message || err) });
  }
}
