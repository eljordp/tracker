// Cal AI-style food photo scanner.
// POST { image: <base64 string, no data: prefix>, mime: 'image/jpeg' }
// Returns { ok: true, items: [{ name, qty, cal, pro, fat, carb }] }
// Uses Gemini vision to identify the plate and estimate macros.

function auth(req) {
  const key = process.env.TRACKER_API_KEY;
  if (!key) return false;
  const header = req.headers['authorization'] || '';
  return header === `Bearer ${key}`;
}

const PROMPT = `You are a nutrition estimator. Look at this photo of food and identify every distinct food item on the plate.
For each item, estimate the realistic portion size shown and its macros for THAT portion (not per 100g).
Be practical and decisive — a normal person photographing their meal. If unsure, give your best single estimate.
Return ONLY the structured data. calories in kcal, protein/fat/carbs in grams, all integers. qty = number of servings of that item visible (usually 1).`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'integer' },
          cal: { type: 'integer' },
          pro: { type: 'integer' },
          fat: { type: 'integer' },
          carb: { type: 'integer' },
        },
        required: ['name', 'qty', 'cal', 'pro', 'fat', 'carb'],
      },
    },
  },
  required: ['items'],
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!auth(req)) {
    return res.status(401).json({ error: 'Unauthorized. Set your sync key in Settings first.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'Scanner not configured (no GEMINI_API_KEY).' });

  const { image, mime } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing image.' });

  const MODEL = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiKey}`;

  try {
    const gres = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mime || 'image/jpeg', data: image } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          temperature: 0.2,
        },
      }),
    });

    if (!gres.ok) {
      const txt = await gres.text();
      console.error('Gemini error:', gres.status, txt);
      return res.status(502).json({ error: 'Vision service error.' });
    }

    const data = await gres.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return res.status(502).json({ error: 'No reading from the photo. Try a clearer shot.' });

    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
      console.error('Parse fail:', raw);
      return res.status(502).json({ error: 'Could not read the plate. Try again.' });
    }

    const items = (parsed.items || []).map(f => ({
      name: String(f.name || 'Food').slice(0, 60),
      qty: Math.max(1, parseInt(f.qty) || 1),
      cal: Math.max(0, Math.round(f.cal) || 0),
      pro: Math.max(0, Math.round(f.pro) || 0),
      fat: Math.max(0, Math.round(f.fat) || 0),
      carb: Math.max(0, Math.round(f.carb) || 0),
    })).filter(f => f.cal > 0);

    return res.json({ ok: true, items });
  } catch (err) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: 'Scan failed.' });
  }
}
