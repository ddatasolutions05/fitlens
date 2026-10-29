import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, as, closeDatabase, createUser, expectDenied, resetDatabase, uuid, type TestUser } from './helpers';

let userA: TestUser;
let userB: TestUser;

beforeAll(async () => {
  await resetDatabase();
  userA = await createUser('a');
  userB = await createUser('b');
});

afterAll(async () => {
  await closeDatabase();
});

interface TableCase {
  table: string;
  /** Inserts one row for the user and returns its primary key filter. */
  insert: (c: Parameters<Parameters<typeof as>[1]>[0], user: TestUser) => Promise<{ where: string; params: unknown[] }>;
}

const today = '2026-10-27';

const cases: TableCase[] = [
  {
    table: 'profiles',
    insert: async (c, u) => {
      await c.query('insert into profiles (user_id, timezone) values ($1, $2)', [u.id, 'America/Toronto']);
      return { where: 'user_id = $1', params: [u.id] };
    },
  },
  {
    table: 'preferences',
    insert: async (c, u) => {
      await c.query('insert into preferences (user_id, diet_pattern) values ($1, $2)', [u.id, 'vegetarian']);
      return { where: 'user_id = $1', params: [u.id] };
    },
  },
  {
    table: 'goal_versions',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into goal_versions (user_id, effective_from, goal_type, calorie_target, source)
         values ($1, $2, 'maintenance', 2000, 'calculated') returning id`,
        [u.id, today],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'foods',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into foods (owner_user_id, source, name, kcal) values ($1, 'user', 'My oats', 380) returning id`,
        [u.id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'food_servings',
    insert: async (c, u) => {
      const f = await c.query(
        `insert into foods (owner_user_id, source, name) values ($1, 'user', 'My roti') returning id`,
        [u.id],
      );
      const r = await c.query(
        `insert into food_servings (food_id, owner_user_id, label, grams) values ($1, $2, '1 medium', 40) returning id`,
        [f.rows[0].id, u.id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'user_food_usage',
    insert: async (c, u) => {
      const f = await c.query(
        `insert into foods (owner_user_id, source, name) values ($1, 'user', 'Usage food') returning id`,
        [u.id],
      );
      await c.query(`insert into user_food_usage (user_id, food_id, use_count) values ($1, $2, 1)`, [u.id, f.rows[0].id]);
      return { where: 'user_id = $1 and food_id = $2', params: [u.id, f.rows[0].id] };
    },
  },
  {
    table: 'meals',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into meals (user_id, idempotency_key, local_date, tz, source, status)
         values ($1, $2, $3, 'America/Toronto', 'manual', 'confirmed') returning id`,
        [u.id, uuid(), today],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'meal_items',
    insert: async (c, u) => {
      const m = await c.query(
        `insert into meals (user_id, idempotency_key, local_date, tz, source) values ($1, $2, $3, 'UTC', 'manual') returning id`,
        [u.id, uuid(), today],
      );
      const r = await c.query(
        `insert into meal_items (user_id, meal_id, name_snapshot, grams, kcal, provenance)
         values ($1, $2, 'Egg', 50, 72, 'database') returning id`,
        [u.id, m.rows[0].id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'meal_photos',
    insert: async (c, u) => {
      const m = await c.query(
        `insert into meals (user_id, idempotency_key, local_date, tz, source) values ($1, $2, $3, 'UTC', 'photo') returning id`,
        [u.id, uuid(), today],
      );
      const r = await c.query(
        `insert into meal_photos (user_id, meal_id, storage_path) values ($1, $2, $3) returning id`,
        [u.id, m.rows[0].id, `${u.id}/${m.rows[0].id}/${uuid()}.jpg`],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'photo_analyses',
    insert: async (c, u) => {
      const m = await c.query(
        `insert into meals (user_id, idempotency_key, local_date, tz, source) values ($1, $2, $3, 'UTC', 'photo') returning id`,
        [u.id, uuid(), today],
      );
      const r = await c.query(
        `insert into photo_analyses (user_id, meal_id, status) values ($1, $2, 'queued') returning id`,
        [u.id, m.rows[0].id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'saved_meals',
    insert: async (c, u) => {
      const r = await c.query(`insert into saved_meals (user_id, name) values ($1, 'Usual breakfast') returning id`, [u.id]);
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'saved_meal_items',
    insert: async (c, u) => {
      const s = await c.query(`insert into saved_meals (user_id, name) values ($1, 'SM') returning id`, [u.id]);
      const r = await c.query(
        `insert into saved_meal_items (user_id, saved_meal_id, name_snapshot, grams, provenance)
         values ($1, $2, 'Oats', 40, 'database') returning id`,
        [u.id, s.rows[0].id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'recipes',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into recipes (user_id, name, cooked_yield_g, servings) values ($1, 'Dal', 1500, 5) returning id`,
        [u.id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'recipe_ingredients',
    insert: async (c, u) => {
      const rec = await c.query(
        `insert into recipes (user_id, name, cooked_yield_g, servings) values ($1, 'Dal', 1500, 5) returning id`,
        [u.id],
      );
      const r = await c.query(
        `insert into recipe_ingredients (user_id, recipe_id, name_snapshot, raw_grams) values ($1, $2, 'Toor dal', 500) returning id`,
        [u.id, rec.rows[0].id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'weight_logs',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into weight_logs (user_id, local_date, tz, kg) values ($1, $2, 'UTC', 80.5) returning id`,
        [u.id, today],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'activity_records',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into activity_records (user_id, kind, local_date, tz, steps) values ($1, 'steps', $2, 'UTC', 8000) returning id`,
        [u.id, today],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'water_logs',
    insert: async (c, u) => {
      const r = await c.query(`insert into water_logs (user_id, local_date, tz, ml) values ($1, $2, 'UTC', 250) returning id`, [
        u.id,
        today,
      ]);
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'day_status',
    insert: async (c, u) => {
      await c.query(`insert into day_status (user_id, local_date, status) values ($1, $2, 'complete')`, [u.id, today]);
      return { where: 'user_id = $1 and local_date = $2', params: [u.id, today] };
    },
  },
  {
    table: 'target_suggestions',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into target_suggestions (user_id, proposed_calorie_target) values ($1, 2100) returning id`,
        [u.id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
  {
    table: 'integration_connections',
    insert: async (c, u) => {
      const r = await c.query(
        `insert into integration_connections (user_id, provider) values ($1, 'healthkit') returning id`,
        [u.id],
      );
      return { where: 'id = $1', params: [r.rows[0].id] };
    },
  },
];

describe('row level security', () => {
  for (const tc of cases) {
    describe(tc.table, () => {
      let where: string;
      let params: unknown[];

      it('owner can insert and read back', async () => {
        const key = await as(userA, (c) => tc.insert(c, userA));
        where = key.where;
        params = key.params;
        const rows = await as(userA, (c) => c.query(`select * from ${tc.table} where ${where}`, params));
        expect(rows.rowCount).toBe(1);
      });

      it('another user cannot read it', async () => {
        const rows = await as(userB, (c) => c.query(`select * from ${tc.table} where ${where}`, params));
        expect(rows.rowCount).toBe(0);
      });

      it('another user cannot update it', async () => {
        const cols = await admin((c) =>
          c.query<{ column_name: string }>(
            `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = 'updated_at'`,
            [tc.table],
          ),
        );
        const setClause = cols.rowCount ? 'updated_at = now()' : `${firstMutableColumn(tc.table)}`;
        const res = await as(userB, (c) => c.query(`update ${tc.table} set ${setClause} where ${where}`, params));
        expect(res.rowCount).toBe(0);
      });

      it('another user cannot delete it', async () => {
        const res = await as(userB, (c) => c.query(`delete from ${tc.table} where ${where}`, params));
        expect(res.rowCount).toBe(0);
        const still = await as(userA, (c) => c.query(`select 1 from ${tc.table} where ${where}`, params));
        expect(still.rowCount).toBe(1);
      });

      it('another user cannot insert a row claiming this owner', async () => {
        const message = await expectDenied(as(userB, (c) => tc.insert(c, userA)));
        expect(message).toMatch(/row-level security|user_id must match|not found/i);
      });
    });
  }
});

function firstMutableColumn(table: string): string {
  switch (table) {
    case 'food_servings':
      return 'label = label';
    case 'user_food_usage':
      return 'use_count = use_count';
    case 'water_logs':
      return 'ml = ml';
    case 'saved_meal_items':
    case 'recipe_ingredients':
      return 'name_snapshot = name_snapshot';
    case 'target_suggestions':
      return 'status = status';
    default:
      return 'created_at = created_at';
  }
}

describe('shared foods', () => {
  it('shared rows are readable by every user but writable by none', async () => {
    const shared = await admin((c) =>
      c.query(`insert into foods (source, source_ref, name, kcal, verified) values ('usda', 'test-1', 'Banana, raw', 89, true) returning id`),
    );
    const id = shared.rows[0].id;
    const a = await as(userA, (c) => c.query('select name from foods where id = $1', [id]));
    const b = await as(userB, (c) => c.query('select name from foods where id = $1', [id]));
    expect(a.rows[0].name).toBe('Banana, raw');
    expect(b.rows[0].name).toBe('Banana, raw');
    const upd = await as(userA, (c) => c.query(`update foods set name = 'hacked' where id = $1`, [id]));
    expect(upd.rowCount).toBe(0);
    const del = await as(userA, (c) => c.query('delete from foods where id = $1', [id]));
    expect(del.rowCount).toBe(0);
    const message = await expectDenied(
      as(userA, (c) => c.query(`insert into foods (source, name) values ('usda', 'fake shared')`)),
    );
    expect(message).toMatch(/row-level security|check constraint/i);
  });

  it('ai_usage is read-only for users', async () => {
    await admin((c) => c.query('insert into ai_usage (user_id, local_date, analyses) values ($1, $2, 3)', [userA.id, today]));
    const own = await as(userA, (c) => c.query('select analyses from ai_usage where user_id = $1', [userA.id]));
    expect(own.rows[0].analyses).toBe(3);
    const other = await as(userB, (c) => c.query('select analyses from ai_usage where user_id = $1', [userA.id]));
    expect(other.rowCount).toBe(0);
    const message = await expectDenied(
      as(userA, (c) => c.query('update ai_usage set analyses = 0 where user_id = $1', [userA.id])),
    );
    expect(message).toMatch(/permission denied/i);
  });
});

describe('storage objects', () => {
  it('a user can only touch objects under their own folder', async () => {
    const ownPath = `${userA.id}/${uuid()}/photo.jpg`;
    await as(userA, (c) =>
      c.query(`insert into storage.objects (bucket_id, name, owner) values ('meal-photos', $1, $2)`, [ownPath, userA.id]),
    );
    const seenByB = await as(userB, (c) => c.query('select name from storage.objects where name = $1', [ownPath]));
    expect(seenByB.rowCount).toBe(0);
    const deletedByB = await as(userB, (c) => c.query('delete from storage.objects where name = $1', [ownPath]));
    expect(deletedByB.rowCount).toBe(0);
    const message = await expectDenied(
      as(userB, (c) =>
        c.query(`insert into storage.objects (bucket_id, name, owner) values ('meal-photos', $1, $2)`, [
          `${userA.id}/${uuid()}/intruder.jpg`,
          userB.id,
        ]),
      ),
    );
    expect(message).toMatch(/row-level security/i);
    const seenByA = await as(userA, (c) => c.query('select name from storage.objects where name = $1', [ownPath]));
    expect(seenByA.rowCount).toBe(1);
  });
});

describe('client_events', () => {
  it('a user can insert and read their own reports and nothing else', async () => {
    await as(userA, (c) => c.query(`insert into client_events (user_id, scope, message) values ($1, 'test', 'boom')`, [userA.id]));
    const own = await as(userA, (c) => c.query('select message from client_events where user_id = $1', [userA.id]));
    expect(own.rowCount).toBe(1);
    const other = await as(userB, (c) => c.query('select message from client_events where user_id = $1', [userA.id]));
    expect(other.rowCount).toBe(0);
    const forged = await expectDenied(
      as(userB, (c) => c.query(`insert into client_events (user_id, scope, message) values ($1, 'test', 'forged')`, [userA.id])),
    );
    expect(forged).toMatch(/row-level security/i);
    const update = await expectDenied(as(userA, (c) => c.query(`update client_events set message = 'x' where user_id = $1`, [userA.id])));
    expect(update).toMatch(/permission denied/i);
    const tooLong = await expectDenied(
      as(userA, (c) => c.query(`insert into client_events (user_id, scope, message) values ($1, 'test', repeat('x', 501))`, [userA.id])),
    );
    expect(tooLong).toMatch(/check constraint/i);
    const purged = await admin((c) => c.query('select fitlens.purge_client_events(0) as n'));
    expect(purged.rows[0].n).toBe(1);
  });
});

describe('trainer access', () => {
  it('a member links with a code, the trainer sees a summary, and either side can revoke', async () => {
    const code = await as(userB, (c) => c.query('select public.make_trainer_code() as code'));
    expect(code.rows[0].code).toMatch(/^[A-Z0-9]{6}$/);
    const own = await expectDenied(as(userB, (c) => c.query('select public.link_trainer($1)', [code.rows[0].code])));
    expect(own).toMatch(/own_code/);
    const bad = await expectDenied(as(userA, (c) => c.query(`select public.link_trainer('ZZZZZZ')`)));
    expect(bad).toMatch(/code_not_found/);
    await as(userA, (c) => c.query('select public.link_trainer($1)', [code.rows[0].code]));
    const meal = await as(userA, (c) =>
      c.query(`insert into meals (user_id, idempotency_key, local_date, tz, source, status) values ($1, $2, current_date, 'UTC', 'manual', 'confirmed') returning id`, [userA.id, uuid()]),
    );
    await as(userA, (c) =>
      c.query(`insert into meal_items (user_id, meal_id, name_snapshot, grams, kcal, provenance) values ($1, $2, 'Egg', 50, 72, 'database')`, [userA.id, meal.rows[0].id]),
    );
    const summary = await as(userB, (c) => c.query('select * from public.trainer_members(7)'));
    expect(summary.rowCount).toBe(1);
    expect(summary.rows[0].member_user_id).toBe(userA.id);
    expect(Number(summary.rows[0].meals)).toBeGreaterThanOrEqual(1);
    const none = await as(userA, (c) => c.query('select * from public.trainer_members(7)'));
    expect(none.rowCount).toBe(0);
    const forged = await expectDenied(
      as(userB, (c) => c.query(`insert into trainer_links (member_user_id, trainer_user_id) values ($1, $2)`, [userA.id, userB.id])),
    );
    expect(forged).toMatch(/permission denied|row-level security/i);
    await as(userA, (c) => c.query(`update trainer_links set status = 'revoked' where member_user_id = $1`, [userA.id]));
    const after = await as(userB, (c) => c.query('select * from public.trainer_members(7)'));
    expect(after.rowCount).toBe(0);
    const reactivate = await expectDenied(as(userB, (c) => c.query(`update trainer_links set status = 'active' where trainer_user_id = $1`, [userB.id])));
    expect(reactivate).toMatch(/row-level security/i);
  });
});

describe('trainer notes', () => {
  it('only a linked trainer can write; the member reads and can clear it', async () => {
    const code = await as(userB, (c) => c.query('select public.make_trainer_code() as code'));
    await as(userA, (c) => c.query('select public.link_trainer($1)', [code.rows[0].code]));
    await as(userB, (c) => c.query(`insert into trainer_notes (member_user_id, trainer_user_id, note) values ($1, $2, 'Great week. Keep the walks going.')`, [userA.id, userB.id]));
    const seen = await as(userA, (c) => c.query('select note from trainer_notes where member_user_id = $1', [userA.id]));
    expect(seen.rows[0].note).toContain('Great week');
    const forged = await expectDenied(as(userA, (c) => c.query(`insert into trainer_notes (member_user_id, trainer_user_id, note) values ($1, $2, 'self')`, [userA.id, userB.id])));
    expect(forged).toMatch(/row-level security/i);
    await as(userA, (c) => c.query(`update trainer_links set status = 'revoked' where member_user_id = $1`, [userA.id]));
    const afterRevoke = await expectDenied(as(userB, (c) => c.query(`insert into trainer_notes (member_user_id, trainer_user_id, note) values ($1, $2, 'still here?')`, [userA.id, userB.id])));
    expect(afterRevoke).toMatch(/row-level security/i);
    const cleared = await as(userA, (c) => c.query('delete from trainer_notes where member_user_id = $1', [userA.id]));
    expect(cleared.rowCount).toBe(1);
  });
});

describe('admin overview', () => {
  it('is denied unless the caller is listed in app_admins, and then sees every account', async () => {
    const denied = await expectDenied(as(userA, (c) => c.query('select public.admin_overview(7)')));
    expect(denied).toMatch(/admin only/);
    const flag = await as(userA, (c) => c.query('select public.is_admin() as ok'));
    expect(flag.rows[0].ok).toBe(false);
    const forged = await expectDenied(as(userA, (c) => c.query('insert into app_admins (user_id) values ($1)', [userA.id])));
    expect(forged).toMatch(/permission denied|row-level security/i);
    await admin((c) => c.query('insert into app_admins (user_id) values ($1)', [userA.id]));
    const now = await as(userA, (c) => c.query('select public.is_admin() as ok'));
    expect(now.rows[0].ok).toBe(true);
    const res = await as(userA, (c) => c.query('select public.admin_overview(7) as o'));
    const o = res.rows[0].o;
    expect(Number(o.totals.accounts)).toBeGreaterThanOrEqual(2);
    expect(o.users.some((u: { user_id: string }) => u.user_id === userB.id)).toBe(true);
    expect(Array.isArray(o.errors)).toBe(true);
    expect(Array.isArray(o.events)).toBe(true);
    await as(userB, (c) => c.query(`select public.note_search_miss('gulab jamun dry')`));
    const denied2 = await expectDenied(as(userB, (c) => c.query('select * from search_misses')));
    expect(denied2).toMatch(/permission denied/i);
    const again = await as(userA, (c) => c.query('select public.admin_overview(7) as o'));
    expect(again.rows[0].o.misses.some((m: { query: string }) => m.query === 'gulab jamun dry')).toBe(true);
    await admin((c) => c.query('delete from app_admins where user_id = $1', [userA.id]));
  });
});

describe('reminders and push subscriptions', () => {
  it('are private to the account', async () => {
    await as(userA, (c) => c.query(`insert into reminders (user_id, enabled, local_time) values ($1, true, '20:00')`, [userA.id]));
    await as(userA, (c) => c.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/a', 'k', 'a')`, [userA.id]));
    const mine = await as(userA, (c) => c.query('select enabled, local_time from reminders'));
    expect(mine.rowCount).toBe(1);
    expect(String(mine.rows[0].local_time)).toMatch(/^20:00/);
    const theirs = await as(userB, (c) => c.query('select * from reminders'));
    expect(theirs.rowCount).toBe(0);
    const subs = await as(userB, (c) => c.query('select * from push_subscriptions'));
    expect(subs.rowCount).toBe(0);
    const forged = await expectDenied(as(userB, (c) => c.query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/b', 'k', 'a')`, [userA.id])));
    expect(forged).toMatch(/row-level security/i);
  });
});

describe('visits', () => {
  it('cannot be read or written by accounts, and the admin sees them with sources and places', async () => {
    await admin((c) => c.query(`insert into visits (visitor_id, user_id, source, country, city, platform) values (gen_random_uuid(), $1, 'mom', 'Canada', 'Brampton', 'ios-web'), (gen_random_uuid(), null, 'gym-whatsapp', 'Canada', 'Caledon', 'android-web')`, [userB.id]));
    const denied = await expectDenied(as(userA, (c) => c.query('select * from visits')));
    expect(denied).toMatch(/permission denied/i);
    const forged = await expectDenied(as(userA, (c) => c.query(`insert into visits (visitor_id) values (gen_random_uuid())`)));
    expect(forged).toMatch(/permission denied/i);
    await admin((c) => c.query('insert into app_admins (user_id) values ($1)', [userA.id]));
    const res = await as(userA, (c) => c.query('select public.admin_overview(7) as o'));
    const o = res.rows[0].o;
    expect(o.visits.length).toBeGreaterThanOrEqual(2);
    expect(o.sources.map((s: { source: string }) => s.source)).toEqual(expect.arrayContaining(['mom', 'gym-whatsapp']));
    expect(o.places.some((p: { city: string }) => p.city === 'Brampton')).toBe(true);
    expect(o.users.find((u: { user_id: string }) => u.user_id === userB.id).first_source).toBe('mom');
    await admin((c) => c.query('delete from app_admins where user_id = $1', [userA.id]));
  });
});

describe('measurements and the weekly email list', () => {
  it('measurements are owner only and need a value or a photo', async () => {
    await as(userA, (c) => c.query(`insert into measurements (user_id, local_date, tz, waist_cm) values ($1, '2026-10-29', 'UTC', 86.5)`, [userA.id]));
    const empty = await expectDenied(as(userA, (c) => c.query(`insert into measurements (user_id, local_date, tz) values ($1, '2026-10-29', 'UTC')`, [userA.id])));
    expect(empty).toMatch(/measurements_something/);
    const theirs = await as(userB, (c) => c.query('select * from measurements'));
    expect(theirs.rowCount).toBe(0);
    const mine = await as(userA, (c) => c.query('select waist_cm from measurements'));
    expect(Number(mine.rows[0].waist_cm)).toBe(86.5);
  });

  it('weekly_email_candidates is not callable by accounts', async () => {
    const denied = await expectDenied(as(userA, (c) => c.query('select * from public.weekly_email_candidates()')));
    expect(denied).toMatch(/permission denied/i);
  });
});
