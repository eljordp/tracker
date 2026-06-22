// Web push: subscribe, unsubscribe, and send.
//   GET  /api/push?action=vapid        -> { publicKey }            (public)
//   POST /api/push { action:'subscribe', subscription }            (Bearer TRACKER_API_KEY)
//   POST /api/push { action:'unsubscribe', endpoint }              (Bearer TRACKER_API_KEY)
//   POST /api/push { action:'send', title, body, url }             (Bearer PUSH_SEND_SECRET)
import webpush from 'web-push';
import { Redis } from '@upstash/redis';

const SUBS_KEY = 'push:subs';

function getRedis() {
  return Redis.fromEnv();
}

function vapidReady() {
  return !!(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE);
}

function configureVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:tracker@example.com',
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
  );
}

function bearer(req) {
  return (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET' && req.query.action === 'vapid') {
    if (!vapidReady()) return res.status(503).json({ error: 'push not configured' });
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = body.action;

  try {
    const redis = getRedis();

    if (action === 'subscribe' || action === 'unsubscribe') {
      if (bearer(req) !== process.env.TRACKER_API_KEY) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      if (action === 'subscribe') {
        if (!body.subscription || !body.subscription.endpoint) {
          return res.status(400).json({ error: 'missing subscription' });
        }
        await redis.sadd(SUBS_KEY, JSON.stringify(body.subscription));
        return res.status(200).json({ ok: true });
      }
      // unsubscribe: remove any stored sub matching the endpoint
      const subs = await redis.smembers(SUBS_KEY);
      for (const raw of subs) {
        const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (s.endpoint === body.endpoint) await redis.srem(SUBS_KEY, raw);
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'send') {
      if (bearer(req) !== process.env.PUSH_SEND_SECRET) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      if (!vapidReady()) return res.status(503).json({ error: 'push not configured' });
      configureVapid();
      const payload = JSON.stringify({
        title: body.title || 'Tracker',
        body: body.body || 'Open the tracker and lock one more rep.',
        tag: body.tag || 'tracker-reminder',
        url: body.url || '/',
      });
      const subs = await redis.smembers(SUBS_KEY);
      let sent = 0, pruned = 0;
      await Promise.all(subs.map(async (raw) => {
        const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
        try {
          await webpush.sendNotification(s, payload);
          sent++;
        } catch (err) {
          // 404/410 = subscription expired; drop it
          if (err.statusCode === 404 || err.statusCode === 410) {
            await redis.srem(SUBS_KEY, raw);
            pruned++;
          }
        }
      }));
      return res.status(200).json({ ok: true, sent, pruned, total: subs.length });
    }

    return res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'server error', detail: String(err && err.message || err) });
  }
}
