// Demo gym for showing the trainer view: one trainer, five members, two weeks
// of meals, weigh-ins, workouts and water, linked and with a note each.
// Usage: node scripts/demo-gym.mjs            (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)
//        node scripts/demo-gym.mjs --remove   (deletes the demo accounts again)
import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const remove = process.argv.includes('--remove');

const TZ = 'America/Toronto';
const TRAINER = { email: 'demo-trainer@fitlens.demo', name: 'Demo Trainer' };
const MEMBERS = [
  { email: 'demo-aman@fitlens.demo', name: 'Aman (demo)', kg: 82, target: 2100, protein: 140, logRate: 0.95, drift: -0.08 },
  { email: 'demo-priya@fitlens.demo', name: 'Priya (demo)', kg: 64, target: 1700, protein: 110, logRate: 0.8, drift: -0.05 },
  { email: 'demo-jas@fitlens.demo', name: 'Jas (demo)', kg: 91, target: 2400, protein: 160, logRate: 0.55, drift: 0.02 },
  { email: 'demo-neha@fitlens.demo', name: 'Neha (demo)', kg: 58, target: 1600, protein: 100, logRate: 0.9, drift: -0.03 },
  { email: 'demo-rohit@fitlens.demo', name: 'Rohit (demo)', kg: 76, target: 2000, protein: 130, logRate: 0.3, drift: 0.05 },
];
const FOODS = [
  ['Roti (phulka), whole wheat, plain', 80, 2.6, 'breakfast'],
  ['Egg, boiled', 100, 13, 'breakfast'],
  ['Poha', 180, 4, 'breakfast'],
  ['Chai with milk and sugar', 150, 1.5, 'breakfast'],
  ['Toor dal, tadka', 150, 7, 'lunch'],
  ['Rice, white, cooked, plain', 200, 4, 'lunch'],
  ['Chicken curry, home style', 180, 20, 'dinner'],
  ['Paneer bhurji', 150, 18, 'dinner'],
  ['Mixed vegetable sabzi, dry', 120, 3, 'dinner'],
  ['Curd (dahi), whole milk', 100, 3.5, 'lunch'],
  ['Chole (chickpea curry)', 180, 10, 'lunch'],
  ['Banana', 100, 1.2, 'snack'],
  ['Roasted chana (bhuna chana)', 110, 6, 'snack'],
];

function localDate(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function daysAgo(n, hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour + 4, 0, 0, 0); // roughly Toronto afternoon
  return d;
}
function seeded(seed) {
  let x = seed % 2147483647;
  return () => (x = (x * 48271) % 2147483647) / 2147483647;
}

