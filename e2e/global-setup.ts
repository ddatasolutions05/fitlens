// Resets the e2e user to a blank account before every run so specs do not
// depend on each other's leftovers. Uses the service role key, never in the app.
import 'dotenv/config';

export default async function globalSetup(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_USER_EMAIL;
  if (!url || !service || !email) return;

  const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
  const usersRes = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
  if (!usersRes.ok) throw new Error(`Could not list users: ${usersRes.status}`);
  const users = (await usersRes.json()) as { users: { id: string; email: string }[] };
  const user = users.users.find((u) => u.email === email);
  if (!user) return;

  const tables = [
    'meals',
    'weight_logs',
    'activity_records',
    'water_logs',
    'day_status',
    'goal_versions',
    'saved_meals',
    'recipes',
    'user_food_usage',
    'target_suggestions',
    'integration_connections',
    'preferences',
    'profiles',
  ];
  for (const table of tables) {
    const res = await fetch(`${url}/rest/v1/${table}?user_id=eq.${user.id}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
    if (!res.ok && res.status !== 404) throw new Error(`Reset of ${table} failed: ${res.status} ${await res.text()}`);
  }
  const foods = await fetch(`${url}/rest/v1/foods?owner_user_id=eq.${user.id}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
  if (!foods.ok) throw new Error(`Reset of foods failed: ${foods.status}`);
  console.log(`e2e user reset (${email})`);
}
