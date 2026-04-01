import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

// AM routine exercise counts (for status computation)
const AM_COUNTS = { a: 8, b: 11, c: 15 };
const AM_CAL_PER = { a: 6, b: 11, c: 5 };
const PM_COUNTS = {
  home: { monday: 6, tuesday: 6, wednesday: 6, thursday: 6, friday: 5 },
  gym: { monday: 6, tuesday: 6, wednesday: 7, thursday: 6, friday: 5 },
  bw: { monday: 7, tuesday: 7, wednesday: 8, thursday: 7, friday: 5 },
};
const COOLDOWN_COUNT = 5;
const BMR = 1800;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Foods lookup for nutrition logging by ID
const FOODS = {
  'chicken-breast': { name: 'Chicken Breast', serving: '4 oz', cal: 187, pro: 35, fat: 4, carb: 0 },
  'chicken-thigh': { name: 'Chicken Thigh', serving: '4 oz', cal: 230, pro: 28, fat: 13, carb: 0 },
  'eggs': { name: 'Eggs', serving: '2 large', cal: 144, pro: 12, fat: 10, carb: 1 },
  'ground-beef': { name: 'Ground Beef (90/10)', serving: '4 oz', cal: 200, pro: 22, fat: 11, carb: 0 },
  'ground-turkey': { name: 'Ground Turkey', serving: '4 oz', cal: 170, pro: 21, fat: 9, carb: 0 },
  'steak': { name: 'Steak (Sirloin)', serving: '6 oz', cal: 276, pro: 46, fat: 9, carb: 0 },
  'salmon': { name: 'Salmon', serving: '4 oz', cal: 234, pro: 25, fat: 14, carb: 0 },
  'tilapia': { name: 'Tilapia', serving: '4 oz', cal: 110, pro: 23, fat: 2, carb: 0 },
  'shrimp': { name: 'Shrimp', serving: '4 oz', cal: 120, pro: 23, fat: 2, carb: 1 },
  'greek-yogurt': { name: 'Greek Yogurt', serving: '1 cup', cal: 130, pro: 20, fat: 0, carb: 9 },
  'white-rice': { name: 'White Rice', serving: '1 cup cooked', cal: 206, pro: 4, fat: 0, carb: 45 },
  'jasmine-rice': { name: 'Jasmine Rice', serving: '1 cup cooked', cal: 210, pro: 4, fat: 0, carb: 46 },
  'sweet-potato': { name: 'Sweet Potato', serving: '1 medium', cal: 103, pro: 2, fat: 0, carb: 24 },
  'potato': { name: 'Potato', serving: '1 medium', cal: 161, pro: 4, fat: 0, carb: 37 },
  'pasta': { name: 'Pasta', serving: '1 cup cooked', cal: 220, pro: 8, fat: 1, carb: 43 },
  'oats': { name: 'Oats', serving: '1/2 cup dry', cal: 150, pro: 5, fat: 3, carb: 27 },
  'bread': { name: 'Bread', serving: '1 slice', cal: 80, pro: 3, fat: 1, carb: 15 },
  'banana': { name: 'Banana', serving: '1 medium', cal: 105, pro: 1, fat: 0, carb: 27 },
  'black-beans': { name: 'Black Beans', serving: '1/2 cup', cal: 114, pro: 8, fat: 0, carb: 20 },
  'avocado': { name: 'Avocado', serving: '1/2 fruit', cal: 161, pro: 2, fat: 15, carb: 9 },
  'olive-oil': { name: 'Olive Oil', serving: '1 tbsp', cal: 119, pro: 0, fat: 14, carb: 0 },
  'peanut-butter': { name: 'Peanut Butter', serving: '2 tbsp', cal: 188, pro: 7, fat: 16, carb: 7 },
  'almonds': { name: 'Almonds', serving: '1 oz (23 nuts)', cal: 164, pro: 6, fat: 14, carb: 6 },
  'mixed-nuts': { name: 'Mixed Nuts', serving: '1 oz', cal: 172, pro: 5, fat: 15, carb: 7 },
  'brazil-nuts': { name: 'Brazil Nuts', serving: '3 nuts', cal: 99, pro: 2, fat: 10, carb: 2 },
  'broccoli': { name: 'Broccoli', serving: '1 cup', cal: 55, pro: 4, fat: 1, carb: 11 },
  'spinach': { name: 'Spinach', serving: '2 cups raw', cal: 14, pro: 2, fat: 0, carb: 2 },
  'bell-pepper': { name: 'Bell Pepper', serving: '1 medium', cal: 31, pro: 1, fat: 0, carb: 7 },
  'mixed-veggies': { name: 'Mixed Veggies', serving: '1 cup', cal: 82, pro: 4, fat: 0, carb: 16 },
  'onion': { name: 'Onion', serving: '1/2 medium', cal: 22, pro: 1, fat: 0, carb: 5 },
  'salad-greens': { name: 'Salad Greens', serving: '2 cups', cal: 15, pro: 1, fat: 0, carb: 3 },
  'apple': { name: 'Apple', serving: '1 medium', cal: 95, pro: 0, fat: 0, carb: 25 },
  'berries': { name: 'Berries', serving: '1 cup', cal: 85, pro: 1, fat: 1, carb: 21 },
  'dates': { name: 'Dates', serving: '2 dates', cal: 133, pro: 1, fat: 0, carb: 36 },
  'honey': { name: 'Honey', serving: '1 tbsp', cal: 64, pro: 0, fat: 0, carb: 17 },
  'salsa': { name: 'Salsa', serving: '2 tbsp', cal: 10, pro: 0, fat: 0, carb: 2 },
  'protein-shake': { name: 'Protein Shake', serving: '1 scoop + water', cal: 120, pro: 25, fat: 1, carb: 3 },
  'coffee-black': { name: 'Black Coffee', serving: '1 cup', cal: 5, pro: 0, fat: 0, carb: 0 },
};