async function findUser(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(email, name, password) {
  const existing = await findUser(email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  return data.user.id;
}

async function removeAll() {
  for (const m of [TRAINER, ...MEMBERS]) {
    const u = await findUser(m.email);
    if (u) {
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) throw error;
      console.log('removed', m.email);
    }
  }
}

async function seedMember(m, trainerId, index) {
  const rnd = seeded(1000 + index);
  const password = randomBytes(9).toString('base64url');
  const id = await ensureUser(m.email, m.name, password);
  const today = localDate(new Date());
  await admin.from('profiles').upsert({ user_id: id, display_name: m.name, timezone: TZ, unit_system: 'metric', sex_for_equation: index % 2 ? 'female' : 'male', height_cm: 165 + index * 4, birth_date: `199${index}-05-10`, onboarding_completed_at: daysAgo(20).toISOString() }, { onConflict: 'user_id' });
  await admin.from('preferences').upsert({ user_id: id, diet_pattern: index % 2 ? 'vegetarian' : null, weekly_email: false }, { onConflict: 'user_id' });
  await admin.from('goal_versions').insert({ user_id: id, effective_from: localDate(daysAgo(20)), goal_type: m.drift < 0 ? 'fat_loss' : 'maintenance', pace: 0.5, activity_level: 'light', calorie_target: m.target, protein_g: m.protein, fibre_g: 25, step_goal: 8000, water_ml: 2500, source: 'calculated', rationale: 'demo' });
  for (let day = 14; day >= 0; day -= 1) {
    const d = localDate(daysAgo(day));
    if (rnd() > m.logRate) continue;
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
      if (slot === 'snack' && rnd() < 0.5) continue;
      const picks = FOODS.filter((f) => f[3] === slot);
      const mealId = randomUUID();
      const eatenAt = daysAgo(day, slot === 'breakfast' ? 4 : slot === 'lunch' ? 9 : slot === 'dinner' ? 15 : 12).toISOString();
      const { error } = await admin.from('meals').insert({ id: mealId, user_id: id, idempotency_key: randomUUID(), local_date: d, eaten_at: eatenAt, tz: TZ, meal_type: slot, status: 'confirmed', source: 'manual', confirmed_at: eatenAt });
      if (error) throw error;
      const items = picks.slice(0, 1 + Math.floor(rnd() * Math.min(3, picks.length))).map((f, i) => {
        const grams = f[1] * (0.8 + rnd() * 0.5);
        const scale = (m.target / 2000) * (grams / 100);
        return { user_id: id, meal_id: mealId, sort_order: i, name_snapshot: f[0], grams: Math.round(grams), kcal: Math.round(f[1] * scale), protein_g: Math.round(f[2] * scale * 10) / 10, carbs_g: Math.round(f[1] * scale * 0.12), fat_g: Math.round(f[1] * scale * 0.04), provenance: 'database' };
      });
      const { error: e2 } = await admin.from('meal_items').insert(items);
      if (e2) throw e2;
    }
    if (rnd() < 0.5) await admin.from('water_logs').insert({ user_id: id, local_date: d, tz: TZ, logged_at: daysAgo(day, 10).toISOString(), ml: 500 + Math.round(rnd() * 4) * 500 });
    if (rnd() < 0.45) await admin.from('activity_records').insert({ user_id: id, kind: 'workout', start_at: daysAgo(day, 14).toISOString(), local_date: d, tz: TZ, workout_type: index % 2 ? 'strength' : 'walking', intensity: 'moderate', duration_min: 30 + Math.round(rnd() * 3) * 10, note: 'plan:demo' });
    if (day % 3 === 0) await admin.from('weight_logs').insert({ user_id: id, local_date: d, tz: TZ, measured_at: daysAgo(day, 3).toISOString(), kg: Math.round((m.kg + m.drift * (14 - day) + (rnd() - 0.5) * 0.6) * 10) / 10 });
  }
  await admin.from('trainer_links').upsert({ member_user_id: id, trainer_user_id: trainerId, trainer_name: TRAINER.name, status: 'active' }, { onConflict: 'member_user_id' }).then(({ error }) => {
    if (error && !/no unique|constraint/i.test(error.message)) throw error;
  });
  const { data: link } = await admin.from('trainer_links').select('id').eq('member_user_id', id).eq('trainer_user_id', trainerId).limit(1);
  if (!link || link.length === 0) {
    const { error } = await admin.from('trainer_links').insert({ member_user_id: id, trainer_user_id: trainerId, trainer_name: TRAINER.name, status: 'active' });
    if (error) throw error;
  }
  await admin.from('trainer_notes').insert({ member_user_id: id, trainer_user_id: trainerId, note: m.logRate > 0.8 ? 'Strong week of logging. Keep the protein at dinner.' : 'Log lunch on gym days and we can read your week properly.' });
  console.log('seeded', m.email, 'last date', today);
}

async function main() {
  if (remove) return removeAll();
  const password = randomBytes(9).toString('base64url');
  const trainerId = await ensureUser(TRAINER.email, TRAINER.name, password);
  await admin.from('profiles').upsert({ user_id: trainerId, display_name: TRAINER.name, timezone: TZ, onboarding_completed_at: daysAgo(25).toISOString() }, { onConflict: 'user_id' });
  await admin.from('preferences').upsert({ user_id: trainerId, weekly_email: false }, { onConflict: 'user_id' });
  for (const [i, m] of MEMBERS.entries()) await seedMember(m, trainerId, i);
  const { error } = await admin.auth.admin.updateUserById(trainerId, { password });
  if (error) throw error;
  console.log(`\nDemo trainer sign-in: ${TRAINER.email}\nPassword (shown once; run again to rotate): ${password}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