const ADDONS = {
  breaded: { label: 'Breaded', cal: 120, pro: 2, fat: 6, carb: 14 },
  fried: { label: 'Fried', cal: 100, pro: 0, fat: 10, carb: 5 },
  grilled: { label: 'Grilled', cal: 10, pro: 0, fat: 1, carb: 0 },
  sauteed: { label: 'Sautéed', cal: 45, pro: 0, fat: 5, carb: 0 },
  sauce: { label: 'Sauce', cal: 60, pro: 1, fat: 3, carb: 7 },
  cheese: { label: 'Cheese', cal: 110, pro: 7, fat: 9, carb: 1 },
  butter: { label: 'Butter', cal: 102, pro: 0, fat: 12, carb: 0 },
  dressing: { label: 'Dressing', cal: 73, pro: 0, fat: 8, carb: 1 },
  'soy-sauce': { label: 'Soy Sauce', cal: 9, pro: 1, fat: 0, carb: 1 },
  'hot-sauce': { label: 'Hot Sauce', cal: 3, pro: 0, fat: 0, carb: 1 },
  seasoned: { label: 'Seasoned', cal: 5, pro: 0, fat: 0, carb: 1 },
  baked: { label: 'Baked', cal: 5, pro: 0, fat: 0, carb: 0 },
};

function auth(req) {
  const key = process.env.TRACKER_API_KEY;
  if (!key) return false;
  const header = req.headers['authorization'] || '';
  return header === `Bearer ${key}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_NAMES[d.getDay()];
}

function computeStatus(workoutData, nutritionData, weightVal, dateStr) {
  const w = workoutData || {};
  const n = nutritionData || [];
  const dayName = getDayName(dateStr);
  const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // Walk
  const walkMin = w.walk || 0;
  const walkMiles = w.walkMiles || 0;
  const walkCal = walkMiles > 0 ? Math.round(walkMiles * 90) : walkMin * 4;

  // AM
  const amRoutine = w.amRoutine || 'a';
  const amCompleted = (w.am || []).length;
  const amTotal = AM_COUNTS[amRoutine] || 8;
  const amCal = amCompleted * (AM_CAL_PER[amRoutine] || 6);

  // PM
  const location = w.location || 'home';
  const pmCompleted = (w.pm || []).length;
  const pmTotal = isWeekday ? (PM_COUNTS[location]?.[dayName] || 0) : 0;
  const pmCal = pmCompleted * (location === 'gym' ? 55 : 50);

  // Cooldown
  const cdCompleted = (w.cooldown || []).length;
  const cdCal = cdCompleted * 3;

  const exerciseBurn = walkCal + amCal + pmCal + cdCal;
  const totalBurn = BMR + exerciseBurn;

  // Nutrition totals
  let totalCal = 0, totalPro = 0, totalFat = 0, totalCarb = 0;
  n.forEach(f => {
    totalCal += f.cal || 0;
    totalPro += f.pro || 0;
    totalFat += f.fat || 0;
    totalCarb += f.carb || 0;
  });

  return {
    date: dateStr,
    workouts: {
      walk: { minutes: walkMin, miles: walkMiles, calories: walkCal },
      am: { routine: amRoutine, completed: amCompleted, total: amTotal, calories: amCal },
      pm: isWeekday ? { location, completed: pmCompleted, total: pmTotal, calories: pmCal } : null,
      cooldown: isWeekday ? { completed: cdCompleted, total: COOLDOWN_COUNT, calories: cdCal } : null,
      exerciseBurn,
      totalBurn,
    },
    nutrition: {
      calories: totalCal,
      protein: totalPro,
      fat: totalFat,
      carbs: totalCarb,
      items: n.length,
      targets: { calories: 2000, protein: 170, fat: 65, carbs: 250 },
      deficit: totalBurn - totalCal,
    },
    weight: weightVal || null,
  };
}

function buildFoodEntry(food) {
  // If full entry provided (cal, pro, etc.), use as-is
  if (food.cal !== undefined) {
    return {
      id: food.id || 'custom',
      name: food.name,
      qty: food.qty || 1,
      serving: food.serving || 'custom',
      addons: food.addons || [],
      cal: food.cal,
      pro: food.pro || 0,
      fat: food.fat || 0,
      carb: food.carb || 0,
    };
  }

  // Look up by ID
  const base = FOODS[food.id];
  if (!base) return null;

  const qty = food.qty || 1;
  const addons = food.addons || [];

  let addonCal = 0, addonPro = 0, addonFat = 0, addonCarb = 0;
  addons.forEach(key => {
    const a = ADDONS[key];
    if (a) { addonCal += a.cal; addonPro += a.pro; addonFat += a.fat; addonCarb += a.carb; }
  });

  const addonLabels = addons.map(k => ADDONS[k]?.label).filter(Boolean);
  const displayName = base.name + (addonLabels.length ? ' (' + addonLabels.join(', ') + ')' : '');

  return {
    id: food.id,
    name: displayName,
    qty,
    serving: base.serving,
    addons,
    cal: Math.round((base.cal + addonCal) * qty),
    pro: Math.round((base.pro + addonPro) * qty),
    fat: Math.round((base.fat + addonFat) * qty),
    carb: Math.round((base.carb + addonCarb) * qty),
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  if (!auth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, date } = req.query || {};
  const dateStr = date || todayKey();

  try {
    if (req.method === 'GET') {
      if (type === 'status') {
        const [workoutData, nutritionData, weightVal] = await Promise.all([
          kv.get(`workouts:${dateStr}`),
          kv.get(`nutrition:${dateStr}`),
          kv.get(`weights:${dateStr}`),
        ]);
        return res.json(computeStatus(workoutData, nutritionData, weightVal, dateStr));
      }

      if (type === 'foods') {
        // Return available food IDs for reference
        return res.json(Object.keys(FOODS).map(id => ({ id, ...FOODS[id] })));
      }

      if (type) {
        const data = await kv.get(`${type}:${dateStr}`);
        return res.json({ date: dateStr, type, data: data || null });
      }

      // No type = return all for date
      const [w, n, wt] = await Promise.all([
        kv.get(`workouts:${dateStr}`),
        kv.get(`nutrition:${dateStr}`),
        kv.get(`weights:${dateStr}`),
      ]);
      return res.json({ date: dateStr, workouts: w, nutrition: n, weight: wt });
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || !body.type) {
        return res.status(400).json({ error: 'Missing type in body' });
      }

      const postDate = body.date || dateStr;

      if (body.type === 'workouts') {
        // Merge with existing day data
        const existing = (await kv.get(`workouts:${postDate}`)) || {};
        const merged = { ...existing, ...body.data };
        await kv.set(`workouts:${postDate}`, merged);
        return res.json({ ok: true, date: postDate, data: merged });
      }

      if (body.type === 'nutrition') {
        if (body.action === 'add') {
          // Add a single food item
          const entry = buildFoodEntry(body.food);
          if (!entry) return res.status(400).json({ error: 'Unknown food ID. Use GET /api/data?type=foods for valid IDs, or provide full macros.' });
          const existing = (await kv.get(`nutrition:${postDate}`)) || [];
          existing.push(entry);
          await kv.set(`nutrition:${postDate}`, existing);
          return res.json({ ok: true, date: postDate, added: entry, total: existing.length });
        }

        if (body.action === 'replace') {
          await kv.set(`nutrition:${postDate}`, body.data || []);
          return res.json({ ok: true, date: postDate, data: body.data });
        }

        if (body.action === 'remove') {
          const existing = (await kv.get(`nutrition:${postDate}`)) || [];
          const index = body.index;
          if (index >= 0 && index < existing.length) {
            const removed = existing.splice(index, 1)[0];
            await kv.set(`nutrition:${postDate}`, existing);
            return res.json({ ok: true, date: postDate, removed, remaining: existing.length });
          }
          return res.status(400).json({ error: 'Invalid index' });
        }

        return res.status(400).json({ error: 'Nutrition requires action: add, replace, or remove' });
      }

      if (body.type === 'weights') {
        const val = body.data;
        if (typeof val !== 'number' || val < 50 || val > 500) {
          return res.status(400).json({ error: 'Weight must be a number between 50-500' });
        }
        await kv.set(`weights:${postDate}`, val);
        return res.json({ ok: true, date: postDate, weight: val });
      }

      return res.status(400).json({ error: 'Invalid type. Use: workouts, nutrition, or weights' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
